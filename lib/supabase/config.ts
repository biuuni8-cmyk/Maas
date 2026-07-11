const fallbackSupabaseUrl = "https://glukocnbmxpaddwelepw.supabase.co";
const fallbackSupabaseKey = "sb_publishable_CFreG4IaOEeu7s5yV45-Jw_T-q218An";

function usableValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && !trimmed.includes("=") && !trimmed.toLowerCase().startsWith("your-")
    ? trimmed
    : undefined;
}

export function getSupabasePublicConfig() {
  const url = usableValue(process.env.NEXT_PUBLIC_SUPABASE_URL) || fallbackSupabaseUrl;
  const key =
    usableValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    usableValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    fallbackSupabaseKey;

  if (!url || !key) {
    throw new Error("Missing Supabase public environment variables");
  }

  return { url, key };
}
