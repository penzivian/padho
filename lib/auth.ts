import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Row } from "@/types/database";

export async function getCurrentProfile() {
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
}

export async function requireProfile(role?: Row<"profiles">["role"]) {
  const session = await getCurrentProfile();

  if (!session?.user) redirect("/auth");
  if (!session.profile) redirect("/onboarding");
  if (role && session.profile.role !== role) redirect(`/${session.profile.role}`);

  return { user: session.user, profile: session.profile };
}
