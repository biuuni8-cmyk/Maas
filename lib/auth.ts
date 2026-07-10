import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export async function requireUser(){ const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login"); return {user,supabase}; }
export async function getActiveCompany(){
 const {user,supabase}=await requireUser();
 const {data}=await supabase.from("company_members").select("role, companies(*)").eq("user_id",user.id).order("created_at").limit(1).maybeSingle();
 return {user,supabase,membership:data,company:(data?.companies as unknown as Record<string,unknown>|null) ?? null};
}
