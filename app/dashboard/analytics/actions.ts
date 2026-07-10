"use server";

import { revalidatePath } from "next/cache";
import { getActiveCompany } from "@/lib/auth";

export async function captureAnalyticsSnapshot() {
  const { supabase, company } = await getActiveCompany();
  if (!company) throw new Error("No active company");
  const companyId = String(company.id);
  const [{ data: products }, { data: audits }] = await Promise.all([
    supabase.from("products").select("id,category,price,cost,stock_quantity,status,quality_score,created_at,updated_at").eq("company_id", companyId),
    supabase.from("audits").select("id,score,status,created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(30),
  ]);
  const rows = products ?? [];
  const totalProducts = rows.length;
  const activeProducts = rows.filter((r) => r.status === "active").length;
  const inventoryValue = rows.reduce((sum, r) => sum + Number(r.price ?? 0) * Number(r.stock_quantity ?? 0), 0);
  const inventoryCost = rows.reduce((sum, r) => sum + Number(r.cost ?? 0) * Number(r.stock_quantity ?? 0), 0);
  const averageQuality = totalProducts ? rows.reduce((sum, r) => sum + Number(r.quality_score ?? 0), 0) / totalProducts : 0;
  const categories = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.category || "Uncategorized";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const latestAuditScore = audits?.[0]?.score == null ? null : Number(audits[0].score);
  const metrics = { totalProducts, activeProducts, inventoryValue, inventoryCost, potentialMargin: inventoryValue - inventoryCost, averageQuality, latestAuditScore };
  const dimensions = { categories };
  const { error } = await supabase.from("analytics_snapshots").upsert({ company_id: companyId, snapshot_date: new Date().toISOString().slice(0, 10), metrics, dimensions }, { onConflict: "company_id,snapshot_date" });
  if (error) throw error;
  revalidatePath("/dashboard/analytics");
}

export async function createSavedReport(formData: FormData) {
  const { supabase, company, user } = await getActiveCompany();
  if (!company) throw new Error("No active company");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const period = String(formData.get("period") || "30_days");
  if (!name) throw new Error("Report name is required");
  const { error } = await supabase.from("saved_reports").insert({ company_id: String(company.id), created_by: user.id, name, description, period, status: "draft", configuration: { sections: ["overview", "categories", "audits", "trend"] } });
  if (error) throw error;
  revalidatePath("/dashboard/reports");
}

export async function generateSavedReport(reportId: string) {
  const { supabase, company } = await getActiveCompany();
  if (!company) throw new Error("No active company");
  const companyId = String(company.id);
  const [{ data: snapshots }, { data: audits }, { data: products }] = await Promise.all([
    supabase.from("analytics_snapshots").select("*").eq("company_id", companyId).order("snapshot_date", { ascending: false }).limit(365),
    supabase.from("audits").select("id,title,period_type,score,status,created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50),
    supabase.from("products").select("id,sku,name,category,price,cost,stock_quantity,status,quality_score").eq("company_id", companyId),
  ]);
  const snapshot = { generatedAt: new Date().toISOString(), snapshots: snapshots ?? [], audits: audits ?? [], products: products ?? [] };
  const { error } = await supabase.from("saved_reports").update({ status: "ready", generated_snapshot: snapshot, generated_at: new Date().toISOString() }).eq("id", reportId).eq("company_id", companyId);
  if (error) throw error;
  revalidatePath("/dashboard/reports");
}
