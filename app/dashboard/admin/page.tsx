import { getActiveCompany } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function AdminPage(){
 const {supabase,company,membership}=await getActiveCompany();
 if(!company) return <p>No company selected.</p>;
 const role=String((membership as {role?: string}|null)?.role ?? "viewer");
 if(!["owner","admin"].includes(role)) redirect("/dashboard");
 const id=String(company.id);
 const [{data:keys},{data:webhooks},{data:usage},{data:events}] = await Promise.all([
  supabase.from("api_keys").select("id,name,key_prefix,scopes,last_used_at,expires_at,revoked_at,created_at").eq("company_id",id).order("created_at",{ascending:false}),
  supabase.from("webhook_endpoints").select("id,url,events,active,created_at").eq("company_id",id).order("created_at",{ascending:false}),
  supabase.from("usage_counters").select("period_start,api_requests,imports,exports,storage_bytes").eq("company_id",id).order("period_start",{ascending:false}).limit(6),
  supabase.from("security_events").select("id,event_type,created_at,metadata").eq("company_id",id).order("created_at",{ascending:false}).limit(20)
 ]);
 return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Enterprise administration</h1><p className="mt-2 text-slate-500">API access, integrations, usage, and security for {String(company.name)}.</p></div>
 <div className="grid gap-4 md:grid-cols-4">{[
  ["Role",role],["API keys",String(keys?.length??0)],["Webhooks",String(webhooks?.length??0)],["Security events",String(events?.length??0)]
 ].map(([k,v])=><Card key={k} className="p-5"><p className="text-sm text-slate-500">{k}</p><p className="mt-2 text-2xl font-semibold">{v}</p></Card>)}</div>
 <div className="grid gap-5 lg:grid-cols-2"><Card className="p-6"><h2 className="font-semibold">API keys</h2><div className="mt-4 space-y-3 text-sm">{keys?.length?keys.map((k:any)=><div key={k.id} className="rounded-xl border p-3 dark:border-slate-800"><div className="font-medium">{k.name}</div><div className="text-slate-500">{k.key_prefix}•••• · {(k.scopes??[]).join(", ")}</div></div>):<p className="text-slate-500">No API keys created.</p>}</div></Card>
 <Card className="p-6"><h2 className="font-semibold">Webhook endpoints</h2><div className="mt-4 space-y-3 text-sm">{webhooks?.length?webhooks.map((w:any)=><div key={w.id} className="rounded-xl border p-3 dark:border-slate-800"><div className="font-medium break-all">{w.url}</div><div className="text-slate-500">{w.active?"Active":"Disabled"} · {(w.events??[]).join(", ")||"No events"}</div></div>):<p className="text-slate-500">No webhook endpoints configured.</p>}</div></Card></div>
 <Card className="p-6"><h2 className="font-semibold">Monthly usage</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="py-2">Period</th><th>API requests</th><th>Imports</th><th>Exports</th><th>Storage</th></tr></thead><tbody>{usage?.map((u:any)=><tr key={u.period_start} className="border-t dark:border-slate-800"><td className="py-3">{u.period_start}</td><td>{u.api_requests}</td><td>{u.imports}</td><td>{u.exports}</td><td>{u.storage_bytes} B</td></tr>)}</tbody></table></div></Card>
 </div>
}
