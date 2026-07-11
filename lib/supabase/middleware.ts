import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabasePublicConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies: CookieToSet[]) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/onboarding");

  if (protectedRoute && !user) {
    const next = request.nextUrl.clone();
    next.pathname = "/login";
    next.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(next);
  }

  return response;
}
