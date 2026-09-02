import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Completes email-link sign-in. Supabase links land here either with a PKCE `code`
// (exchanged for a session) or a `token_hash` + `type` (verified directly).
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  // An OAuth provider that refuses — the user hit Cancel on Google's consent screen, or the
  // client credentials are wrong — redirects HERE with an error query param and no code. Email
  // links never do this (their failures arrive in the URL fragment, which /auth reads
  // client-side), so without this branch the request falls through both cases below and lands
  // silently on the marketing page, leaving the user with no idea why they are not signed in.
  const oauthError =
    requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  if (oauthError) return redirectWithError(requestUrl.origin, oauthError);

  const supabase = createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectWithError(requestUrl.origin, error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    });
    if (error) return redirectWithError(requestUrl.origin, error.message);
  }

  if (!code && !(tokenHash && type)) {
    return redirectWithError(requestUrl.origin, "That sign-in link is incomplete. Please try again.");
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}

function redirectWithError(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(message)}`, origin));
}
