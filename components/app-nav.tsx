import { type ReactNode, Suspense } from "react";

import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { NavTeacherBadge } from "@/components/nav-teacher-badge";
import { ProfileCredits } from "@/components/profile-credits";
import { ProfileMenu } from "@/components/profile-menu";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentProfile } from "@/lib/auth";

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

  // Build the nav shell synchronously; the teacher badge + AI-credits meter are
  // streamed via <Suspense> so the shell paints without waiting on count queries.
  let links: { href: string; label: string; badgeSlot?: ReactNode }[] = [];
  let creditsSlot: ReactNode = null;
  if (profile?.role === "teacher") {
    links = [
      { href: "/teacher", label: "Dashboard" },
      { href: "/teacher/batches", label: "Batches" },
      { href: "/teacher/papers", label: "Papers" },
      {
        href: "/teacher/tests",
        label: "Tests",
        badgeSlot: (
          <Suspense fallback={null}>
            <NavTeacherBadge teacherId={user.id} />
          </Suspense>
        )
      }
    ];
    creditsSlot = (
      <Suspense fallback={<div className="skeleton mt-3 h-16 rounded-lg" />}>
        <ProfileCredits teacherId={user.id} />
      </Suspense>
    );
  } else if (profile) {
    links = STUDENT_LINKS;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card sm:bg-card/90 sm:backdrop-blur">
      <nav className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link className="flex shrink-0 items-center gap-2" href="/">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-lg font-semibold text-primary-foreground">
              प
            </span>
            <span className="font-serif text-xl font-bold text-primary">Padho.</span>
          </Link>
          <span className="hidden shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-xs text-muted-foreground md:inline">
            Agartala · Phase 0
          </span>
          <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
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
              creditsSlot={creditsSlot}
              fullName={profile.full_name}
              role={profile.role}
              contact={user.email ?? profile.phone ?? ""}
            />
          </div>
        ) : (
          <form action={signOutAction}>
            <SubmitButton pendingText="Signing out" size="sm" variant="ghost">
              Sign out
            </SubmitButton>
          </form>
        )}
      </nav>
    </header>
  );
}
