// Palette state for one question in a CBT attempt, following the NTA/JEE convention that
// students already know from JEE/NEET mocks.
//
// Colour mapping is deliberately NOT NTA's: NTA uses red for "visited, not answered", and
// this product never shows students red (see the practice-mode rule). Ochre carries the
// same "needs attention" weight without the failure connotation.
export type QuestionState =
  | "answered" // teal
  | "answered_marked" // violet with a teal dot
  | "marked" // violet
  | "visited" // ochre — seen but left blank
  | "not_visited"; // muted

export type AttemptAnswer = {
  questionId: string;
  studentAnswer: string;
  markedForReview: boolean;
};

// An answer row exists only once a question has been visited, so absence *is* "not visited".
// A blank student_answer means the student opened it and moved on without answering.
export function questionState(answer: AttemptAnswer | undefined): QuestionState {
  if (!answer) return "not_visited";
  const answered = answer.studentAnswer.trim().length > 0;
  if (answered) return answer.markedForReview ? "answered_marked" : "answered";
  return answer.markedForReview ? "marked" : "visited";
}

export type AttemptSummary = {
  answered: number;
  notAnswered: number;
  markedForReview: number;
  notVisited: number;
  total: number;
};

// Counts for the palette legend and the pre-submit confirmation. "answered" counts every
// question that will carry a response at submit, including ones flagged for review — that
// matches NTA, where answered-and-marked still scores.
export function summarizeAttempt(
  questionIds: string[],
  answers: Map<string, AttemptAnswer>
): AttemptSummary {
  const summary: AttemptSummary = {
    answered: 0,
    notAnswered: 0,
    markedForReview: 0,
    notVisited: 0,
    total: questionIds.length
  };

  for (const id of questionIds) {
    const state = questionState(answers.get(id));
    if (state === "answered" || state === "answered_marked") summary.answered += 1;
    if (state === "visited" || state === "marked") summary.notAnswered += 1;
    if (state === "marked" || state === "answered_marked") summary.markedForReview += 1;
    if (state === "not_visited") summary.notVisited += 1;
  }

  return summary;
}

// Milliseconds left in the test window, floored at 0. The client counts down from this, but
// the server is always the authority — submitTestAction re-checks against the same window.
export function remainingMs(scheduledAt: string, durationMinutes: number, now = Date.now()) {
  const endsAt = new Date(scheduledAt).getTime() + durationMinutes * 60_000;
  return Math.max(0, endsAt - now);
}
