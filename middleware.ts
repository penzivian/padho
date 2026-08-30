import { type NextRequest, NextResponse } from "next/server";
import { type CookieOptions, createServerClient } from "@supabase/ssr";

import { requiredEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Session refresh only — NOT authorization. `requireProfile` remains the
 * authority for who may see what. Server components can't write cookies, so
 * without this the access token is never refreshed and users get bounced to
 * /auth mid-session when it expires. Here we bind a Supabase client to the
 * request/response cookie pair and call getUser(), which rotates the token and
 * writes the refreshed cookies onto the response.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // The site root is a static marketing page now, so the two things it used to do at request
  // time happen here instead. A page that reads searchParams is dynamic by definition, which is
  // what kept `/` out of the static build.
  if (request.nextUrl.pathname === "/") {
    const params = request.nextUrl.searchParams;

    // Supabase's redirect fallback can land auth credentials on the root. Forward them to the
    // callback route, which is the only place that can set session cookies. This must run
    // BEFORE the signed-in check: someone arriving with a code is not signed in yet.
    const failure = params.get("error_description") ?? params.get("error");
    if (failure) {
      return withCookies(new URL(`/auth?error=${encodeURIComponent(failure)}`, request.url), response);
    }

    const code = params.get("code");
    if (code) {
      return withCookies(
        new URL(`/auth/callback?code=${encodeURIComponent(code)}`, request.url),
        response
      );
    }

    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    if (tokenHash && type) {
      return withCookies(
        new URL(
          `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`,
          request.url
        ),
        response
      );
    }

    // A signed-in visitor gets their dashboard rather than the marketing page.
    //
    // Wrapped because this is the one query in the request path with nothing behind it: an
    // unhandled rejection here would 500 the homepage for everyone signed in. Falling through
    // serves them the landing page instead, which is a wrong-but-harmless outcome they can
    // click past — and every route they actually want still gates itself with requireProfile.
    if (user) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        return withCookies(
          new URL(profile ? `/${profile.role}` : "/onboarding", request.url),
          response
        );
      } catch {
        return response;
      }
    }
  }

  return response;
}

// NextResponse.redirect() builds a FRESH response, which would drop the refreshed session
// cookies getUser() just wrote onto `response` — silently logging the user out on exactly the
// requests that redirect. Carry them across.
function withCookies(url: URL, from: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export const config = {
  // Run on app routes only — skip static assets, images, icons and the manifest.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
