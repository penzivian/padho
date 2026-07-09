import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { ProfileMenu } from "@/components/profile-menu";
import { getCurrentProfile } from "@/lib/auth";
import { optionalEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const STUDENT_LINKS = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/tests", label: "Tests" },
  { href: "/student/practice", label: "Practice" },
  { href: "/student/doubts", label: "Doubts" }
];

export async function AppNav() {
  const session = await getCurrentProfile();
  if (!session?.user) return null;

  const { user, profile } = session;

  let links: { href: string; label: string; badge?: number }[] = [];
  let aiCredits: { used: number; limit: number } | null = null;
  if (profile?.role === "teacher") {
    const supabase = createSupabaseServerClient();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [{ count: toGrade }, { count: aiUsed }] = await Promise.all([
      supabase.from("test_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("ai_usage_events")
        .select("id", { count: "exact", head: true })
        .eq("owner_teacher_id", user.id)
        .gte("created_at", monthStart.toISOString())
    ]);
    links = [
      { href: "/teacher", label: "Dashboard" },
      { href: "/teacher/batches", label: "Batches" },
      { href: "/teacher/papers", label: "Papers" },
      { href: "/teacher/tests", label: "Tests", badge: toGrade ?? 0 }
    ];
    aiCredits = { used: aiUsed ?? 0, limit: Number(optionalEnv("AI_MONTHLY_TEACHER_LIMIT", "200")) };
  } else if (profile) {
    links = STUDENT_LINKS;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <nav className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link className="flex items-center gap-2" href="/">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground">
              प
            </span>
            <span className="font-serif text-xl font-bold text-primary">Padho.</span>
          </Link>
          <span className="hidden rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground md:inline">
            Agartala · Phase 0
          </span>
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto text-sm">
            <NavLinks links={links} />
          </div>
        </div>

        {profile ? (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{profile.full_name}</p>
              <p className="text-xs capitalize text-muted-foreground">{profile.role} · Padho</p>
            </div>
            <ProfileMenu
              aiCredits={aiCredits}
              fullName={profile.full_name}
              role={profile.role}
              contact={user.email ?? profile.phone ?? ""}
            />
          </div>
        ) : (
          <form action={signOutAction}>
            <button className="rounded-md px-3 py-1.5 text-sm hover:bg-muted" type="submit">
              Sign out
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}
