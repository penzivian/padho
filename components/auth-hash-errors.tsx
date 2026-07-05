"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Supabase reports failed email-link verifications (expired/used tokens) in the URL
// fragment, which the server never sees. Surface them through the existing ?error= banner.
export function AuthHashErrors() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const description = params.get("error_description") ?? params.get("error");
    if (description) {
      router.replace(`/auth?error=${encodeURIComponent(description)}`);
    }
  }, [router]);

  return null;
}
