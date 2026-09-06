import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { formatDateTime, timeAgo } from "@/lib/utils";

export const metadata = { title: "Feedback" };

const INTEREST_LABEL: Record<string, string> = {
  yes: "Wants early access",
  maybe: "Wants to hear more",
  not_now: "Just sharing thoughts",
  "": "Didn't say"
};

// Owner-only. `feedback` has no SELECT policy at all, so these rows are unreadable through
// the API by anyone — including a signed-in teacher. Reading them needs the admin client,
// which is only reached AFTER the PLATFORM_OWNER_EMAILS gate below. Responses carry names
// and phone numbers, so that gate is the point, not a formality.
export default async function FeedbackInboxPage() {
  const { user } = await requireProfile("teacher");

  if (!isPlatformOwner(user.email)) {
    return (
      <main className="page-shell max-w-2xl">
        <Card>
          <CardTitle>Not available</CardTitle>
          <p className="script-note mt-2">
            Feedback responses are only visible to the platform owner.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/teacher">Back to dashboard</Link>
          </Button>
        </Card>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("feedback")
    .select("id,suggestion,interest,name,contact,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const responses = data ?? [];
  const interested = responses.filter((response) => response.interest === "yes").length;
  const curious = responses.filter((response) => response.interest === "maybe").length;

  return (
    <main className="page-shell">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="greeting-eyebrow">From the landing page</p>
          <h1 className="font-serif text-3xl font-semibold">Feedback</h1>
          <p className="script-note mt-1">
            What visitors asked for, and who wants in. Only you can see this.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/feedback">View the form</Link>
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="stat-label">Responses</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{responses.length}</p>
        </Card>
        <Card>
          <p className="stat-label">Want early access</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-primary">{interested}</p>
        </Card>
        <Card>
          <p className="stat-label">Want to hear more</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{curious}</p>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="h-5 w-5 text-primary" aria-hidden="true" />
            {responses.length > 0 ? "Every response" : "Nothing yet"}
          </CardTitle>
        </CardHeader>

        {responses.length === 0 ? (
          <p className="script-note">
            Nobody has filled the form in yet. It is linked from the landing page hero as
            &ldquo;Tell us what you need&rdquo;.
          </p>
        ) : (
          <div className="grid gap-3">
            {responses.map((response) => (
              <article key={response.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{response.name || "Anonymous"}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      response.interest === "yes"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {INTEREST_LABEL[response.interest] ?? response.interest}
                  </span>
                  <span className="script-note" title={formatDateTime(response.created_at)}>
                    {timeAgo(response.created_at)}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{response.suggestion}</p>

                {response.contact ? (
                  <p className="script-note mt-2">
                    Reach them:{" "}
                    <span className="font-mono text-foreground">{response.contact}</span>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
