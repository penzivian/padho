// WhatsApp click-to-chat (wa.me) message building. Zero-API by design: messages send
// from the teacher's own WhatsApp. When volume justifies a Business API provider,
// swap the wa.me usage behind buildResultMessage — this module is the seam.

export type ResultMessageInput = {
  studentName: string;
  testTitle: string;
  score: number;
  maxScore: number;
  percentage: number;
  /** Included only when the teacher has ranks visible. */
  rank?: number | null;
  totalStudents?: number | null;
  resultUrl: string;
  teacherName: string;
};

// E.164 digits for wa.me: strip +, spaces, dashes; bare 10-digit Indian numbers get 91.
export function normalizeWaPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function buildResultMessage(input: ResultMessageInput) {
  const rankLine =
    input.rank && input.totalStudents ? `, Rank ${input.rank} of ${input.totalStudents}` : "";
  return `Namaskar! ${input.studentName}'s result for ${input.testTitle}: ${input.score}/${input.maxScore} (${input.percentage}%)${rankLine}. View the full breakdown on Padho: ${input.resultUrl} — ${input.teacherName}`;
}

export function buildWaLink(phone: string, message: string) {
  return `https://wa.me/${normalizeWaPhone(phone)}?text=${encodeURIComponent(message)}`;
}
