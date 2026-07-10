import { addProduct } from "./actions";
import { getActiveCompany } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductWorkspace } from "@/components/product-workspace";

export default async function ProductsPage() {
  const { supabase, company, user } = await getActiveCompany();
  const [{ data: products, error }, { data: savedViews }] = company ? await Promise.all([
    supabase.from("products").select("id,sku,name,category,brand,price,cost,currency,stock_quantity,unit,quality_score,status,updated_at").eq("company_id", company.id).order("updated_at", { ascending: false }).limit(5000),
    supabase.from("saved_product_views").select("id,name,filters,sorting,visible_columns").eq("company_id", company.id).eq("user_id", user.id).order("updated_at", { ascending: false }),
  ]) : [{ data: [], error: null }, { data: [] }];

  return <>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">Data workspace</h1><p className="mt-2 text-slate-500">Edit, filter, import, export and organize live product records in an Excel-like grid.</p></div></div>
    <div className="mt-7 grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>{error ? <Card className="p-6 text-red-600">{String(error.message)}</Card> : company ? <ProductWorkspace initialProducts={(products ?? []) as never[]} companyId={String(company.id)} savedViews={(savedViews ?? []) as never[]} /> : <Card className="p-10 text-center text-slate-500">Create or select a company first.</Card>}</div>
      <Card className="h-fit p-6"><h2 className="font-semibold">Add product</h2><p className="mt-1 text-sm text-slate-500">Create one record manually.</p><form action={addProduct} className="mt-5 space-y-3"><Input name="sku" required placeholder="SKU"/><Input name="name" required placeholder="Product name"/><div className="grid grid-cols-2 gap-2"><Input name="category" placeholder="Category"/><Input name="brand" placeholder="Brand"/></div><div className="grid grid-cols-2 gap-2"><Input name="price" type="number" min="0" step="0.01" placeholder="Price"/><Input name="cost" type="number" min="0" step="0.01" placeholder="Cost"/></div><div className="grid grid-cols-[1fr_90px] gap-2"><Input name="stock_quantity" type="number" step="0.001" placeholder="Stock"/><Input name="unit" placeholder="Unit"/></div><div className="grid grid-cols-[1fr_100px] gap-2"><select name="status" className="h-10 rounded-xl border bg-transparent px-3 text-sm dark:border-slate-700"><option>active</option><option>draft</option><option>archived</option></select><Input name="currency" defaultValue="USD" maxLength={3}/></div><Button className="w-full">Add product</Button></form><div className="mt-5 border-t pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800"><strong>CSV columns:</strong> sku, name, category, brand, description, barcode, price, cost, currency, stock_quantity, unit, quality_score, status. Existing SKUs are updated.</div></Card>
    </div>
  </>;
}
