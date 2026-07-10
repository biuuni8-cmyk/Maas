export type CleaningJobStatus = "draft" | "mapped" | "processing" | "review" | "approved" | "failed";
export type CleaningIssueSeverity = "info" | "warning" | "error";
export type CleaningIssueStatus = "open" | "accepted" | "ignored" | "fixed";
export type CleaningRuleType =
  | "trim"
  | "remove_extra_spaces"
  | "uppercase"
  | "lowercase"
  | "titlecase"
  | "normalize_sku"
  | "normalize_barcode"
  | "coerce_number"
  | "default_value";

export type FieldMapping = Record<string, string>;

export interface CleaningJob {
  id: string;
  company_id: string;
  created_by: string;
  name: string;
  source_filename: string;
  status: CleaningJobStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  field_mapping: FieldMapping;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CleaningRule {
  id: string;
  company_id: string;
  name: string;
  field: string;
  rule_type: CleaningRuleType;
  configuration: Record<string, unknown>;
  priority: number;
  enabled: boolean;
}

export interface StagedRow {
  id: string;
  cleaning_job_id: string;
  row_number: number;
  raw_data: Record<string, unknown>;
  mapped_data: Record<string, unknown>;
  cleaned_data: Record<string, unknown>;
  validation_errors: string[];
  is_valid: boolean;
  is_duplicate: boolean;
  approved: boolean;
}

export interface CleaningIssue {
  id: string;
  cleaning_job_id: string;
  staged_row_id: string | null;
  severity: CleaningIssueSeverity;
  status: CleaningIssueStatus;
  issue_type: string;
  field: string | null;
  message: string;
  raw_value: unknown;
  suggested_value: unknown;
  created_at: string;
}
