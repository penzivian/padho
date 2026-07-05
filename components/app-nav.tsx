import Link from "next/link";

import { signOutAction } from "@/app/actions";
import { NavLinks } from "@/components/nav-links";
import { ProfileMenu } from "@/components/profile-menu";
import { getCurrentProfile } from "@/lib/auth";

const TEACHER_LINKS = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/batches", label: "Batches" },
  { href: "/teacher/papers", label: "Papers" },
  { href: "/teacher/tests", label: "Tests" }
];

const STUDENT_LINKS = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/doubts", label: "Doubts" }
];

export async function AppNav() {
  const session = await getCurrentProfile();
  if (!session?.user) return null;

  const { user, profile } = session;
  const links = profile ? (profile.role === "teacher" ? TEACHER_LINKS : STUDENT_LINKS) : [];

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
      <nav className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-5">
          <Link href="/" className="font-serif text-xl font-bold text-primary">
            Padho.
          </Link>
          <div className="flex items-center gap-1 overflow-x-auto text-sm">
            <NavLinks links={links} />
          </div>
        </div>

        {profile ? (
          <ProfileMenu
            fullName={profile.full_name}
            role={profile.role}
            contact={user.email ?? profile.phone ?? ""}
          />
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
