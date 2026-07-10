import { getActiveCompany } from "@/lib/auth";
import { CleaningWorkspace } from "@/components/cleaning/cleaning-workspace";
import type { CleaningIssue, CleaningJob, CleaningRule, StagedRow } from "@/lib/cleaning/types";

export default async function CleaningPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { company, supabase } = await getActiveCompany();
  const requested = (await searchParams).job;
  if (!company) return <div className="rounded-2xl border p-10 text-center">Create a company before using the cleaning engine.</div>;
  const [{ data: jobs }, { data: rules }] = await Promise.all([
    supabase.from("cleaning_jobs").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("cleaning_rules").select("*").eq("company_id", company.id).order("priority").limit(100),
  ]);
  const selectedJob = ((jobs ?? []).find((job) => job.id === requested) ?? jobs?.[0] ?? null) as CleaningJob | null;
  const [{ data: rows }, { data: issues }, { data: duplicates }] = selectedJob ? await Promise.all([
    supabase.from("cleaning_staged_rows").select("*").eq("company_id", company.id).eq("cleaning_job_id", selectedJob.id).order("row_number").limit(200),
    supabase.from("cleaning_issues").select("*").eq("company_id", company.id).eq("cleaning_job_id", selectedJob.id).order("created_at").limit(500),
    supabase.from("cleaning_duplicate_candidates").select("*").eq("company_id", company.id).eq("cleaning_job_id", selectedJob.id).order("created_at").limit(500),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  return <><div className="mb-7"><h1 className="text-3xl font-bold">Data cleaning</h1><p className="mt-2 text-slate-500">Map, normalize, validate, deduplicate and approve raw data before it enters your core product dataset.</p></div><CleaningWorkspace jobs={(jobs ?? []) as CleaningJob[]} rules={(rules ?? []) as CleaningRule[]} selectedJob={selectedJob} rows={(rows ?? []) as StagedRow[]} issues={(issues ?? []) as CleaningIssue[]} duplicates={(duplicates ?? []) as never[]}/></>;
}
