"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
type Row = Record<string, unknown>;
export function RealtimeTable({ table, columns }: { table: string; columns: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
      if (error) setError(error.message); else setRows(data ?? []);
    };
    load();
    const channel = supabase.channel(`realtime:${table}`).on("postgres_changes", { event: "*", schema: "public", table }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [table]);
  if (error) return <div className="rounded-xl border border-red-300 p-4 text-red-600">{error}</div>;
  return <div className="overflow-x-auto rounded-2xl border bg-white dark:bg-slate-950"><table className="w-full text-sm"><thead><tr>{columns.map(c => <th key={c} className="border-b px-4 py-3 text-left capitalize">{c.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-500">No records yet.</td></tr> : rows.map((row, i) => <tr key={String(row.id ?? i)}>{columns.map(c => <td key={c} className="border-b px-4 py-3">{String(row[c] ?? "")}</td>)}</tr>)}</tbody></table></div>;
}
