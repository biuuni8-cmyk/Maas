"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveCompany } from "@/lib/auth";

const productSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(2),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  description: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  price: z.coerce.number().nonnegative().optional(),
  cost: z.coerce.number().nonnegative().optional(),
  stock_quantity: z.coerce.number().optional(),
  unit: z.string().trim().optional(),
  currency: z.string().trim().length(3).transform((v) => v.toUpperCase()),
  status: z.enum(["active", "draft", "archived"]).default("active"),
});

const editableColumns = new Set([
  "sku", "name", "category", "brand", "description", "barcode", "price", "cost",
  "stock_quantity", "unit", "currency", "quality_score", "status",
]);

export async function addProduct(formData: FormData) {
  const parsed = productSchema.parse(Object.fromEntries(formData));
  const { supabase, company, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const { error } = await supabase.from("products").insert({
    ...parsed,
    company_id: company.id,
    created_by: user.id,
    category: parsed.category || null,
    brand: parsed.brand || null,
    description: parsed.description || null,
    barcode: parsed.barcode || null,
    unit: parsed.unit || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/products");
}

export async function updateProductCell(input: {
  id: string;
  column: string;
  value: string | number | null;
}) {
  const { supabase, company } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  if (!editableColumns.has(input.column)) throw new Error("Column is not editable");

  let value: string | number | null = input.value;
  if (["price", "cost", "stock_quantity", "quality_score"].includes(input.column)) {
    value = input.value === "" || input.value === null ? null : Number(input.value);
    if (value !== null && !Number.isFinite(value)) throw new Error("Invalid number");
  }
  if (input.column === "currency" && typeof value === "string") value = value.toUpperCase().slice(0, 3);
  if (input.column === "status" && !["active", "draft", "archived"].includes(String(value))) throw new Error("Invalid status");

  const { error } = await supabase
    .from("products")
    .update({ [input.column]: value })
    .eq("id", input.id)
    .eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/products");
}

export async function deleteProducts(ids: string[]) {
  const { supabase, company } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  if (!ids.length) return;
  const { error } = await supabase.from("products").delete().eq("company_id", company.id).in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/products");
}

const csvRowSchema = productSchema.extend({ quality_score: z.coerce.number().min(0).max(100).optional() });

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"' && quoted) { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); if (row.some((v) => v.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
}

export async function importProductsCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("CSV file required");
  if (file.size > 5_000_000) throw new Error("CSV file must be under 5 MB");
  const { supabase, company, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const rows = parseCsv(await file.text());
  if (!rows.length) throw new Error("CSV must contain a header and at least one data row");

  const { data: importJob, error: importError } = await supabase.from("product_imports").insert({
    company_id: company.id,
    created_by: user.id,
    filename: file.name,
    status: "processing",
    total_rows: rows.length,
  }).select("id").single();
  if (importError) throw new Error(importError.message);

  const valid: Record<string, unknown>[] = [];
  const errors: { row: number; message: string }[] = [];
  rows.forEach((row, index) => {
    const result = csvRowSchema.safeParse({ ...row, currency: row.currency || "USD", status: row.status || "active" });
    if (!result.success) errors.push({ row: index + 2, message: result.error.issues.map((i) => i.message).join(", ") });
    else valid.push({ ...result.data, company_id: company.id, created_by: user.id });
  });

  let upserted = 0;
  if (valid.length) {
    const { data, error } = await supabase.from("products").upsert(valid, { onConflict: "company_id,sku" }).select("id");
    if (error) errors.push({ row: 0, message: error.message });
    else upserted = data?.length ?? 0;
  }

  await supabase.from("product_imports").update({
    status: errors.some((e) => e.row === 0) ? "failed" : "completed",
    inserted_rows: upserted,
    failed_rows: errors.length,
    errors,
    completed_at: new Date().toISOString(),
  }).eq("id", importJob.id);

  revalidatePath("/dashboard/products");
  return { total: rows.length, upserted, failed: errors.length, errors: errors.slice(0, 20) };
}

export async function saveProductView(input: {
  name: string;
  filters: Record<string, unknown>;
  sorting: Array<{ column: string; direction: "asc" | "desc" }>;
  visibleColumns: string[];
}) {
  const { supabase, company, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const name = z.string().trim().min(1).max(60).parse(input.name);
  const { error } = await supabase.from("saved_product_views").upsert({
    company_id: company.id,
    user_id: user.id,
    name,
    filters: input.filters,
    sorting: input.sorting,
    visible_columns: input.visibleColumns,
  }, { onConflict: "company_id,user_id,name" });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/products");
}
