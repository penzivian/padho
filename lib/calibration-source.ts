import {
  formatCalibrationBlock,
  hasUsefulCalibration,
  selectCalibrationExamples,
  type ApprovedAnswer
} from "@/lib/calibration";
import type { createSupabaseServerClient } from "@/lib/supabase-server";

type ServerClient = ReturnType<typeof createSupabaseServerClient>;

// Selection is band-based, so over-fetch once rather than paginate: 200 rows that all sit at
// full marks still yield exactly one usable example, and a second round trip would not help.
const FETCH_LIMIT = 200;

type LoadCalibrationInput = {
  questionId: string;
  maxMarks: number;
  excludeAnswerId?: string;
};

// Builds the few-shot block for one question, or "" when there is not enough signal.
//
// Deliberately uses the RLS-respecting client, not admin. `answers_select_visible` grants a
// teacher only the answers on tests they own, so the query cannot reach another teacher's
// marking — which is exactly the semantics we want, since the whole point is to match *this*
// teacher's standard. Using admin here would have been both looser and less correct.
export async function loadCalibrationBlock(
  supabase: ServerClient,
  { questionId, maxMarks, excludeAnswerId }: LoadCalibrationInput
) {
  let query = supabase
    .from("answers")
    .select(
      "id,student_answer,awarded_marks,questions!inner(question_type),test_submissions!inner(submitted_at)"
    )
    .eq("question_id", questionId)
    // "Approved" is both of these: a row can carry an AI suggestion with no approval.
    .not("approved_at", "is", null)
    .not("awarded_marks", "is", null)
    // Subjective only. MCQ marks can be negative since 0008, and this also keeps the sample
    // to the kind of judgement the model is being asked to imitate.
    .eq("questions.question_type", "subjective")
    // A finished attempt. Filtering on submission status alone would pull marks from a
    // student still sitting the test.
    .not("test_submissions.submitted_at", "is", null)
    .limit(FETCH_LIMIT);

  if (excludeAnswerId) query = query.neq("id", excludeAnswerId);

  const { data, error } = await query;
  if (error || !data) return "";

  const approved: ApprovedAnswer[] = data.map((row) => ({
    id: row.id,
    answerText: row.student_answer,
    awardedMarks: Number(row.awarded_marks)
  }));

  const examples = selectCalibrationExamples(approved, maxMarks);
  if (!hasUsefulCalibration(examples)) return "";

  return formatCalibrationBlock(examples, maxMarks);
}
