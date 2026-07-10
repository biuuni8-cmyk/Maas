import type { CleaningRule, FieldMapping } from "@/lib/cleaning/types";

const PRODUCT_FIELDS = new Set([
  "sku", "name", "category", "brand", "description", "barcode", "price", "cost",
  "currency", "stock_quantity", "unit", "quality_score", "status", "tags",
]);

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) matrix.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) matrix.push(row);
  if (!matrix.length) return { headers: [], rows: [] };

  const headers = matrix[0].map((header) => header.trim());
  const rows = matrix.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])));
  return { headers, rows };
}

export function suggestFieldMapping(headers: string[]): FieldMapping {
  const aliases: Record<string, string[]> = {
    sku: ["sku", "item code", "product code", "stock code", "code"],
    name: ["name", "product", "product name", "item", "item name", "title"],
    category: ["category", "product category", "group", "department"],
    brand: ["brand", "manufacturer", "maker"],
    description: ["description", "details", "product description"],
    barcode: ["barcode", "ean", "upc", "gtin"],
    price: ["price", "selling price", "sale price", "retail price"],
    cost: ["cost", "cost price", "purchase price"],
    currency: ["currency", "currency code"],
    stock_quantity: ["stock", "quantity", "qty", "inventory", "stock quantity"],
    unit: ["unit", "uom", "unit of measure"],
    quality_score: ["quality", "quality score", "score"],
    status: ["status", "product status"],
    tags: ["tags", "labels", "keywords"],
  };

  const mapping: FieldMapping = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replaceAll("_", " ");
    const target = Object.entries(aliases).find(([, values]) => values.includes(normalized))?.[0];
    if (target) mapping[header] = target;
  }
  return mapping;
}

export function applyMapping(raw: Record<string, unknown>, mapping: FieldMapping): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [source, target] of Object.entries(mapping)) {
    if (PRODUCT_FIELDS.has(target)) mapped[target] = raw[source];
  }
  return mapped;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function applyRule(value: unknown, rule: Pick<CleaningRule, "rule_type" | "configuration">): unknown {
  if (value === null || value === undefined) return rule.rule_type === "default_value" ? rule.configuration.value ?? null : value;
  const text = String(value);
  switch (rule.rule_type) {
    case "trim": return text.trim();
    case "remove_extra_spaces": return text.replace(/\s+/g, " ").trim();
    case "uppercase": return text.toUpperCase();
    case "lowercase": return text.toLowerCase();
    case "titlecase": return titleCase(text);
    case "normalize_sku": return text.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    case "normalize_barcode": return text.replace(/\D/g, "");
    case "coerce_number": {
      const number = Number(text.replaceAll(",", "").trim());
      return Number.isFinite(number) ? number : value;
    }
    case "default_value": return text.trim() === "" ? rule.configuration.value ?? null : value;
    default: return value;
  }
}

export function cleanMappedRow(mapped: Record<string, unknown>, rules: CleaningRule[]): Record<string, unknown> {
  const output = { ...mapped };
  const enabled = rules.filter((rule) => rule.enabled).sort((a, b) => a.priority - b.priority);
  for (const rule of enabled) output[rule.field] = applyRule(output[rule.field], rule);
  if (typeof output.currency === "string") output.currency = output.currency.toUpperCase().slice(0, 3);
  if (!output.currency) output.currency = "USD";
  if (!output.status) output.status = "active";
  if (typeof output.tags === "string") output.tags = output.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
  return output;
}

export function validateProductRow(row: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!String(row.sku ?? "").trim()) errors.push("SKU is required");
  if (String(row.name ?? "").trim().length < 2) errors.push("Product name must contain at least two characters");
  for (const field of ["price", "cost", "stock_quantity", "quality_score"]) {
    const value = row[field];
    if (value !== undefined && value !== null && value !== "" && !Number.isFinite(Number(value))) errors.push(`${field} must be numeric`);
  }
  if (row.price !== undefined && Number(row.price) < 0) errors.push("price cannot be negative");
  if (row.cost !== undefined && Number(row.cost) < 0) errors.push("cost cannot be negative");
  if (row.quality_score !== undefined && row.quality_score !== null && (Number(row.quality_score) < 0 || Number(row.quality_score) > 100)) errors.push("quality_score must be between 0 and 100");
  if (row.currency && String(row.currency).length !== 3) errors.push("currency must be a 3-letter code");
  if (row.status && !["active", "draft", "archived"].includes(String(row.status))) errors.push("status must be active, draft, or archived");
  return errors;
}

export function duplicateKey(row: Record<string, unknown>) {
  const sku = String(row.sku ?? "").trim().toLowerCase();
  const barcode = String(row.barcode ?? "").replace(/\D/g, "");
  const name = String(row.name ?? "").trim().toLowerCase();
  const brand = String(row.brand ?? "").trim().toLowerCase();
  return { sku, barcode, nameBrand: `${name}|${brand}` };
}
