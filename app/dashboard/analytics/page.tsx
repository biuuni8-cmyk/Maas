import { getActiveCompany } from "@/lib/auth";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

export default async function AnalyticsPage(){
  const {supabase,company}=await getActiveCompany();
  if(!company) return <div>No active company.</div>;
  const companyId=String(company.id);
  const [snapshots,audits,products]=await Promise.all([
    supabase.from("analytics_snapshots").select("*").eq("company_id",companyId).order("snapshot_date",{ascending:false}).limit(365),
    supabase.from("audits").select("id,title,period_type,score,status,created_at").eq("company_id",companyId).order("created_at",{ascending:false}).limit(50),
    supabase.from("products").select("id,category,price,cost,stock_quantity,status,quality_score").eq("company_id",companyId),
  ]);
  return <AnalyticsDashboard initialSnapshots={(snapshots.data??[]) as never[]} audits={(audits.data??[]) as never[]} products={(products.data??[]) as never[]}/>;
}
