"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Download, Filter, Search, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { deleteProducts, importProductsCsv, saveProductView, updateProductCell } from "@/app/dashboard/products/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = {
  id: string; sku: string; name: string; category: string | null; brand: string | null;
  price: number | null; cost: number | null; currency: string; stock_quantity: number | null;
  unit: string | null; quality_score: number | null; status: "active" | "draft" | "archived";
  updated_at: string;
};

type SavedView = { id: string; name: string; filters: Record<string, string>; sorting: Array<{column:string;direction:"asc"|"desc"}>; visible_columns: string[] };

const columns = [
  ["sku", "SKU"], ["name", "Product"], ["category", "Category"], ["brand", "Brand"],
  ["price", "Price"], ["cost", "Cost"], ["currency", "Currency"], ["stock_quantity", "Stock"],
  ["unit", "Unit"], ["quality_score", "Quality"], ["status", "Status"],
] as const;

export function ProductWorkspace({ initialProducts, companyId, savedViews }: { initialProducts: Product[]; companyId: string; savedViews: SavedView[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<{column:keyof Product;direction:"asc"|"desc"}>({ column: "updated_at", direction: "desc" });
  const [selected, setSelected] = useState<string[]>([]);
  const [visible, setVisible] = useState<string[]>(columns.map(([key]) => key));
  const [showColumns, setShowColumns] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`products:${companyId}`).on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `company_id=eq.${companyId}` }, (payload) => {
      if (payload.eventType === "INSERT") setProducts((items) => [payload.new as Product, ...items.filter((p) => p.id !== payload.new.id)]);
      if (payload.eventType === "UPDATE") setProducts((items) => items.map((p) => p.id === payload.new.id ? payload.new as Product : p));
      if (payload.eventType === "DELETE") setProducts((items) => items.filter((p) => p.id !== payload.old.id));
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [companyId]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort(), [products]);
  const filtered = useMemo(() => products.filter((p) => {
    const haystack = `${p.sku} ${p.name} ${p.category ?? ""} ${p.brand ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (status === "all" || p.status === status) && (category === "all" || p.category === category);
  }).sort((a, b) => {
    const av = a[sort.column] ?? ""; const bv = b[sort.column] ?? "";
    const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sort.direction === "asc" ? result : -result;
  }), [products, query, status, category, sort]);

  function edit(id: string, column: string, raw: string) {
    const previous = products;
    setProducts((items) => items.map((p) => p.id === id ? { ...p, [column]: raw } as Product : p));
    startTransition(async () => {
      try { await updateProductCell({ id, column, value: raw }); }
      catch (error) { setProducts(previous); setMessage(error instanceof Error ? error.message : "Update failed"); }
    });
  }

  function exportCsv() {
    const headers = columns.filter(([key]) => visible.includes(key));
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.map(([, label]) => escape(label)).join(","), ...filtered.map((p) => headers.map(([key]) => escape(p[key])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "maas-products.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="relative min-w-64 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input className="pl-9" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search products, SKUs, categories..."/></div>
      <select className="h-10 rounded-xl border bg-transparent px-3 text-sm dark:border-slate-700" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">All statuses</option><option>active</option><option>draft</option><option>archived</option></select>
      <select className="h-10 rounded-xl border bg-transparent px-3 text-sm dark:border-slate-700" value={category} onChange={(e)=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map((value)=><option key={value}>{value}</option>)}</select>
      <div className="relative"><Button variant="secondary" onClick={()=>setShowColumns(!showColumns)}><SlidersHorizontal className="mr-2 h-4 w-4"/>Columns</Button>{showColumns&&<div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">{columns.map(([key,label])=><label className="flex items-center gap-2 py-1 text-sm" key={key}><input type="checkbox" checked={visible.includes(key)} onChange={(e)=>setVisible((items)=>e.target.checked?[...items,key]:items.filter((item)=>item!==key))}/>{label}</label>)}</div>}</div>
      <Button variant="secondary" onClick={exportCsv}><Download className="mr-2 h-4 w-4"/>Export</Button>
      <form action={(formData)=>startTransition(async()=>{try{const result=await importProductsCsv(formData);setMessage(`Imported ${result.upserted} rows; ${result.failed} failed.`);}catch(error){setMessage(error instanceof Error?error.message:"Import failed");}})}>
        <label className="inline-flex h-10 cursor-pointer items-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white dark:bg-white dark:text-slate-900"><Upload className="mr-2 h-4 w-4"/>Import CSV<input className="hidden" type="file" name="file" accept=".csv,text/csv" onChange={(e)=>e.currentTarget.form?.requestSubmit()}/></label>
      </form>
      {selected.length>0&&<Button variant="secondary" onClick={()=>startTransition(async()=>{await deleteProducts(selected);setSelected([]);})}><Trash2 className="mr-2 h-4 w-4"/>Delete {selected.length}</Button>}
    </div>

    {savedViews.length>0&&<div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-500">Saved views:</span>{savedViews.map((view)=><button key={view.id} className="rounded-full border px-3 py-1 dark:border-slate-700" onClick={()=>{setQuery(view.filters?.query??"");setStatus(view.filters?.status??"all");setCategory(view.filters?.category??"all");setVisible(view.visible_columns);if(view.sorting?.[0])setSort(view.sorting[0] as typeof sort);}}>{view.name}</button>)}<button className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800" onClick={()=>{const name=prompt("View name");if(name)startTransition(async()=>{await saveProductView({name,filters:{query,status,category},sorting:[sort],visibleColumns:visible});setMessage("View saved");});}}>+ Save current view</button></div>}

    {message&&<div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">{message}<button className="float-right" onClick={()=>setMessage("")}>×</button></div>}

    <div className="overflow-hidden rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900"><tr><th className="px-3 py-3"><input type="checkbox" checked={filtered.length>0&&selected.length===filtered.length} onChange={(e)=>setSelected(e.target.checked?filtered.map((p)=>p.id):[])}/></th>{columns.filter(([key])=>visible.includes(key)).map(([key,label])=><th className="cursor-pointer whitespace-nowrap px-3 py-3" key={key} onClick={()=>setSort({column:key,direction:sort.column===key&&sort.direction==="asc"?"desc":"asc"})}>{label}{sort.column===key?(sort.direction==="asc"?" ↑":" ↓"):""}</th>)}</tr></thead><tbody className="divide-y dark:divide-slate-800">{filtered.map((product)=><tr key={product.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/70"><td className="px-3 py-2"><input type="checkbox" checked={selected.includes(product.id)} onChange={(e)=>setSelected((ids)=>e.target.checked?[...ids,product.id]:ids.filter((id)=>id!==product.id))}/></td>{columns.filter(([key])=>visible.includes(key)).map(([key])=><td className="min-w-32 px-1 py-1" key={key}>{key==="status"?<select className="w-full rounded-lg bg-transparent px-2 py-2" value={product.status} onChange={(e)=>edit(product.id,key,e.target.value)}><option>active</option><option>draft</option><option>archived</option></select>:<input className="w-full rounded-lg bg-transparent px-2 py-2 outline-none focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 dark:focus:bg-blue-950" defaultValue={String(product[key]??"")} onBlur={(e)=>{if(e.target.value!==String(product[key]??""))edit(product.id,key,e.target.value)}}/>}</td>)}</tr>)}</tbody></table></div>
      {!filtered.length&&<div className="p-12 text-center text-sm text-slate-500"><Filter className="mx-auto mb-3 h-6 w-6"/>No products match the current view.</div>}
      <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-slate-500 dark:border-slate-800"><span>{filtered.length} of {products.length} records</span><span>{pending?"Saving changes…":"All changes saved"}</span></div>
    </div>
  </div>;
}
