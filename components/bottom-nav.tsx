"use client";

import { useTransition } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { STUDENT_NAV, TEACHER_NAV } from "@/components/nav-config";
import { cn } from "@/lib/utils";

// Fixed bottom tab bar for phones (md:hidden); the top nav's link row is hidden
// below md so the two never show at once. Hidden on the immersive test/practice
// screens, which own the bottom edge with their sticky CTA.
const HIDE_ON = /^\/(student|teacher)\/(tests|practice)\/[^/]+/;

export function BottomNav({ role }: { role: "teacher" | "student" }) {
  const items = role === "teacher" ? TEACHER_NAV : STUDENT_NAV;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (HIDE_ON.test(pathname)) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {pending ? <span aria-hidden="true" className="nav-progress" /> : null}
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const isHome = item.href === "/teacher" || item.href === "/student";
          const active = isHome ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
              href={item.href}
              onClick={(event) => {
                // Route through a transition so the top nav-progress bar still fires.
                // Let modified clicks (new tab etc.) fall through to the browser.
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                startTransition(() => router.push(item.href));
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="leading-none">{item.shortLabel ?? item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
