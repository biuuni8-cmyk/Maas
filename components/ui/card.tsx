import { cn } from "@/lib/utils"; import type { HTMLAttributes } from "react";
export function Card({className,...props}:HTMLAttributes<HTMLDivElement>){return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",className)} {...props}/>}
