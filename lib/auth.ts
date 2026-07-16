import { cache } from "react";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Row } from "@/types/database";

// Deduped per request: AppNav and the page both call this, but React `cache`
// collapses them into a single auth.getUser() + profile fetch per render.
export const getCurrentProfile = cache(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
});

export async function requireProfile(role?: Row<"profiles">["role"]) {
  const session = await getCurrentProfile();

  if (!session?.user) redirect("/auth");
  if (!session.profile) redirect("/onboarding");
  if (role && session.profile.role !== role) redirect(`/${session.profile.role}`);

  return { user: session.user, profile: session.profile };
}
