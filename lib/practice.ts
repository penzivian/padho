// Pure helpers for practice mode. Practice is consequence-free by design: attempts
// never touch progress_snapshots, ranks, or any test statistic.

export function isMcqAnswerCorrect(givenAnswer: string, correctAnswer: string | null) {
  if (!correctAnswer) return false;
  return givenAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
}

// Attempt-row shape for practice_attempts. is_correct: true/false for checked MCQs,
// null for subjective answers until (unless) the student self-marks "got it".
export function buildPracticeAttempt(
  questionId: string,
  givenAnswer: string,
  isCorrect: boolean | null
) {
  return {
    question_id: questionId,
    given_answer: givenAnswer.trim(),
    is_correct: isCorrect
  };
}
