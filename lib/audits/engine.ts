import type { AuditMetricSnapshot } from "./types";

type ProductRecord = {
  id: string;
  sku: string | null;
  name: string | null;
  category: string | null;
  price: number | string | null;
  cost?: number | string | null;
  stock_quantity?: number | string | null;
  quality_score: number | string | null;
  status: string;
};

const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function buildAuditSnapshot(products: ProductRecord[]): AuditMetricSnapshot {
  const skuCounts = new Map<string, number>();
  for (const product of products) {
    const sku = product.sku?.trim().toLowerCase();
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }

  const qualityValues = products
    .map((product) => num(product.quality_score))
    .filter((value) => value > 0);

  return {
    productCount: products.length,
    activeProducts: products.filter((p) => p.status === "active").length,
    draftProducts: products.filter((p) => p.status === "draft").length,
    archivedProducts: products.filter((p) => p.status === "archived").length,
    missingSku: products.filter((p) => !p.sku?.trim()).length,
    missingName: products.filter((p) => !p.name?.trim()).length,
    missingPrice: products.filter((p) => p.price == null || num(p.price) <= 0).length,
    missingCategory: products.filter((p) => !p.category?.trim()).length,
    duplicateSkus: [...skuCounts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0),
    lowQualityProducts: products.filter((p) => num(p.quality_score) > 0 && num(p.quality_score) < 70).length,
    averageQuality: qualityValues.length ? Math.round((qualityValues.reduce((a, b) => a + b, 0) / qualityValues.length) * 100) / 100 : 0,
    totalInventoryValue: Math.round(products.reduce((sum, p) => sum + num(p.cost ?? p.price) * num(p.stock_quantity), 0) * 100) / 100,
  };
}

export function deriveAuditIssues(snapshot: AuditMetricSnapshot) {
  const issues: Array<{severity: "info" | "warning" | "critical"; category: string; title: string; description: string; observed_value: unknown; expected_value: unknown}> = [];
  const add = (severity: "info" | "warning" | "critical", category: string, title: string, count: number, expected = 0) => {
    if (count > 0) issues.push({severity, category, title, description: `${count} record${count === 1 ? "" : "s"} require attention.`, observed_value: count, expected_value: expected});
  };
  add("critical", "completeness", "Products missing SKU", snapshot.missingSku);
  add("critical", "completeness", "Products missing a name", snapshot.missingName);
  add("warning", "commercial", "Products missing a valid price", snapshot.missingPrice);
  add("warning", "classification", "Products missing a category", snapshot.missingCategory);
  add("critical", "uniqueness", "Duplicate SKU records", snapshot.duplicateSkus);
  add("warning", "quality", "Products below quality threshold", snapshot.lowQualityProducts);
  if (snapshot.averageQuality > 0 && snapshot.averageQuality < 85) {
    issues.push({severity: "info", category: "quality", title: "Average quality below target", description: `Average quality is ${snapshot.averageQuality}%.`, observed_value: snapshot.averageQuality, expected_value: 85});
  }
  return issues;
}

export function scoreAudit(snapshot: AuditMetricSnapshot) {
  if (!snapshot.productCount) return 100;
  const severe = snapshot.missingSku + snapshot.missingName + snapshot.duplicateSkus;
  const moderate = snapshot.missingPrice + snapshot.missingCategory + snapshot.lowQualityProducts;
  return Math.max(0, Math.round((100 - ((severe * 8 + moderate * 3) / snapshot.productCount) * 100) * 100) / 100);
}
