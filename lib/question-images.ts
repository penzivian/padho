import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const QUESTION_IMAGE_BUCKET = "question-images";

// Long enough to outlast a 3-hour paper plus a slow start; short enough that a URL copied
// out of the page stops working the same day.
const ATTEMPT_URL_TTL_SECONDS = 6 * 60 * 60;
// Review pages are read in a sitting.
const REVIEW_URL_TTL_SECONDS = 60 * 60;

// Mints short-lived signed URLs for question diagrams.
//
// The bucket is private and has NO student read policy — a signed URL is the only way a
// student ever sees a diagram, and it is minted server-side only after the caller has
// already passed the same gate that protects question text (get_student_test_questions for
// a live attempt, or the submitted-and-test-over checks on the review pages).
//
// Uses the admin client deliberately: signing is exactly the privileged step that the
// preceding visibility check earns.
export async function signQuestionImages(
  paths: (string | null | undefined)[],
  scope: "attempt" | "review" = "review"
) {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const signed = new Map<string, string>();
  if (unique.length === 0) return signed;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(QUESTION_IMAGE_BUCKET)
    .createSignedUrls(unique, scope === "attempt" ? ATTEMPT_URL_TTL_SECONDS : REVIEW_URL_TTL_SECONDS);

  // A missing diagram must never take down the paper: the question still renders as text.
  if (error || !data) return signed;

  for (const item of data) {
    if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
  }

  return signed;
}
