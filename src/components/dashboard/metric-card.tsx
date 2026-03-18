import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type MetricCardProps = {
  title: string;
  value: string;
  helper?: string;
  description?: string;
  icon: LucideIcon;
};

const MetricCard = ({ title, value, helper, description, icon: Icon }: MetricCardProps) => {
  return (
    <Card className="h-full rounded-3xl border border-slate-200 bg-white/80 shadow-xl shadow-slate-200/50">
      <CardContent className="h-full space-y-5 px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-teal-500 shadow-lg shadow-teal-300/20">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
                {title}
              </p>
              {helper && <p className="text-sm font-semibold text-teal-500">{helper}</p>}
            </div>
          </div>
        </div>
        <p className="text-4xl font-bold text-slate-900">{value}</p>
        {description && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricCard;
