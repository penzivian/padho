"use client";

import { useTransition } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; badge?: number };

export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <>
      {pending ? <span aria-hidden="true" className="nav-progress" /> : null}
      {links.map((link) => {
        const isDashboard = link.href === "/teacher" || link.href === "/student";
        const active = isDashboard ? pathname === link.href : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 transition-colors",
              active ? "bg-secondary font-medium text-secondary-foreground" : "hover:bg-muted"
            )}
            href={link.href}
            onClick={(event) => {
              // Route through a transition so the top progress bar shows while
              // the server component streams. Let modified clicks (new tab etc.)
              // fall through to the browser.
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              startTransition(() => router.push(link.href));
            }}
          >
            {link.label}
            {link.badge ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
                {link.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
