import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

declare const Deno: any;
declare const EdgeRuntime: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const payload = await req.json()

        if (payload.event !== 'messages.upsert') {
            return new Response("Evento ignorado", { status: 200, headers: corsHeaders })
        }

        const instanceName = payload.instance
        const messageData = payload.data?.message
        const messageKey = payload.data?.key

        // Ignora mensagens próprias e grupos
        if (!messageKey || messageKey.fromMe || messageKey.remoteJid?.includes('@g.us')) {
            return new Response("Ignorado (fromMe ou Grupo)", { status: 200, headers: corsHeaders })
        }

        // Normaliza número removendo qualquer caractere não numérico
        const customerNumber = messageKey.remoteJid?.split('@')[0].replace(/\D/g, '') || ''
        const messageText =
            messageData?.conversation ||
            messageData?.extendedTextMessage?.text ||
            ""

        if (!messageText || !customerNumber) {
            return new Response("Sem texto ou Sem número", { status: 200, headers: corsHeaders })
        }

        // --- Processamento Assíncrono para evitar Timeout do Webhook ---
        const processWebhook = async () => {
            try {

                const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                const openAiKey = Deno.env.get('OPENAI_API_KEY') ?? ''
                const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL') ?? ''
                const supabase = createClient(supabaseUrl, supabaseKey)

                // ── 1. Identifica Empresa ──────────────────────────────────────────────────
                const { data: empresa, error: empError } = await supabase
                    .from('empresas')
                    .select('id, evolution_apikey, evolution_base_url')
                    .eq('evolution_instance', instanceName)
                    .single()

                if (empError || !empresa) {
                    console.error("Empresa não encontrada para instância:", instanceName)
                    return new Response("Empresa não encontrada", { status: 404, headers: corsHeaders })
                }

                // ── 2. Busca ou Cria Cliente (upsert garante sem duplicata) ──────────────
                const { data: clienteUpsert, error: cliError } = await supabase
                    .from('clientes')
                    .upsert(
                        { empresa_id: empresa.id, whatsapp_number: customerNumber },
                        { onConflict: 'empresa_id,whatsapp_number', ignoreDuplicates: false }
                    )
                    .select('id')
                    .single()

                if (cliError || !clienteUpsert) throw new Error("Erro ao buscar/criar cliente: " + cliError?.message)
                const clienteId: number = clienteUpsert.id

                // ── 3. Busca ou Cria Atendimento ───────────────────────────────────────────
                // Desempate por id garante pegar sempre o mais recente em caso de created_at igual
                const { data: atendimentosAbertos } = await supabase
                    .from('atendimentos')
                    .select('id, active, etapa_atual')
                    .eq('empresa_id', empresa.id)
                    .eq('cliente_id', clienteId)
                    .neq('etapa_atual', 'fechado')
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false })  // desempate por id
                    .limit(1)

                let atendimentoId: number
                let isActive = true

                if (atendimentosAbertos && atendimentosAbertos.length > 0) {
                    // Atendimento ativo encontrado — apenas atualiza last_interaction
                    atendimentoId = atendimentosAbertos[0].id
                    isActive = atendimentosAbertos[0].active ?? true

                    await supabase
                        .from('atendimentos')
                        .update({ last_interaction: new Date().toISOString() })
                        .eq('id', atendimentoId)
                } else {
                    // Nenhum atendimento aberto — cria um novo
                    // ON CONFLICT garante que race conditions não criem duplicatas
                    const { data: novoAtd, error: atdError } = await supabase
                        .from('atendimentos')
                        .insert({
                            empresa_id: empresa.id,
                            cliente_id: clienteId,
                            etapa_atual: 'triagem',
                            active: true,
                            last_interaction: new Date().toISOString(),
                        })
                        .select('id')
                        .single()

                    if (atdError || !novoAtd) {
                        // Se falhou por duplicata (race condition), busca o existente
                        if (atdError?.code === '23505') {
                            const { data: existente } = await supabase
                                .from('atendimentos')
                                .select('id, active')
                                .eq('empresa_id', empresa.id)
                                .eq('cliente_id', clienteId)
                                .neq('etapa_atual', 'fechado')
                                .order('id', { ascending: false })
                                .limit(1)
                                .single()

                            if (!existente) throw new Error("Erro ao recuperar atendimento após conflito.")
                            atendimentoId = existente.id
                            isActive = existente.active ?? true
                        } else {
                            throw new Error("Erro ao criar atendimento: " + atdError?.message)
                        }
                    } else {
                        atendimentoId = novoAtd.id
                    }
                }

                // ── 4. Salva mensagem do usuário ───────────────────────────────────────────
                // Fix: removido campo 'clienteId' que não existe na tabela historico_mensagens
                const { error: insertUserMsgError } = await supabase
                    .from('historico_mensagens')
                    .insert({
                        empresa_id: empresa.id,
                        atendimento_id: atendimentoId,
                        client_id: clienteId,
                        role: 'user',
                        content: messageText,
                    })

                if (insertUserMsgError) throw new Error("Erro ao salvar mensagem: " + insertUserMsgError.message)

                // ── 5. Regra de parada: IA pausada ─────────────────────────────────────────
                if (!isActive) {
                    console.log(`IA pausada para atendimento ${atendimentoId}. Mensagem salva.`)
                    return new Response(
                        JSON.stringify({ success: true, ai_active: false }),
                        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }

                // ── 6. Busca configurações e monta prompt por camadas ────────────────────────
                const { data: config } = await supabase
                    .from('configuracoes_empresa')
                    .select('*')
                    .eq('empresa_id', empresa.id)
                    .single()

                // ── CAMADA 1: base fixa — nunca exposta ao cliente tenant ──────────────────
                const CAMADA_1 = `
            <papel>
            Você é a assistente virtual de atendimento da empresa representada.
            Sua missão é conduzir o cliente desde o primeiro contato até o
            agendamento da visita técnica, com excelência consultiva.
            Você é o orquestrador: identifica a intenção do cliente,
            avança pelas etapas do funil e aciona as ferramentas no momento certo.
            </papel>

            <comportamento>
            TOM E ESTILO:
            - Acolhedor, consultivo e profissional
            - Mensagens curtas, máximo 3 linhas por bloco
            - Separe blocos temáticos com \n\n (serão enviados como balões separados)
            - Use emojis com moderação (1-2 por mensagem no máximo)
            - Chame o cliente pelo nome assim que ele se apresentar
            - Espelhe o vocabulário do cliente (formal se ele for formal, descontraído se for)

            REGRAS ABSOLUTAS:
            - Nunca invente preços, prazos ou especificações técnicas
            - Nunca fale mal de concorrentes
            - Se não souber algo: "Vou verificar com nossa equipe e já te retorno"
            - Respeite a LGPD: nunca compartilhe dados do cliente com terceiros
            - Siga obrigatoriamente todas as regras definidas em <empresa> e <personalizacao>

            ANÁLISE DE SENTIMENTO:
            - Cliente frustrado: valide o sentimento antes de continuar
                Ex: "Entendo, isso é frustrante mesmo... vou te ajudar a resolver."
            - Cliente com urgência: priorize agilidade e objetividade
            - Cliente com dúvida: ofereça clareza com exemplos simples e diretos
            </comportamento>

            <funil>
            <etapa nome="triagem">
                OBJETIVO: Identificar se é um lead qualificado e qual ambiente deseja planejar
                AÇÃO: Saudar e perguntar qual ambiente quer transformar
                AVANÇAR QUANDO: Cliente mencionar o ambiente (cozinha, quarto, sala, home office...)
                TOOL: atualizar_etapa_kanban("qualificacao")
            </etapa>

            <etapa nome="qualificacao">
                OBJETIVO: Entender o projeto em detalhe e criar desejo pela visita técnica
                AÇÕES:
                - Perguntar metragem aproximada do ambiente
                - Perguntar estilo desejado (moderno, clássico, rústico, minimalista)
                - Perguntar prazo desejado para o projeto
                - Apresentar brevemente 1-2 diferenciais da empresa
                AVANÇAR QUANDO: Cliente demonstrar interesse real em conhecer os projetos / visita
                TOOL: atualizar_etapa_kanban("agendamento")
            </etapa>

            <etapa nome="agendamento">
                OBJETIVO: Fechar data e endereço para a visita técnica gratuita
                AÇÕES:
                - Propor 2 opções de horário (nunca deixe o cliente escolher livremente — ofereça opções)
                - Coletar: nome completo, endereço completo com CEP
                - Confirmar com resumo do agendamento
                AVANÇAR QUANDO: Data e endereço confirmados pelo cliente
                TOOL: atualizar_etapa_kanban("fechado")
            </etapa>

            <etapa nome="fechado">
                AÇÃO: Enviar resumo do agendamento e despedida calorosa com expectativa positiva
            </etapa>
            </funil>

            <ferramentas>
            atualizar_etapa_kanban:
                - Use ao atingir o critério de avanço de cada etapa do funil
                - Sempre inclua a mensagem que será enviada ao cliente no campo mensagem_para_cliente
                - Valores válidos: triagem | qualificacao | agendamento | fechado

            transferir_para_humano:
                - Use APENAS se o cliente pedir explicitamente um atendente / pessoa humana
                - Use se o cliente estiver visivelmente frustrado após 2 tentativas sem sucesso
                - Envie uma mensagem de despedida amigável no campo mensagem_despedida
                - NUNCA use por iniciativa própria sem sinal claro do cliente
            </ferramentas>`

                // ── CAMADA 2: template gerado no cadastro (salvo no banco) ─────────────────
                const camada2 = config?.prompt_sistema_base ?? ''

                // ── CAMADA 3: personalização preenchida pelo cliente no Settings ───────────
                const camada3 = config?.prompt_personalizacao
                    ? `<personalizacao>\n${config.prompt_personalizacao}\n</personalizacao>`
                    : ''

                const systemPrompt = [CAMADA_1, camada2, camada3]
                    .filter(Boolean)
                    .join('\n\n')

                // ── 7. Busca histórico (últimas 40 mensagens) ──────────────────────────────
                const { data: historico } = await supabase
                    .from('historico_mensagens')
                    .select('role, content')
                    .eq('atendimento_id', atendimentoId)
                    .order('created_at', { ascending: false })
                    .limit(40)

                const formattedHistory = (historico || [])
                    .reverse()
                    .map((msg: { role: string; content: string }) => ({ role: msg.role, content: msg.content }))

                // ── 8. Tools (Kanban + Transferência) ─────────────────────────────────────
                const tools = [
                    {
                        type: "function",
                        function: {
                            name: "atualizar_etapa_kanban",
                            description: "Move o cliente no funil de vendas. Use 'qualificacao' quando o cliente disser qual ambiente quer. Use 'agendamento' quando for pedir endereço/horário para visita técnica. Use 'fechado' quando o atendimento for concluído.",
                            parameters: {
                                type: "object",
                                properties: {
                                    nova_etapa: {
                                        type: "string",
                                        enum: ["triagem", "qualificacao", "agendamento", "fechado"], // ← padronizado
                                    },
                                    mensagem_para_cliente: {
                                        type: "string",
                                        description: "Texto que você vai enviar ao cliente após mudar a etapa.",
                                    },
                                },
                                required: ["nova_etapa", "mensagem_para_cliente"],
                            },
                        },
                    },
                    {
                        type: "function",
                        function: {
                            name: "transferir_para_humano",
                            description: "Desativa a IA e transfere para um humano. Use APENAS quando o cliente pedir explicitamente para falar com uma pessoa ou estiver frustrado.",
                            parameters: {
                                type: "object",
                                properties: {
                                    mensagem_despedida: {
                                        type: "string",
                                        description: "Mensagem avisando que a transferência está ocorrendo.",
                                    },
                                },
                                required: ["mensagem_despedida"],
                            },
                        },
                    },
                ]

                // ── 9. Sinaliza "digitando..." e chama OpenAI ──────────────────────────────
                const baseUrl = (empresa.evolution_base_url || evolutionApiUrl).replace(/\/$/, '')
                const presenceEndpoint = `${baseUrl}/chat/sendPresence/${instanceName}`

                fetch(presenceEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': empresa.evolution_apikey },
                    body: JSON.stringify({ number: customerNumber, presence: 'composing', delay: 5000 }),
                }).catch(() => { })

                const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openAiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: config?.openai_model || 'gpt-4o-mini',
                        messages: [{ role: 'system', content: systemPrompt }, ...formattedHistory],
                        tools,
                        tool_choice: "auto",
                    }),
                })

                const openAiData = await openAiResponse.json()

                // Fix: guard contra resposta inválida da OpenAI
                if (!openAiData.choices || openAiData.choices.length === 0) {
                    console.error("OpenAI retornou erro:", JSON.stringify(openAiData))
                    throw new Error(`OpenAI falhou: ${openAiData.error?.message ?? 'resposta inválida'}`)
                }

                const responseMessage = openAiData.choices[0].message

                // ── 10. Processa tool calls ────────────────────────────────────────────────
                let aiText: string = responseMessage.content ?? ''

                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    const toolCall = responseMessage.tool_calls[0]
                    const args = JSON.parse(toolCall.function.arguments)

                    if (toolCall.function.name === 'atualizar_etapa_kanban') {
                        console.log(`🤖 IA moveu para etapa: ${args.nova_etapa}`)
                        await supabase
                            .from('atendimentos')
                            .update({ etapa_atual: args.nova_etapa })
                            .eq('id', atendimentoId)
                        aiText = args.mensagem_para_cliente
                    }

                    if (toolCall.function.name === 'transferir_para_humano') {
                        console.log(`🛑 IA solicitou transferência para humano.`)
                        await supabase
                            .from('atendimentos')
                            .update({ active: false })
                            .eq('id', atendimentoId)
                        aiText = args.mensagem_despedida
                    }
                }

                // ── 11. Envia resposta em blocos ───────────────────────────────────────────
                if (aiText) {
                    const sendEndpoint = `${baseUrl}/message/sendText/${instanceName}`

                    const messageBlocks = aiText
                        .split('\n\n')
                        .map((block: string) => block.trim())
                        .filter((block: string) => block.length > 0)

                    for (const block of messageBlocks) {
                        // Sinaliza "digitando..." antes de cada bloco
                        await fetch(presenceEndpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': empresa.evolution_apikey },
                            body: JSON.stringify({ number: customerNumber, presence: 'composing', delay: 3000 }),
                        }).catch(() => { })

                        // Delay dinâmico proporcional ao tamanho do bloco (mín 1s, máx 4s)
                        const delay = Math.min(Math.max(block.length * 25, 1000), 4000)
                        await new Promise((resolve) => setTimeout(resolve, delay))

                        // Salva no histórico
                        await supabase.from('historico_mensagens').insert({
                            empresa_id: empresa.id,
                            atendimento_id: atendimentoId,
                            client_id: clienteId,
                            role: 'assistant',
                            content: block,
                        })

                        // Envia pelo WhatsApp
                        await fetch(sendEndpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': empresa.evolution_apikey },
                            body: JSON.stringify({ number: customerNumber, text: block }),
                        })
                    }
                }

            } catch (bgError: any) {
                console.error("Erro assíncrono no webhook:", bgError.message)
            }
        } // Fim processWebhook

        if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
            EdgeRuntime.waitUntil(processWebhook())
        } else {
            // Fallback (a promise roda solta)
            processWebhook()
        }

        // Responde IMEDIATAMENTE ao Evolution API para evitar loops e reenvio de webhook
        return new Response(
            JSON.stringify({ success: true, message: "Processando em background" }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error("Erro fatal na função principal do webhook:", error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
