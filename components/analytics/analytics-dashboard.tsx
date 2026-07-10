"use client";

import { useMemo, useState, useTransition } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Archive, BadgeDollarSign, Boxes, ClipboardCheck, RefreshCw, Sparkles } from "lucide-react";
import { captureAnalyticsSnapshot } from "@/app/dashboard/analytics/actions";

type Snapshot = { id:string; snapshot_date:string; metrics:Record<string,number|null>; dimensions:{categories?:Record<string,number>} };
type Audit = { id:string; title:string|null; period_type:string; score:number|null; status:string; created_at:string };
type Product = { id:string; category:string|null; price:number|null; cost:number|null; stock_quantity:number|null; status:string; quality_score:number|null };

function money(value:number){ return new Intl.NumberFormat(undefined,{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value); }

export function AnalyticsDashboard({initialSnapshots, audits, products}:{initialSnapshots:Snapshot[];audits:Audit[];products:Product[]}){
  const [period,setPeriod]=useState("30");
  const [pending,startTransition]=useTransition();
  const current=useMemo(()=>{
    const totalProducts=products.length;
    const activeProducts=products.filter(p=>p.status==="active").length;
    const inventoryValue=products.reduce((s,p)=>s+Number(p.price??0)*Number(p.stock_quantity??0),0);
    const inventoryCost=products.reduce((s,p)=>s+Number(p.cost??0)*Number(p.stock_quantity??0),0);
    const averageQuality=totalProducts?products.reduce((s,p)=>s+Number(p.quality_score??0),0)/totalProducts:0;
    return {totalProducts,activeProducts,inventoryValue,inventoryCost,potentialMargin:inventoryValue-inventoryCost,averageQuality,latestAuditScore:Number(audits[0]?.score??0)};
  },[products,audits]);
  const cutoff=Date.now()-Number(period)*86400000;
  const trend=initialSnapshots.filter(s=>new Date(s.snapshot_date).getTime()>=cutoff).slice().reverse().map(s=>({date:s.snapshot_date.slice(5),value:Number(s.metrics.inventoryValue??0),quality:Number(s.metrics.averageQuality??0),products:Number(s.metrics.totalProducts??0)}));
  const categoryMap=products.reduce<Record<string,number>>((a,p)=>{const k=p.category||"Uncategorized";a[k]=(a[k]||0)+1;return a;},{});
  const categories=Object.entries(categoryMap).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,10);
  const cards=[
    ["Products",current.totalProducts,Boxes],
    ["Active records",current.activeProducts,Activity],
    ["Inventory value",money(current.inventoryValue),BadgeDollarSign],
    ["Potential margin",money(current.potentialMargin),Sparkles],
    ["Average quality",`${current.averageQuality.toFixed(1)}%`,Archive],
    ["Latest audit",`${current.latestAuditScore.toFixed(1)}%`,ClipboardCheck],
  ] as const;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Analytics</h1><p className="text-sm text-slate-500">Live operational intelligence and period comparisons.</p></div><div className="flex gap-2"><select value={period} onChange={e=>setPeriod(e.target.value)} className="rounded-xl border bg-transparent px-3 py-2 text-sm dark:border-slate-700"><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">12 months</option></select><button onClick={()=>startTransition(()=>captureAnalyticsSnapshot())} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={16} className={pending?"animate-spin":""}/>{pending?"Capturing":"Capture snapshot"}</button></div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value,Icon])=><div key={label} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between text-sm text-slate-500"><span>{label}</span><Icon size={18}/></div><div className="mt-3 text-3xl font-semibold">{value}</div></div>)}</div>
    <div className="grid gap-6 xl:grid-cols-3"><div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 xl:col-span-2"><h2 className="font-semibold">Inventory value trend</h2><div className="mt-5 h-80">{trend.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="value" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={.35}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={(v)=>money(Number(v))}/><Area type="monotone" dataKey="value" stroke="#4f46e5" fill="url(#value)"/></AreaChart></ResponsiveContainer>:<div className="flex h-full items-center justify-center text-sm text-slate-500">Capture daily snapshots to build a historical trend.</div>}</div></div>
    <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><h2 className="font-semibold">Category mix</h2><div className="mt-5 h-80">{categories.length?<ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>{categories.map((_,i)=><Cell key={i} fill={["#4f46e5","#0ea5e9","#14b8a6","#f59e0b","#f43f5e","#8b5cf6"][i%6]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer>:<div className="flex h-full items-center justify-center text-sm text-slate-500">No category data yet.</div>}</div></div></div>
    <div className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><h2 className="font-semibold">Product distribution</h2><div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={categories}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="name" hide/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="value" fill="#0ea5e9" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></div><div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"><h2 className="font-semibold">Recent audit performance</h2><div className="mt-4 space-y-3">{audits.slice(0,8).map(a=><div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-900"><div><div className="text-sm font-medium">{a.title||a.period_type.replaceAll("_"," ")}</div><div className="text-xs text-slate-500">{new Date(a.created_at).toLocaleDateString()} · {a.status}</div></div><div className="text-lg font-semibold">{Number(a.score??0).toFixed(1)}%</div></div>)}{!audits.length&&<p className="text-sm text-slate-500">Run an audit to begin comparison.</p>}</div></div></div>
  </div>
}
