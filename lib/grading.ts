import type { Json } from "@/types/database";

export type AnswerInput = {
  questionId: string;
  type: "mcq" | "subjective";
  topic: string;
  maxMarks: number;
  correctAnswer: string | null;
  studentAnswer: string;
  awardedMarks?: number | null;
};

export type TopicScore = {
  earned: number;
  possible: number;
  percent: number;
};

export function normalizeSuggestedMark(value: number, maxMarks: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), maxMarks);
}

export function scoreMcqAnswer(studentAnswer: string, correctAnswer: string | null, maxMarks: number) {
  if (!correctAnswer) return 0;
  return studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase() ? maxMarks : 0;
}

// 1-based positions of MCQs that have no answer key. These cannot be auto-scored, so they
// are routed to the teacher's grading queue; the UI uses this to say so up front.
export function findKeylessMcqs(
  questions: { type: "mcq" | "subjective"; correctAnswer: string | null }[]
) {
  return questions.reduce<number[]>((positions, question, index) => {
    if (question.type === "mcq" && !question.correctAnswer?.trim()) positions.push(index + 1);
    return positions;
  }, []);
}

// A persisted mark always wins: for a keyed MCQ it is the auto-score written at submit
// time, and for a keyless one it is the teacher's manual mark. Only fall back to
// re-deriving from the key when nothing has been recorded yet.
export function scoreSubmission(inputs: AnswerInput[]) {
  return inputs.map((answer) => {
    const awardedMarks =
      answer.awardedMarks != null
        ? normalizeSuggestedMark(answer.awardedMarks, answer.maxMarks)
        : answer.type === "mcq"
          ? scoreMcqAnswer(answer.studentAnswer, answer.correctAnswer, answer.maxMarks)
          : 0;

    return { ...answer, awardedMarks };
  });
}

export function buildProgressSnapshot(inputs: AnswerInput[]) {
  const scored = scoreSubmission(inputs);
  const earned = scored.reduce((sum, answer) => sum + answer.awardedMarks, 0);
  const possible = scored.reduce((sum, answer) => sum + answer.maxMarks, 0);
  const topics = new Map<string, Omit<TopicScore, "percent">>();

  for (const answer of scored) {
    const current = topics.get(answer.topic) ?? { earned: 0, possible: 0 };
    topics.set(answer.topic, {
      earned: current.earned + answer.awardedMarks,
      possible: current.possible + answer.maxMarks
    });
  }

  const topicBreakdown = Object.fromEntries(
    [...topics.entries()].map(([topic, value]) => [
      topic,
      {
        ...value,
        percent: value.possible ? roundPercent((value.earned / value.possible) * 100) : 0
      }
    ])
  ) satisfies Record<string, TopicScore>;

  return {
    scorePercent: possible ? roundPercent((earned / possible) * 100) : 0,
    topicBreakdown: topicBreakdown as Json
  };
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}
