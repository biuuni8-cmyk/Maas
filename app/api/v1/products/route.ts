import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

function admin(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) throw new Error("Supabase service configuration missing");
 return createClient(url,key,{auth:{persistSession:false}});
}
export async function GET(req:NextRequest){
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token) return NextResponse.json({error:"Missing bearer token"},{status:401});
 const hash=createHash("sha256").update(token).digest("hex");
 const db=admin();
 const {data:keyRow,error}=await db.from("api_keys").select("id,company_id,scopes,revoked_at,expires_at").eq("key_hash",hash).maybeSingle();
 if(error||!keyRow||keyRow.revoked_at||(keyRow.expires_at&&new Date(keyRow.expires_at)<new Date())) return NextResponse.json({error:"Invalid API key"},{status:401});
 if(!(keyRow.scopes??[]).includes("read")) return NextResponse.json({error:"Insufficient scope"},{status:403});
 const limit=Math.min(Number(req.nextUrl.searchParams.get("limit")||50),250);
 const {data, error:productsError}=await db.from("products").select("id,sku,name,category,price,currency,status,updated_at").eq("company_id",keyRow.company_id).order("updated_at",{ascending:false}).limit(limit);
 await db.rpc("increment_api_usage",{p_company_id:keyRow.company_id});
 await db.from("api_keys").update({last_used_at:new Date().toISOString()}).eq("id",keyRow.id);
 if(productsError) return NextResponse.json({error:productsError.message},{status:500});
 return NextResponse.json({data,meta:{limit,count:data?.length??0}});
}
