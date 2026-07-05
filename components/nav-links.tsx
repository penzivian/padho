"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => {
        const isDashboard = link.href === "/teacher" || link.href === "/student";
        const active = isDashboard ? pathname === link.href : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 transition-colors",
              active ? "bg-secondary font-medium text-secondary-foreground" : "hover:bg-muted"
            )}
            href={link.href}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
