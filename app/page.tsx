import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";

type HomePageProps = {
  searchParams?: {
    code?: string;
    token_hash?: string;
    type?: string;
    error?: string;
    error_description?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  // Auth redirects (email link or OAuth) can land on the site root (Supabase's redirect
  // fallback); forward their credentials to the callback route, which can set session
  // cookies, and surface provider errors on the sign-in screen.
  if (searchParams?.error || searchParams?.error_description) {
    redirect(
      `/auth?error=${encodeURIComponent(searchParams.error_description ?? searchParams.error ?? "Sign-in failed")}`
    );
  }
  if (searchParams?.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}`);
  }
  if (searchParams?.token_hash && searchParams?.type) {
    redirect(
      `/auth/callback?token_hash=${encodeURIComponent(searchParams.token_hash)}&type=${encodeURIComponent(searchParams.type)}`
    );
  }

  const session = await getCurrentProfile();

  if (!session?.user) redirect("/auth");
  if (!session.profile) redirect("/onboarding");

  redirect(`/${session.profile.role}`);
}
