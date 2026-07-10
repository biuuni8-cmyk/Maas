import { Activity, Database, ShieldCheck } from "lucide-react";

export function DataIllustration({ compact = false }: { compact?: boolean }) {
  const bars = ["h-16 bg-teal-500", "h-24 bg-indigo-500", "h-12 bg-[#f9735b]", "h-20 bg-amber-400"];

  return (
    <div className={`maas-illustration rounded-xl ${compact ? "p-5" : "p-7"}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase text-teal-700 dark:text-teal-300">Live data map</div>
          <div className="mt-1 text-lg font-bold">Workspace health</div>
        </div>
        <div className="grid size-11 place-items-center rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
          <Database size={19} />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-[1fr_.75fr] gap-4">
        <div className="rounded-xl border border-white/70 bg-white/72 p-4 dark:border-slate-700/70 dark:bg-slate-900/70">
          <div className="flex h-32 items-end gap-3">
            {bars.map((bar, index) => (
              <div key={bar} className="flex flex-1 flex-col items-center gap-2">
                <div className={`w-full rounded-t-lg ${bar}`} style={{ opacity: 0.78 + index * 0.05 }} />
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-teal-50 p-2 font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-200">Clean</div>
            <div className="rounded-lg bg-orange-50 p-2 font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-200">Review</div>
            <div className="rounded-lg bg-indigo-50 p-2 font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">Audit</div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            [ShieldCheck, "RLS", "Secure"],
            [Activity, "98%", "Quality"],
            [Database, "Live", "Sync"],
          ].map(([Icon, value, label]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={String(label)} className="rounded-xl border border-white/70 bg-white/74 p-3 dark:border-slate-700/70 dark:bg-slate-900/72">
                <I className="text-[#f9735b]" size={18} />
                <div className="mt-3 text-lg font-bold">{String(value)}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{String(label)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
