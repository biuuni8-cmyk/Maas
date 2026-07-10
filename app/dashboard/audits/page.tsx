import { getActiveCompany } from "@/lib/auth";
import { AuditCenter } from "@/components/audits/audit-center";

export default async function AuditsPage() {
  const {supabase,company}=await getActiveCompany();
  if(!company) return <div>No active company.</div>;
  const companyId=String(company.id);
  const [audits,issues,schedules]=await Promise.all([
    supabase.from("audits").select("*").eq("company_id",companyId).order("created_at",{ascending:false}),
    supabase.from("audit_issues").select("*").eq("company_id",companyId).order("created_at",{ascending:false}),
    supabase.from("audit_schedules").select("*").eq("company_id",companyId).order("period_type"),
  ]);
  return <AuditCenter companyId={companyId} initialAudits={(audits.data??[]) as never[]} initialIssues={(issues.data??[]) as never[]} initialSchedules={(schedules.data??[]) as never[]}/>;
}
