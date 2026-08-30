import Link from "next/link";

import { Button } from "@/components/ui/button";

// Shared shell for the pages that appear when something has gone wrong or a route does not
// exist. These render OUTSIDE the app shell (not-found and error boundaries sit at the root),
// so they carry their own brand mark rather than relying on AppNav.
export function MessagePage({
  eyebrow,
  title,
  children,
  action
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary font-serif text-lg font-semibold text-primary-foreground">
            प
          </span>
          <span className="font-serif text-xl font-bold">Padho.</span>
        </Link>

        <p className="mt-10 font-mono text-xs font-medium uppercase tracking-[0.18em] text-[#c98a3c]">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-balance font-serif text-3xl font-semibold">{title}</h1>
        <div className="mt-4 text-muted-foreground">{children}</div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {action}
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
