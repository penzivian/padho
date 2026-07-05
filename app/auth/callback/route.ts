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

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}

function redirectWithError(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(message)}`, origin));
}
