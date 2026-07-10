export function cn(...values: Array<string | false | null | undefined>) { return values.filter(Boolean).join(" "); }
export function formatNumber(value: number | null | undefined) { return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value ?? 0); }
export function formatCurrency(value: number | null | undefined, currency = "USD") { return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(value ?? 0); }
export function initials(value:string){ return value.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]?.toUpperCase()).join("") || "M"; }
