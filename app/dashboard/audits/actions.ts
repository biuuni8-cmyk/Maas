"use server";

import { revalidatePath } from "next/cache";
import { getActiveCompany } from "@/lib/auth";
import { buildAuditSnapshot, deriveAuditIssues, scoreAudit } from "@/lib/audits/engine";
import type { AuditPeriod } from "@/lib/audits/types";

function getBounds(period: AuditPeriod, anchor = new Date()) {
  const end = new Date(anchor);
  const start = new Date(anchor);
  if (period === "weekly") start.setDate(start.getDate() - 6);
  if (period === "monthly") start.setMonth(start.getMonth() - 1);
  if (period === "3_months") start.setMonth(start.getMonth() - 3);
  if (period === "6_months") start.setMonth(start.getMonth() - 6);
  if (period === "9_months") start.setMonth(start.getMonth() - 9);
  if (period === "12_months") start.setMonth(start.getMonth() - 12);
  if (period === "yearly") start.setFullYear(start.getFullYear() - 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return {start: iso(start), end: iso(end)};
}

export async function runAudit(period: AuditPeriod) {
  const {supabase, company, user} = await getActiveCompany();
  if (!company) throw new Error("No active company");
  const companyId=String(company.id);
  const {start, end} = getBounds(period);

  const {data: products, error: productError} = await supabase
    .from("products")
    .select("id,sku,name,category,price,cost,stock_quantity,quality_score,status")
    .eq("company_id", companyId);
  if (productError) throw productError;

  const snapshot = buildAuditSnapshot(products ?? []);
  const issues = deriveAuditIssues(snapshot);
  const score = scoreAudit(snapshot);

  const {data: previous} = await supabase.from("audits")
    .select("id,metrics_snapshot,issues_found")
    .eq("company_id", companyId).eq("period_type", period)
    .order("period_end", {ascending:false}).limit(1).maybeSingle();

  const previousSnapshot = (previous?.metrics_snapshot ?? {}) as Record<string, number>;
  const comparison = {
    productCountDelta: snapshot.productCount - Number(previousSnapshot.productCount ?? 0),
    averageQualityDelta: snapshot.averageQuality - Number(previousSnapshot.averageQuality ?? 0),
    issueDelta: issues.length - Number(previous?.issues_found ?? 0),
    inventoryValueDelta: snapshot.totalInventoryValue - Number(previousSnapshot.totalInventoryValue ?? 0),
  };

  const {data: audit, error} = await supabase.from("audits").insert({
    company_id: companyId,
    title: `${period.replaceAll("_", " ")} audit`,
    period_type: period,
    period_start: start,
    period_end: end,
    status: issues.some((issue) => issue.severity === "critical") ? "failed" : "passed",
    issues_found: issues.length,
    score,
    metrics_snapshot: snapshot,
    comparison_snapshot: comparison,
    comparison_audit_id: previous?.id ?? null,
    generated_by: "manual",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    created_by: user.id,
    summary: {critical: issues.filter((i) => i.severity === "critical").length, warning: issues.filter((i) => i.severity === "warning").length, info: issues.filter((i) => i.severity === "info").length},
  }).select("id").single();
  if (error) throw error;

  if (issues.length) {
    const {error: issueError} = await supabase.from("audit_issues").insert(issues.map((issue) => ({...issue, company_id: companyId, audit_id: audit.id})));
    if (issueError) throw issueError;
  }

  await supabase.from("activity_log").insert({company_id:companyId,actor_id:user.id,entity_type:"audit",entity_id:audit.id,action:"run",changes:{period,score,issues:issues.length}});
  revalidatePath("/dashboard/audits");
}

export async function updateIssueStatus(issueId: string, status: "acknowledged" | "resolved" | "dismissed", note?: string) {
  const {supabase, company, user} = await getActiveCompany();
  if (!company) throw new Error("No active company");
  const companyId=String(company.id);
  const patch: Record<string, unknown> = {status, resolution_note: note ?? null};
  if (status === "resolved") Object.assign(patch, {resolved_by:user.id,resolved_at:new Date().toISOString()});
  const {error} = await supabase.from("audit_issues").update(patch).eq("id",issueId).eq("company_id",companyId);
  if (error) throw error;
  revalidatePath("/dashboard/audits");
}

export async function reviewAudit(auditId: string, decision: "approved" | "changes_requested", note?: string) {
  const {supabase,company,user}=await getActiveCompany();
  if (!company) throw new Error("No active company");
  const companyId=String(company.id);
  const {data:audit,error:auditError}=await supabase.from("audits").select("id").eq("id",auditId).eq("company_id",companyId).maybeSingle();
  if(auditError) throw auditError;
  if(!audit) throw new Error("Audit not found");
  const {error}=await supabase.from("audit_reviews").insert({company_id:companyId,audit_id:auditId,reviewer_id:user.id,decision,note:note ?? null});
  if(error) throw error;
  revalidatePath("/dashboard/audits");
}

export async function saveAuditSchedule(period: AuditPeriod, enabled: boolean, runHour = 2) {
  const {supabase,company,user}=await getActiveCompany();
  if(!company) throw new Error("No active company");
  const companyId=String(company.id);
  const timezone=String(company.timezone ?? "UTC");
  const {error}=await supabase.from("audit_schedules").upsert({company_id:companyId,period_type:period,status:enabled?"active":"paused",run_hour:runHour,timezone,created_by:user.id},{onConflict:"company_id,period_type"});
  if(error) throw error;
  revalidatePath("/dashboard/audits");
}
