import Link from "next/link";
import { BookOpenCheck, ClipboardList, UsersRound } from "lucide-react";

import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function TeacherHomePage() {
  const { profile } = await requireProfile("teacher");
  const supabase = createSupabaseServerClient();
  const [{ count: batchCount }, { count: paperCount }, { count: testCount }] = await Promise.all([
    supabase.from("batches").select("id", { count: "exact", head: true }),
    supabase.from("question_papers").select("id", { count: "exact", head: true }),
    supabase.from("tests").select("id", { count: "exact", head: true })
  ]);

  const firstName = profile.full_name.split(/\s+/)[0] || "teacher";

  return (
    <main className="page-shell">
      <div>
        <p className="script-note text-lg">Namaskar,</p>
        <h1 className="text-3xl font-semibold">{firstName}</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          href="/teacher/batches"
          icon={<UsersRound className="h-5 w-5" />}
          label="Batches"
          value={batchCount ?? 0}
        />
        <StatCard
          href="/teacher/papers"
          icon={<BookOpenCheck className="h-5 w-5" />}
          label="Papers"
          value={paperCount ?? 0}
        />
        <StatCard
          href="/teacher/tests"
          icon={<ClipboardList className="h-5 w-5" />}
          label="Tests"
          value={testCount ?? 0}
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickAction href="/teacher/batches" title="Create batch" hint="Invite students with a code" />
        <QuickAction href="/teacher/papers/new" title="Create paper" hint="AI draft or upload a PDF" />
        <QuickAction href="/teacher/tests" title="Schedule test" hint="From any saved paper" />
      </section>
    </main>
  );
}

function StatCard({
  href,
  icon,
  label,
  value
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Link href={href}>
      <Card className="transition hover:border-primary/40 hover:bg-secondary/30">
        <p className="font-serif text-4xl font-semibold">{value}</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-primary">{icon}</span>
          {label}
        </p>
      </Card>
    </Link>
  );
}

function QuickAction({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <Link
      className="rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:bg-secondary/30"
      href={href}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
    </Link>
  );
}
