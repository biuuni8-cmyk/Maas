import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabasePublicConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items: { name: string; value: string; options?: Record<string, unknown> }[]) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
    }
  });
}
