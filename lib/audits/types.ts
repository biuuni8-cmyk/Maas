export const AUDIT_PERIODS = [
  "daily", "weekly", "monthly", "3_months", "6_months", "9_months", "12_months", "yearly",
] as const;

export type AuditPeriod = (typeof AUDIT_PERIODS)[number];
export type AuditStatus = "pending" | "running" | "passed" | "failed";
export type AuditSeverity = "info" | "warning" | "critical";

export type AuditMetricSnapshot = {
  productCount: number;
  activeProducts: number;
  draftProducts: number;
  archivedProducts: number;
  missingSku: number;
  missingName: number;
  missingPrice: number;
  missingCategory: number;
  duplicateSkus: number;
  lowQualityProducts: number;
  averageQuality: number;
  totalInventoryValue: number;
};

export type AuditComparison = {
  productCountDelta: number;
  averageQualityDelta: number;
  issueDelta: number;
  inventoryValueDelta: number;
};

export const periodLabel = (period: string) => ({
  daily: "Daily", weekly: "Weekly", monthly: "Monthly", "3_months": "3 months",
  "6_months": "6 months", "9_months": "9 months", "12_months": "12 months", yearly: "Yearly",
}[period] ?? period.replaceAll("_", " "));
