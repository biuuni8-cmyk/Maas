import { createBrowserClient } from "@supabase/ssr";
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://glukocnbmxpaddwelepw.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CFreG4IaOEeu7s5yV45-Jw_T-q218An';
  if (!url || !key) throw new Error('Missing Supabase public environment variables');
  return createBrowserClient(url, key);
}
