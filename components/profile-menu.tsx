"use client";

import Link from "next/link";
import { Loader2, LogOut, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { signOutAction } from "@/app/actions";

type ProfileMenuProps = {
  fullName: string;
  role: "teacher" | "student";
  contact: string;
  aiCredits?: { used: number; limit: number } | null;
};

export function ProfileMenu({ fullName, role, contact, aiCredits = null }: ProfileMenuProps) {
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

          {aiCredits ? (
            <div className="mt-3 rounded-lg border bg-secondary/40 p-2.5">
              <p className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  AI credits
                </span>
                <span className="font-mono text-muted-foreground">
                  {Math.max(0, aiCredits.limit - aiCredits.used)}/{aiCredits.limit}
                </span>
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${Math.min(100, Math.max(0, ((aiCredits.limit - aiCredits.used) / aiCredits.limit) * 100))}%`
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">left this month</p>
            </div>
          ) : null}

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
              <SignOutItem />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SignOutItem() {
  const { pending } = useFormStatus();

  return (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden="true" />
      )}
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}
