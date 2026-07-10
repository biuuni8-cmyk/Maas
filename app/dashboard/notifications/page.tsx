import { getActiveCompany } from "@/lib/auth";
import { Card } from "@/components/ui/card";
export default async function NotificationsPage(){
 const {supabase,company,user}=await getActiveCompany();
 if(!company) return <p>No company selected.</p>;
 const {data}=await supabase.from("notifications").select("id,title,body,severity,read_at,created_at").eq("company_id",String(company.id)).or(`user_id.is.null,user_id.eq.${user.id}`).order("created_at",{ascending:false}).limit(100);
 return <div><h1 className="text-3xl font-bold">Notifications</h1><p className="mt-2 text-slate-500">Realtime operational, audit, and security alerts.</p><div className="mt-6 space-y-3">{data?.length?data.map((n:any)=><Card key={n.id} className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{n.title}</p><p className="mt-1 text-sm text-slate-500">{n.body}</p></div><span className="rounded-full border px-2 py-1 text-xs">{n.severity}</span></div><p className="mt-3 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p></Card>):<Card className="p-8 text-center text-slate-500">No notifications yet.</Card>}</div></div>
}
