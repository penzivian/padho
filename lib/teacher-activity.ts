import { aggregatePractice, mergeFeed, type FeedEvent } from "@/lib/activity-feed";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ServerClient = ReturnType<typeof createSupabaseServerClient>;
type Embed<T> = T | T[] | null;

function pick<T>(value: Embed<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

// Loads a merged, newest-first activity feed for the signed-in teacher. Every query runs
// on the RLS-respecting client, so it only ever returns the teacher's own students.
export async function loadActivityEvents(supabase: ServerClient): Promise<FeedEvent[]> {
  const [submissions, joins, practice] = await Promise.all([
    supabase
      .from("test_submissions")
      .select("submitted_at,profiles(full_name),tests(title)")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(50),
    supabase
      .from("batch_students")
      .select("joined_at,profiles(full_name),batches(name)")
      .order("joined_at", { ascending: false })
      .limit(50),
    supabase
      .from("practice_attempts")
      .select("created_at,profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  const submissionRows = (submissions.data ?? []) as unknown as {
    submitted_at: string;
    profiles: Embed<{ full_name: string }>;
    tests: Embed<{ title: string }>;
  }[];
  const joinRows = (joins.data ?? []) as unknown as {
    joined_at: string;
    profiles: Embed<{ full_name: string }>;
    batches: Embed<{ name: string }>;
  }[];
  const practiceRows = (practice.data ?? []) as unknown as {
    created_at: string;
    profiles: Embed<{ full_name: string }>;
  }[];

  const events: FeedEvent[] = [
    ...submissionRows.map((row) => ({
      kind: "submitted" as const,
      actor: pick(row.profiles)?.full_name ?? "A student",
      detail: pick(row.tests)?.title ?? "a test",
      at: row.submitted_at
    })),
    ...joinRows.map((row) => ({
      kind: "joined" as const,
      actor: pick(row.profiles)?.full_name ?? "A student",
      detail: pick(row.batches)?.name ?? "a batch",
      at: row.joined_at
    })),
    ...aggregatePractice(
      practiceRows.map((row) => ({
        at: row.created_at,
        actor: pick(row.profiles)?.full_name ?? "A student"
      }))
    )
  ];

  return mergeFeed(events);
}
