import Link from "next/link";
import {
  BarChart3, Bell, Building2, ClipboardCheck, Database, FileBarChart,
  Package, Settings, ShieldCheck, Users, WandSparkles
} from "lucide-react";
import { Logo } from "@/components/logo";

const items = [
  ["Overview", "/dashboard", BarChart3],
  ["Companies", "/dashboard/companies", Building2],
  ["Products", "/dashboard/products", Package],
  ["Cleaning", "/dashboard/cleaning", WandSparkles],
  ["Analyzer", "/dashboard/analyzer", Database],
  ["Analytics", "/dashboard/analytics", BarChart3],
  ["Reports", "/dashboard/reports", FileBarChart],
  ["Audits", "/dashboard/audits", ClipboardCheck],
  ["Notifications", "/dashboard/notifications", Bell],
  ["Team", "/dashboard/team", Users],
  ["Administration", "/dashboard/admin", ShieldCheck],
  ["Settings", "/dashboard/settings", Settings],
] as const;

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:block">
      <div className="px-2 py-2"><Logo /></div>
      <nav className="mt-8 space-y-1">
        {items.map(([label, href, Icon]) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white">
            <Icon size={18} />{label}
          </Link>
        ))}
      </nav>
      <div className="mt-8 rounded-2xl bg-indigo-50 p-4 text-sm dark:bg-indigo-950/30">
        <div className="font-semibold text-indigo-900 dark:text-indigo-200">Maas Final</div>
        <p className="mt-1 text-indigo-700 dark:text-indigo-300">Seven consolidated milestones with real-time data, audits, analytics and enterprise controls.</p>
      </div>
    </aside>
  );
}
