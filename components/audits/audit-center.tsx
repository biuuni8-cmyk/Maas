"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AUDIT_PERIODS, periodLabel, type AuditPeriod } from "@/lib/audits/types";
import { reviewAudit, runAudit, saveAuditSchedule, updateIssueStatus } from "@/app/dashboard/audits/actions";

type Audit = {id:string;period_type:string;period_start:string;period_end:string;status:string;issues_found:number;score:number|null;metrics_snapshot:Record<string,number>;comparison_snapshot:Record<string,number>;created_at:string};
type Issue = {id:string;audit_id:string;severity:string;status:string;category:string;title:string;description:string|null;resolution_note:string|null;created_at:string};
type Schedule = {id:string;period_type:string;status:string;run_hour:number;timezone:string};

const tone: Record<string,string> = {passed:"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",failed:"bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",pending:"bg-amber-100 text-amber-700",running:"bg-blue-100 text-blue-700"};
const severityTone: Record<string,string> = {critical:"bg-rose-100 text-rose-700",warning:"bg-amber-100 text-amber-700",info:"bg-blue-100 text-blue-700"};

export function AuditCenter({companyId,initialAudits,initialIssues,initialSchedules}:{companyId:string;initialAudits:Audit[];initialIssues:Issue[];initialSchedules:Schedule[]}) {
  const [audits,setAudits]=useState(initialAudits);
  const [issues,setIssues]=useState(initialIssues);
  const [schedules,setSchedules]=useState(initialSchedules);
  const [selected,setSelected]=useState(initialAudits[0]?.id ?? "");
  const [period,setPeriod]=useState<AuditPeriod>("monthly");
  const [tab,setTab]=useState<"overview"|"issues"|"schedule">("overview");
  const [pending,startTransition]=useTransition();
  const audit=audits.find((item)=>item.id===selected) ?? audits[0];
  const currentIssues=issues.filter((item)=>!audit || item.audit_id===audit.id);
  const openIssues=issues.filter((item)=>item.status==="open").length;
  const latestScore=audits[0]?.score ?? 0;
  const averageScore=audits.length ? Math.round(audits.reduce((sum,item)=>sum+Number(item.score ?? 0),0)/audits.length) : 0;
  const metricEntries=useMemo(()=> audit ? [
    ["Products",audit.metrics_snapshot.productCount ?? 0],
    ["Average quality",`${audit.metrics_snapshot.averageQuality ?? 0}%`],
    ["Missing prices",audit.metrics_snapshot.missingPrice ?? 0],
    ["Duplicate SKUs",audit.metrics_snapshot.duplicateSkus ?? 0],
    ["Inventory value",Number(audit.metrics_snapshot.totalInventoryValue ?? 0).toLocaleString()],
  ] : [],[audit]);

  useEffect(()=>{
    const supabase=createClient();
    const channel=supabase.channel(`audit-center-${companyId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"audits",filter:`company_id=eq.${companyId}`},async()=>{const {data}=await supabase.from("audits").select("*").eq("company_id",companyId).order("created_at",{ascending:false});setAudits((data as Audit[])??[]);})
      .on("postgres_changes",{event:"*",schema:"public",table:"audit_issues",filter:`company_id=eq.${companyId}`},async()=>{const {data}=await supabase.from("audit_issues").select("*").eq("company_id",companyId).order("created_at",{ascending:false});setIssues((data as Issue[])??[]);})
      .subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[companyId]);

  const execute=()=>startTransition(async()=>{await runAudit(period);});
  const issueAction=(id:string,status:"acknowledged"|"resolved"|"dismissed")=>startTransition(async()=>{await updateIssueStatus(id,status);setIssues((all)=>all.map((item)=>item.id===id?{...item,status}:item));});
  const toggleSchedule=(p:AuditPeriod)=>startTransition(async()=>{const existing=schedules.find((s)=>s.period_type===p);const enabled=existing?.status!=="active";await saveAuditSchedule(p,enabled,existing?.run_hour??2);setSchedules((all)=>[...all.filter((s)=>s.period_type!==p),{id:existing?.id??p,period_type:p,status:enabled?"active":"paused",run_hour:existing?.run_hour??2,timezone:existing?.timezone??"UTC"}]);});

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h1 className="text-3xl font-bold">Audit center</h1><p className="mt-1 text-sm text-slate-500">Run, compare and review operational data audits from daily to yearly.</p></div><div className="flex gap-2"><select className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-slate-950" value={period} onChange={(e)=>setPeriod(e.target.value as AuditPeriod)}>{AUDIT_PERIODS.map((p)=><option key={p} value={p}>{periodLabel(p)}</option>)}</select><Button onClick={execute} disabled={pending}>{pending?"Running…":"Run audit"}</Button></div></div>

    <div className="grid gap-4 md:grid-cols-4">{[["Latest score",`${latestScore}%`],["Average score",`${averageScore}%`],["Open issues",openIssues],["Completed audits",audits.length]].map(([label,value])=><Card key={label} className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></Card>)}</div>

    <div className="flex gap-2 border-b dark:border-slate-800">{(["overview","issues","schedule"] as const).map((item)=><button key={item} onClick={()=>setTab(item)} className={`border-b-2 px-4 py-3 text-sm capitalize ${tab===item?"border-slate-950 font-semibold dark:border-white":"border-transparent text-slate-500"}`}>{item}</button>)}</div>

    {tab==="overview"&&<div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
      <Card className="overflow-hidden"><div className="border-b p-5 dark:border-slate-800"><h2 className="font-semibold">Audit history</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr>{["Period","Range","Score","Status","Issues"].map((h)=><th className="px-5 py-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y dark:divide-slate-800">{audits.map((item)=><tr key={item.id} onClick={()=>setSelected(item.id)} className={`cursor-pointer ${item.id===audit?.id?"bg-slate-50 dark:bg-slate-900/60":""}`}><td className="px-5 py-4 font-medium">{periodLabel(item.period_type)}</td><td className="px-5 py-4 text-slate-500">{item.period_start} → {item.period_end}</td><td className="px-5 py-4 font-semibold">{item.score ?? 0}%</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${tone[item.status]??""}`}>{item.status}</span></td><td className="px-5 py-4">{item.issues_found}</td></tr>)}</tbody></table>{!audits.length&&<div className="p-12 text-center text-sm text-slate-500">Run your first audit to create a real baseline.</div>}</div></Card>
      <div className="space-y-6"><Card className="p-5"><h2 className="font-semibold">Selected audit</h2>{audit?<><div className="mt-5 grid grid-cols-2 gap-3">{metricEntries.map(([label,value])=><div key={String(label)} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><p className="text-slate-500">Quality change</p><p className="font-semibold">{Number(audit.comparison_snapshot.averageQualityDelta??0)>=0?"+":""}{Number(audit.comparison_snapshot.averageQualityDelta??0).toFixed(2)}%</p></div><div><p className="text-slate-500">Issue change</p><p className="font-semibold">{Number(audit.comparison_snapshot.issueDelta??0)>=0?"+":""}{audit.comparison_snapshot.issueDelta??0}</p></div></div><div className="mt-5 flex gap-2"><Button onClick={()=>startTransition(()=>reviewAudit(audit.id,"approved"))} disabled={pending}>Approve</Button><Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={()=>startTransition(()=>reviewAudit(audit.id,"changes_requested"))} disabled={pending}>Request changes</Button></div></>:<p className="mt-4 text-sm text-slate-500">No audit selected.</p>}</Card></div>
    </div>}

    {tab==="issues"&&<Card className="overflow-hidden"><div className="border-b p-5 dark:border-slate-800"><h2 className="font-semibold">Audit findings</h2></div><div className="divide-y dark:divide-slate-800">{currentIssues.map((issue)=><div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between" key={issue.id}><div className="flex gap-3"><span className={`h-fit rounded-full px-2 py-1 text-xs ${severityTone[issue.severity]}`}>{issue.severity}</span><div><p className="font-medium">{issue.title}</p><p className="mt-1 text-sm text-slate-500">{issue.description}</p><p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{issue.category} · {issue.status}</p></div></div>{issue.status==="open"&&<div className="flex gap-2"><Button className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={()=>issueAction(issue.id,"acknowledged")}>Acknowledge</Button><Button onClick={()=>issueAction(issue.id,"resolved")}>Resolve</Button></div>}</div>)}{!currentIssues.length&&<div className="p-12 text-center text-sm text-slate-500">No findings for the selected audit.</div>}</div></Card>}

    {tab==="schedule"&&<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{AUDIT_PERIODS.map((p)=>{const schedule=schedules.find((s)=>s.period_type===p);const active=schedule?.status==="active";return <Card className="p-5" key={p}><div className="flex items-start justify-between"><div><h3 className="font-semibold">{periodLabel(p)}</h3><p className="mt-1 text-sm text-slate-500">Runs at {String(schedule?.run_hour??2).padStart(2,"0")}:00 {schedule?.timezone??"UTC"}</p></div><button onClick={()=>toggleSchedule(p)} className={`h-6 w-11 rounded-full p-1 transition ${active?"bg-emerald-500":"bg-slate-300"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${active?"translate-x-5":""}`}/></button></div><p className="mt-5 text-xs uppercase tracking-wide text-slate-400">{active?"Active":"Paused"}</p></Card>})}</div>}
  </div>;
}
