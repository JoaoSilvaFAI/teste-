import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

type AgendaRecord = {
  id: string;
  data_visita: string;
  nome_cliente: string;
  ambiente_planejado: string;
  status: "pendente" | "confirmado" | "realizada" | "cancelada";
};

type AgendaTableProps = {
  records: AgendaRecord[];
};

const statusMap: Record<AgendaRecord["status"], { label: string; variant: string }> = {
  pendente: { label: "Pendente", variant: "bg-amber-100 text-amber-700" },
  confirmado: { label: "Confirmado", variant: "bg-emerald-100 text-emerald-700" },
  realizada: { label: "Realizada", variant: "bg-blue-100 text-blue-700" },
  cancelada: { label: "Cancelada", variant: "bg-red-100 text-red-700" },
};

const AgendaTable = ({ records }: AgendaTableProps) => {
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(a.data_visita).getTime() - new Date(b.data_visita).getTime());
  }, [records]);

  return (
    <Card className="h-full rounded-3xl border border-slate-200 bg-white/80 shadow-xl shadow-slate-200/50">
      <CardHeader className="px-6 pt-6">
        <CardTitle className="text-lg font-semibold text-slate-900">Agenda de Hoje (06/03)</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecords.map((record) => {
              const status = statusMap[record.status];
              return (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-sm text-slate-600">
                    {format(new Date(record.data_visita), "HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm font-semibold text-slate-900">{record.nome_cliente}</TableCell>
                  <TableCell className="text-sm text-slate-500">{record.ambiente_planejado}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", status.variant)}>
                      {status.label}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default AgendaTable;
