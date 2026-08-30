import Link from "next/link";

import { Button } from "@/components/ui/button";

// Legal pages sit outside the app shell, like the landing page, so they carry their own header
// and footer. Narrow measure — these are read, not scanned.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-serif text-base font-semibold text-primary-foreground">
              प
            </span>
            <span className="font-serif text-lg font-bold">Padho.</span>
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </header>

      {/* prose-ish by hand: the project has no typography plugin, and one page of rules is
          cheaper than a dependency. */}
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_li]:leading-relaxed [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_ul]:mt-4 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:text-muted-foreground">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
        <nav className="flex flex-wrap gap-x-5 gap-y-2 border-t pt-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/refund" className="hover:text-foreground">Refunds</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
