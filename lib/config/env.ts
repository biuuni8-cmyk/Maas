import { z } from "zod";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: z.string().min(20),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  CRON_SECRET: z.string().min(24).optional(),
  WEBHOOK_SIGNING_SECRET: z.string().min(24).optional(),
});

export function getPublicEnv() {
  const { url, key } = getSupabasePublicConfig();
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: key,
  });
}

export function getServerEnv() {
  const { url, key } = getSupabasePublicConfig();
  return serverSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: key,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    WEBHOOK_SIGNING_SECRET: process.env.WEBHOOK_SIGNING_SECRET,
  });
}
