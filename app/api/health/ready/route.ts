import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function GET(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) return NextResponse.json({status:"not_ready",reason:"missing_configuration"},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {error}=await db.from("companies").select("id",{head:true,count:"exact"}).limit(1);
 return error?NextResponse.json({status:"not_ready",reason:"database"},{status:503}):NextResponse.json({status:"ready",time:new Date().toISOString()});
}
