export type CompanyRole = "owner" | "admin" | "analyst" | "viewer";
export type CompanyStatus = "active" | "inactive" | "suspended";
export type AuditPeriod = "daily" | "weekly" | "monthly" | "3_months" | "6_months" | "9_months" | "12_months" | "yearly";

export interface Company { id:string; owner_id:string; name:string; slug:string; industry:string|null; status:CompanyStatus; timezone:string; created_at:string; updated_at:string; }
export interface CompanyMembership { company_id:string; user_id:string; role:CompanyRole; created_at:string; }
export interface Product { id:string; company_id:string; sku:string; name:string; category:string|null; price:number|null; currency:string; quality_score:number|null; status:string; raw_data:Record<string,unknown>; normalized_data:Record<string,unknown>; created_at:string; updated_at:string; }
