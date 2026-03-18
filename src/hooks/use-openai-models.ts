import { useQuery } from "@tanstack/react-query";

const EDGE_FUNCTION_URL = "https://bgghkwvqtpnsgdpqzrqz.supabase.co/functions/v1/openai-models";

export type OpenAIModel = { id: string };

async function fetchOpenAIModels(): Promise<OpenAIModel[]> {
  const resp = await fetch(EDGE_FUNCTION_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to fetch models: ${resp.status} ${text}`);
  }

  const json = await resp.json();
  return (json.models ?? []) as OpenAIModel[];
}

export const useOpenAIModels = () => {
  return useQuery<OpenAIModel[], Error>({
    queryKey: ["openai-models"],
    queryFn: fetchOpenAIModels,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });
};