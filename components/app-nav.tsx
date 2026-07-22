import { type ReactNode, Suspense } from "react";

import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { BottomNav } from "@/components/bottom-nav";
import { NavLinks } from "@/components/nav-links";
import { NavTeacherBadge } from "@/components/nav-teacher-badge";
import { STUDENT_NAV, TEACHER_NAV } from "@/components/nav-config";
import { ProfileCredits } from "@/components/profile-credits";
import { ProfileMenu } from "@/components/profile-menu";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentProfile } from "@/lib/auth";

export async function AppNav() {
  const session = await getCurrentProfile();
  if (!session?.user) return null;

  const { user, profile } = session;

  // Build the nav shell synchronously from the shared nav-config; the teacher
  // badge + AI-credits meter stream via <Suspense> so the shell paints without
  // waiting on count queries. Icons are dropped here (top nav is labels only)
  // and stay client-side in BottomNav to avoid crossing the RSC boundary.
  let links: { href: string; label: string; badgeSlot?: ReactNode }[] = [];
  let creditsSlot: ReactNode = null;
  if (profile?.role === "teacher") {
    links = TEACHER_NAV.map((item) => ({
      href: item.href,
      label: item.label,
      badgeSlot:
        item.href === "/teacher/tests" ? (
          <Suspense fallback={null}>
            <NavTeacherBadge teacherId={user.id} />
          </Suspense>
        ) : undefined
    }));
    creditsSlot = (
      <Suspense fallback={<div className="skeleton mt-3 h-16 rounded-lg" />}>
        <ProfileCredits teacherId={user.id} />
      </Suspense>
    );
  } else if (profile) {
    links = STUDENT_NAV.map((item) => ({ href: item.href, label: item.label }));
  }

  return (
    <>
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
            {/* Desktop link row — hidden on mobile where BottomNav takes over. */}
            <div className="no-scrollbar hidden min-w-0 items-center gap-1 overflow-x-auto text-sm md:flex">
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

      {profile ? <BottomNav role={profile.role} /> : null}
    </>
  );
}
