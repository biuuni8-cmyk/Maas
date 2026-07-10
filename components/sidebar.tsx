import Link from "next/link";
import {
  BarChart3, Bell, Building2, ClipboardCheck, Database, FileBarChart,
  Package, Settings, ShieldCheck, Users, WandSparkles
} from "lucide-react";
import { Logo } from "@/components/logo";

type CompanyRole = "owner" | "admin" | "analyst" | "viewer";
type NavItem = readonly [
  label: string,
  href: string,
  Icon: typeof BarChart3,
  roles?: readonly CompanyRole[],
];

const items: readonly NavItem[] = [
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
  ["Administration", "/dashboard/admin", ShieldCheck, ["owner", "admin"]],
  ["Settings", "/dashboard/settings", Settings],
] as const;

export function Sidebar({ role = "viewer" }: { role?: CompanyRole }) {
  const visibleItems = items.filter(([, , , roles]) => !roles || roles.includes(role));
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/70 bg-white/78 p-4 shadow-[8px_0_30px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/76 md:block">
      <div className="px-2 py-2"><Logo /></div>
      <nav className="mt-8 space-y-1">
        {visibleItems.map(([label, href, Icon]) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-teal-50 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-teal-950/30 dark:hover:text-teal-200">
            <Icon size={18} />{label}
          </Link>
        ))}
      </nav>
      <div className="maas-illustration mt-8 rounded-xl p-4 text-sm">
        <div className="font-semibold text-slate-950 dark:text-white">Maas Final</div>
        <p className="mt-1 text-slate-600 dark:text-slate-300">Seven consolidated milestones with real-time data, audits, analytics and enterprise controls.</p>
      </div>
    </aside>
  );
}
