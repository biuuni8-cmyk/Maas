"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveCompany } from "@/lib/auth";
import { applyMapping, cleanMappedRow, duplicateKey, parseCsv, suggestFieldMapping, validateProductRow } from "@/lib/cleaning/engine";
import type { CleaningRule, FieldMapping } from "@/lib/cleaning/types";

const mappingSchema = z.record(z.string().min(1));
const ruleSchema = z.object({
  name: z.string().trim().min(2),
  field: z.string().trim().min(1),
  ruleType: z.enum(["trim","remove_extra_spaces","uppercase","lowercase","titlecase","normalize_sku","normalize_barcode","coerce_number","default_value"]),
  defaultValue: z.string().optional(),
});

export async function createCleaningJob(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("CSV file required");
  if (file.size > 10_000_000) throw new Error("CSV file must be under 10 MB");
  const { company, supabase, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const parsed = parseCsv(await file.text());
  if (!parsed.headers.length || !parsed.rows.length) throw new Error("CSV needs a header and at least one row");
  if (parsed.rows.length > 25_000) throw new Error("One cleaning job can contain at most 25,000 rows");

  const mapping = suggestFieldMapping(parsed.headers);
  const { data: job, error: jobError } = await supabase.from("cleaning_jobs").insert({
    company_id: company.id,
    created_by: user.id,
    name: file.name.replace(/\.csv$/i, ""),
    source_filename: file.name,
    status: "mapped",
    total_rows: parsed.rows.length,
    source_headers: parsed.headers,
    field_mapping: mapping,
  }).select("id").single();
  if (jobError) throw new Error(jobError.message);

  const staged = parsed.rows.map((raw, index) => ({
    company_id: company.id,
    cleaning_job_id: job.id,
    row_number: index + 2,
    raw_data: raw,
    mapped_data: applyMapping(raw, mapping),
  }));
  for (let index = 0; index < staged.length; index += 500) {
    const { error } = await supabase.from("cleaning_staged_rows").insert(staged.slice(index, index + 500));
    if (error) {
      await supabase.from("cleaning_jobs").update({ status: "failed" }).eq("id", job.id);
      throw new Error(error.message);
    }
  }
  revalidatePath("/dashboard/cleaning");
  return job.id as string;
}

export async function updateFieldMapping(jobId: string, mapping: FieldMapping) {
  const parsed = mappingSchema.parse(mapping);
  const { company, supabase } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const { data: rows, error } = await supabase.from("cleaning_staged_rows").select("id,raw_data").eq("company_id", company.id).eq("cleaning_job_id", jobId).limit(25000);
  if (error) throw new Error(error.message);
  await supabase.from("cleaning_jobs").update({ field_mapping: parsed, status: "mapped" }).eq("id", jobId).eq("company_id", company.id);
  for (const row of rows ?? []) {
    const { error: rowError } = await supabase.from("cleaning_staged_rows").update({ mapped_data: applyMapping(row.raw_data as Record<string, unknown>, parsed) }).eq("id", row.id).eq("company_id", company.id);
    if (rowError) throw new Error(rowError.message);
  }
  revalidatePath("/dashboard/cleaning");
}

export async function addCleaningRule(formData: FormData) {
  const input = ruleSchema.parse({
    name: formData.get("name"), field: formData.get("field"), ruleType: formData.get("ruleType"), defaultValue: formData.get("defaultValue"),
  });
  const { company, supabase, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const { error } = await supabase.from("cleaning_rules").insert({
    company_id: company.id,
    created_by: user.id,
    name: input.name,
    field: input.field,
    rule_type: input.ruleType,
    configuration: input.ruleType === "default_value" ? { value: input.defaultValue ?? "" } : {},
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cleaning");
}

export async function toggleCleaningRule(ruleId: string, enabled: boolean) {
  const { company, supabase } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const { error } = await supabase.from("cleaning_rules").update({ enabled }).eq("id", ruleId).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cleaning");
}

export async function runCleaningJob(jobId: string) {
  const { company, supabase } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  await supabase.from("cleaning_jobs").update({ status: "processing" }).eq("id", jobId).eq("company_id", company.id);
  await supabase.from("cleaning_issues").delete().eq("cleaning_job_id", jobId).eq("company_id", company.id);
  await supabase.from("cleaning_duplicate_candidates").delete().eq("cleaning_job_id", jobId).eq("company_id", company.id);

  const [{ data: rules, error: rulesError }, { data: rows, error: rowsError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from("cleaning_rules").select("*").eq("company_id", company.id).order("priority"),
    supabase.from("cleaning_staged_rows").select("id,row_number,mapped_data").eq("company_id", company.id).eq("cleaning_job_id", jobId).order("row_number").limit(25000),
    supabase.from("products").select("id,sku,barcode,name,brand").eq("company_id", company.id).limit(25000),
  ]);
  if (rulesError || rowsError || productsError) throw new Error(rulesError?.message ?? rowsError?.message ?? productsError?.message);

  const activeRules = (rules ?? []) as CleaningRule[];
  const seenSku = new Map<string, string>();
  const seenBarcode = new Map<string, string>();
  const productSku = new Map((products ?? []).map((product) => [String(product.sku ?? "").trim().toLowerCase(), product.id]));
  const productBarcode = new Map((products ?? []).filter((product) => product.barcode).map((product) => [String(product.barcode).replace(/\D/g, ""), product.id]));
  let validRows = 0; let invalidRows = 0; let duplicateRows = 0;

  for (const row of rows ?? []) {
    const cleaned = cleanMappedRow(row.mapped_data as Record<string, unknown>, activeRules);
    const errors = validateProductRow(cleaned);
    const key = duplicateKey(cleaned);
    const duplicateReasons: string[] = [];
    let existingProductId: string | null = null;
    let duplicateStagedRowId: string | null = null;
    if (key.sku && productSku.has(key.sku)) { existingProductId = productSku.get(key.sku) ?? null; duplicateReasons.push("SKU matches an existing product"); }
    else if (key.barcode && productBarcode.has(key.barcode)) { existingProductId = productBarcode.get(key.barcode) ?? null; duplicateReasons.push("Barcode matches an existing product"); }
    else if (key.sku && seenSku.has(key.sku)) { duplicateStagedRowId = seenSku.get(key.sku) ?? null; duplicateReasons.push("SKU is duplicated in this import"); }
    else if (key.barcode && seenBarcode.has(key.barcode)) { duplicateStagedRowId = seenBarcode.get(key.barcode) ?? null; duplicateReasons.push("Barcode is duplicated in this import"); }

    const isDuplicate = Boolean(existingProductId || duplicateStagedRowId);
    if (key.sku && !seenSku.has(key.sku)) seenSku.set(key.sku, row.id);
    if (key.barcode && !seenBarcode.has(key.barcode)) seenBarcode.set(key.barcode, row.id);
    if (errors.length) invalidRows += 1; else validRows += 1;
    if (isDuplicate) duplicateRows += 1;

    const { error: updateError } = await supabase.from("cleaning_staged_rows").update({
      cleaned_data: cleaned,
      validation_errors: errors,
      is_valid: errors.length === 0,
      is_duplicate: isDuplicate,
      approved: false,
    }).eq("id", row.id).eq("company_id", company.id);
    if (updateError) throw new Error(updateError.message);

    if (errors.length) {
      const { error: issueError } = await supabase.from("cleaning_issues").insert(errors.map((message) => ({
        company_id: company.id, cleaning_job_id: jobId, staged_row_id: row.id, severity: "error", issue_type: "validation", message,
      })));
      if (issueError) throw new Error(issueError.message);
    }
    if (isDuplicate) {
      const { error: duplicateError } = await supabase.from("cleaning_duplicate_candidates").insert({
        company_id: company.id,
        cleaning_job_id: jobId,
        staged_row_id: row.id,
        existing_product_id: existingProductId,
        duplicate_staged_row_id: duplicateStagedRowId,
        score: 1,
        reasons: duplicateReasons,
      });
      if (duplicateError) throw new Error(duplicateError.message);
    }
  }
  const { error: finalError } = await supabase.from("cleaning_jobs").update({ status: "review", valid_rows: validRows, invalid_rows: invalidRows, duplicate_rows: duplicateRows }).eq("id", jobId).eq("company_id", company.id);
  if (finalError) throw new Error(finalError.message);
  revalidatePath("/dashboard/cleaning");
}

export async function resolveIssue(issueId: string, status: "accepted" | "ignored" | "fixed") {
  const { company, supabase, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const { error } = await supabase.from("cleaning_issues").update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", issueId).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cleaning");
}

export async function resolveDuplicate(candidateId: string, resolution: "merge" | "keep_both" | "replace" | "ignore") {
  const { company, supabase, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const { error } = await supabase.from("cleaning_duplicate_candidates").update({ resolution, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", candidateId).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cleaning");
}

export async function approveCleaningJob(jobId: string) {
  const { company, supabase, user } = await getActiveCompany();
  if (!company) throw new Error("Company required");
  const companyId = String(company.id);
  const [{ data: openIssues }, { data: unresolvedDuplicates }, { data: rows }, { data: duplicateCandidates }, { data: products }] = await Promise.all([
    supabase.from("cleaning_issues").select("id", { count: "exact", head: false }).eq("company_id", company.id).eq("cleaning_job_id", jobId).eq("status", "open").limit(1),
    supabase.from("cleaning_duplicate_candidates").select("id", { count: "exact", head: false }).eq("company_id", company.id).eq("cleaning_job_id", jobId).is("resolution", null).limit(1),
    supabase.from("cleaning_staged_rows").select("id,row_number,cleaned_data,is_valid,is_duplicate").eq("company_id", company.id).eq("cleaning_job_id", jobId).eq("is_valid", true).limit(25000),
    supabase.from("cleaning_duplicate_candidates").select("staged_row_id,resolution").eq("company_id", company.id).eq("cleaning_job_id", jobId),
    supabase.from("products").select("sku").eq("company_id", company.id).limit(25000),
  ]);
  if (openIssues?.length) throw new Error("Resolve all open validation issues before approval");
  if (unresolvedDuplicates?.length) throw new Error("Resolve all duplicate candidates before approval");
  const resolutions = new Map((duplicateCandidates ?? []).map((candidate) => [candidate.staged_row_id, candidate.resolution]));
  const reservedSkus = new Set((products ?? []).map((product) => String(product.sku ?? "").trim().toLowerCase()).filter(Boolean));
  const uniqueSku = (baseSku: string, rowNumber: number) => {
    const base = baseSku.trim();
    let candidate = `${base}-COPY-${rowNumber}`;
    let suffix = 2;
    while (reservedSkus.has(candidate.toLowerCase())) {
      candidate = `${base}-COPY-${rowNumber}-${suffix}`;
      suffix += 1;
    }
    reservedSkus.add(candidate.toLowerCase());
    return candidate;
  };
  const approvedRows: Record<string, unknown>[] = [];
  for (const row of rows ?? []) {
    const cleaned = { ...(row.cleaned_data as Record<string, unknown>) };
    if (row.is_duplicate) {
      const resolution = resolutions.get(row.id);
      if (!resolution) throw new Error(`Duplicate row ${row.row_number} is missing a resolution`);
      if (resolution === "ignore") continue;
      if (resolution === "keep_both") {
        const sku = String(cleaned.sku ?? "").trim();
        if (!sku) throw new Error(`Duplicate row ${row.row_number} needs a SKU before it can be kept`);
        cleaned.sku = uniqueSku(sku, Number(row.row_number ?? approvedRows.length + 1));
      }
    } else {
      const sku = String(cleaned.sku ?? "").trim();
      if (sku) reservedSkus.add(sku.toLowerCase());
    }
    approvedRows.push({
      ...cleaned,
      company_id: companyId,
      created_by: user.id,
      raw_data: {},
      normalized_data: cleaned,
    });
  }
  if (!approvedRows.length) throw new Error("No valid rows are ready for approval");
  for (let index = 0; index < approvedRows.length; index += 500) {
    const { error } = await supabase.from("products").upsert(approvedRows.slice(index, index + 500), { onConflict: "company_id,sku" });
    if (error) throw new Error(error.message);
  }
  await supabase.from("cleaning_staged_rows").update({ approved: true }).eq("company_id", company.id).eq("cleaning_job_id", jobId).eq("is_valid", true);
  const { error } = await supabase.from("cleaning_jobs").update({ status: "approved", completed_at: new Date().toISOString() }).eq("id", jobId).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/cleaning");
  revalidatePath("/dashboard/products");
}
