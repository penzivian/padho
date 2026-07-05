"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { signOutAction } from "@/app/actions";

type ProfileMenuProps = {
  fullName: string;
  role: "teacher" | "student";
  contact: string;
};

export function ProfileMenu({ fullName, role, contact }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  const initials =
    fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "U";

  return (
    <div ref={containerRef} className="relative">
      <button
        aria-expanded={open}
        aria-label="Open profile menu"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-offset-2 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        {initials}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-lg border bg-card p-3 shadow-lg">
          <p className="truncate font-serif text-base font-semibold">{fullName}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5 font-medium capitalize text-secondary-foreground">
              {role}
            </span>
            <span className="truncate">{contact}</span>
          </p>

          <div className="mt-3 grid gap-1 border-t pt-2 text-sm">
            <Link
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              href="/profile"
              onClick={() => setOpen(false)}
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              My profile
            </Link>
            <form action={signOutAction}>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                type="submit"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
