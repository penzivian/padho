"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  answerDoubt,
  extractQuestionsFromFile,
  generateQuestions,
  gradeSubjectiveAnswer,
  type DraftQuestion
} from "@/lib/ai";
import { devLoginCodesEnabled, isPlatformOwner, optionalEnv } from "@/lib/env";
import { parseAnswerKey } from "@/lib/extract";
import { describeFigureWarning } from "@/lib/pdf-figures";
import { QUESTION_IMAGE_BUCKET, signQuestionImages } from "@/lib/question-images";
import { normalizeForFingerprint, sanitizeSearchTerm, topicKey } from "@/lib/question-bank";
import { loadCalibrationBlock } from "@/lib/calibration-source";
import { buildProgressSnapshot, scoreMcqAnswer } from "@/lib/grading";
import { monthStartUtcIso, scheduleInputToUtcIso } from "@/lib/time";
import { buildPracticeAttempt, isMcqAnswerCorrect } from "@/lib/practice";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { generateInviteCode, normalizePhone } from "@/lib/utils";
import type { Insert, Row } from "@/types/database";

type ActionState<T = null> = {
  ok: boolean;
  message: string;
  data?: T;
};

export type DraftQuestionsState = ActionState<{
  questions: DraftQuestion[];
  fileUrl?: string;
  source: "uploaded" | "ai_generated";
  // Set when the uploaded paper looks like it carries diagrams. Extraction reads text only,
  // so without this a figure-heavy paper extracts "cleanly" and the figures are just gone.
  figureWarning?: string;
}>;

export type DoubtState = ActionState<{ answer: string }>;

export async function sendOtpAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const contact = readString(formData, "contact");

  if (!contact) redirect("/auth?error=Enter%20email%20or%20phone");

  // Dev/demo mode: mint the code server-side and show it on the verify screen —
  // no email delivery involved. Gated off in production by devLoginCodesEnabled().
  if (contact.includes("@") && devLoginCodesEnabled()) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: contact
    });

    if (error) redirect(`/auth?error=${encodeURIComponent(error.message)}`);

    const devCode = data.properties?.email_otp ?? "";
    redirect(
      `/auth?sent=1&contact=${encodeURIComponent(contact)}&devcode=${encodeURIComponent(devCode)}`
    );
  }

  const result = contact.includes("@")
    ? await supabase.auth.signInWithOtp({
        email: contact,
        options: { emailRedirectTo: `${requestOrigin()}/auth/callback` }
      })
    : await supabase.auth.signInWithOtp({ phone: contact });

  if (result.error) redirect(`/auth?error=${encodeURIComponent(result.error.message)}`);
  redirect(`/auth?sent=1&contact=${encodeURIComponent(contact)}`);
}

export async function verifyOtpAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const contact = readString(formData, "contact");
  const token = readString(formData, "token");

  if (!contact || !token) redirect("/auth?error=Enter%20the%20OTP");

  const result = contact.includes("@")
    ? await supabase.auth.verifyOtp({ email: contact, token, type: "email" })
    : await supabase.auth.verifyOtp({ phone: contact, token, type: "sms" });

  if (result.error) redirect(`/auth?error=${encodeURIComponent(result.error.message)}`);
  redirect("/onboarding");
}

export async function signInWithGoogleAction() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${requestOrigin()}/auth/callback` }
  });

  if (error || !data?.url) {
    redirect(`/auth?error=${encodeURIComponent(error?.message || "Google sign-in is not available")}`);
  }
  redirect(data.url);
}

export async function signOutAction() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth");
}

export async function completeProfileAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const role = readString(formData, "role");
  if (role !== "teacher" && role !== "student") redirect("/onboarding?error=Choose%20a%20role");

  const fullName = readString(formData, "full_name");
  const phone = normalizePhone(readString(formData, "phone"));

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    role,
    full_name: fullName || user.email || user.phone || "New user",
    phone,
    is_placeholder: false
  });

  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect(`/${role}`);
}

export async function updateProfileAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const fullName = readString(formData, "full_name");
  if (!fullName) redirect("/profile?error=Enter%20your%20name");

  const phone = normalizePhone(readString(formData, "phone"));
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", user.id);

  if (error) redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

export async function createBatchAction(formData: FormData) {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const batch = {
    teacher_id: user.id,
    name: readString(formData, "name"),
    subject: readString(formData, "subject"),
    exam_target: readString(formData, "exam_target")
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await supabase.from("batches").insert({
      ...batch,
      invite_code: generateInviteCode()
    });

    if (!error) {
      revalidatePath("/teacher");
      redirect("/teacher/batches");
    }

    if (!error.message.toLowerCase().includes("duplicate")) {
      redirect(`/teacher/batches?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect("/teacher/batches?error=Could%20not%20generate%20a%20unique%20invite%20code");
}

export async function removeStudentAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const batchId = readString(formData, "batch_id");
  const studentId = readString(formData, "student_id");

  const { error } = await supabase
    .from("batch_students")
    .delete()
    .eq("batch_id", batchId)
    .eq("student_id", studentId);

  if (error) redirect(`/teacher/batches?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher/batches");
}

export async function addStudentByPhoneAction(formData: FormData) {
  await requireRole("teacher");
  const admin = createSupabaseAdminClient();
  const supabase = createSupabaseServerClient();
  const batchId = readString(formData, "batch_id");
  const fullName = readString(formData, "full_name");
  const phone = normalizePhone(readString(formData, "phone"));

  if (!phone) redirect("/teacher/batches?error=Phone%20is%20required");

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  let studentId = existingProfile?.id;

  if (!studentId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      phone,
      phone_confirm: false,
      user_metadata: { full_name: fullName, role: "student" }
    });

    if (createError || !created.user) {
      redirect(
        `/teacher/batches?error=${encodeURIComponent(createError?.message || "Could not create student")}`
      );
    }

    studentId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({
      id: studentId,
      role: "student",
      full_name: fullName || phone,
      phone,
      is_placeholder: true
    });

    if (profileError) redirect(`/teacher/batches?error=${encodeURIComponent(profileError.message)}`);
  }

  const { error } = await supabase
    .from("batch_students")
    .insert({ batch_id: batchId, student_id: studentId });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    redirect(`/teacher/batches?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/teacher/batches");
}

export async function joinBatchAction(formData: FormData) {
  await requireRole("student");
  const supabase = createSupabaseServerClient();
  const inviteCode = readString(formData, "invite_code");
  const { error } = await supabase.rpc("join_batch_by_invite", {
    p_invite_code: inviteCode
  });

  if (error) redirect(`/student?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/student");
  redirect("/student");
}

export async function generateDraftQuestionsAction(
  _previous: DraftQuestionsState,
  formData: FormData
): Promise<DraftQuestionsState> {
  const { user } = await requireRole("teacher");
  const input = {
    subject: readString(formData, "subject"),
    topic: readString(formData, "topic"),
    examTarget: readString(formData, "exam_target"),
    difficulty: readString(formData, "difficulty") || "medium",
    count: readNumber(formData, "count", 5),
    mix: readString(formData, "mix") || "mixed"
  };

  try {
    await enforceAiLimit(user.id, "question_generation");
    const questions = await generateQuestions(input);
    await recordAiUsage(user.id, user.id, "question_generation");
    return { ok: true, message: "Draft ready", data: { questions, source: "ai_generated" } };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

// Reads the uploaded PDF's text geometry to warn when a paper carries diagrams. Kept here
// rather than in lib/pdf-figures.ts so that module stays pure and unit-testable, and so pdfjs
// is never pulled into a client bundle. A failure here must never fail the extraction itself —
// the questions are already parsed by this point.
async function describeUploadedFigures(file: File): Promise<string | null> {
  if (!file.type.includes("pdf")) return null;
  try {
    const { extractTextItems } = await import("unpdf");
    const { items } = await extractTextItems(new Uint8Array(await file.arrayBuffer()));
    return describeFigureWarning(items);
  } catch {
    return null;
  }
}

export async function extractDraftQuestionsAction(
  _previous: DraftQuestionsState,
  formData: FormData
): Promise<DraftQuestionsState> {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const fileValue = formData.get("paper_file");

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return { ok: false, message: "Upload a paper image or PDF" };
  }

  try {
    await enforceAiLimit(user.id, "paper_extraction");

    const safeName = fileValue.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const fileUrl = `${user.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("question-paper-uploads")
      .upload(fileUrl, fileValue, { upsert: false });

    if (uploadError) throw uploadError;

    const questions = await extractQuestionsFromFile(fileValue);
    await recordAiUsage(user.id, user.id, "paper_extraction");
    return {
      ok: true,
      message: "Draft ready",
      data: {
        questions,
        fileUrl,
        source: "uploaded",
        figureWarning: (await describeUploadedFigures(fileValue)) ?? undefined
      }
    };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export type QuestionImageState = { ok: boolean; message: string; path?: string };

// Uploads one diagram for a question. Returns the storage PATH, never a URL — the app mints
// a short-lived signed URL per request, after the viewer has passed the relevant gate.
export async function uploadQuestionImageAction(formData: FormData): Promise<QuestionImageState> {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const fileValue = formData.get("image");

  if (!(fileValue instanceof File) || fileValue.size === 0) {
    return { ok: false, message: "Choose an image first." };
  }
  if (!fileValue.type.startsWith("image/")) {
    return { ok: false, message: "That file is not an image." };
  }
  if (fileValue.size > 5 * 1024 * 1024) {
    return { ok: false, message: "Diagram must be under 5 MB." };
  }

  // Folder is the teacher's id, which is what the storage policy keys on.
  const safeName = fileValue.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${user.id}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, fileValue, { upsert: false });

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Diagram added.", path };
}

export async function savePaperAction(payload: {
  batchId: string;
  title: string;
  source: "uploaded" | "ai_generated";
  fileUrl?: string;
  questions: DraftQuestion[];
}) {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const questions = normalizeDraftQuestions(payload.questions);

  if (!payload.batchId) return { ok: false, message: "Select a batch before saving." };
  if (!payload.title) return { ok: false, message: "Enter a paper title before saving." };
  if (questions.length === 0) {
    return { ok: false, message: "Add at least one question with text before saving." };
  }

  const { data: paper, error: paperError } = await supabase
    .from("question_papers")
    .insert({
      teacher_id: user.id,
      batch_id: payload.batchId,
      title: payload.title,
      source: payload.source,
      file_url: payload.fileUrl || null
    })
    .select("id")
    .single();

  if (paperError) return { ok: false, message: paperError.message };

  // position preserves the paper's order explicitly. A bulk insert gives every row the same
  // created_at, so without this the order falls through to a random UUID.
  const rows: Insert<"questions">[] = questions.map((question, index) => ({
    question_paper_id: paper.id,
    position: index + 1,
    question_text: question.question_text,
    question_type: question.question_type,
    topic: question.topic,
    options: question.options,
    correct_answer: question.correct_answer,
    max_marks: question.max_marks,
    negative_marks: question.negative_marks,
    rubric: question.rubric,
    image_path: question.image_path ?? null
  }));

  const { error: questionsError } = await supabase.from("questions").insert(rows);
  if (questionsError) return { ok: false, message: questionsError.message };

  revalidatePath("/teacher/papers");
  return { ok: true, message: "Question paper saved" };
}

export async function scheduleTestAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const batchId = readString(formData, "batch_id");
  const paperId = readString(formData, "question_paper_id");
  const scheduledAt = readString(formData, "scheduled_at");
  const durationMinutes = readNumber(formData, "duration_minutes", 60);
  const title = readString(formData, "title");

  // The form sends a bare wall-clock string with no timezone; resolve it in IST rather than
  // in whatever zone this process happens to run in (UTC on Vercel, IST on a local Mac).
  const scheduledAtUtc = scheduleInputToUtcIso(scheduledAt);
  if (!scheduledAtUtc) {
    redirect("/teacher/tests?error=Pick%20a%20valid%20date%20and%20time");
  }

  // A paper with keyless MCQs is deliberately allowed here: those questions are routed to
  // manual grading at submit time (see submitTestAction) rather than silently auto-scoring 0.
  const { error } = await supabase.from("tests").insert({
    batch_id: batchId,
    question_paper_id: paperId,
    title,
    scheduled_at: scheduledAtUtc,
    duration_minutes: durationMinutes,
    status: "scheduled"
  });

  if (error) redirect(`/teacher/tests?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher/tests");
  redirect("/teacher/tests");
}

// Shared gate for every attempt action: confirm the student can see the test through the
// RLS-respecting client, then read the authoritative row with admin. Returns the test and
// whether its window is open right now.
async function loadAttemptTest(testId: string) {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const { data: visibleTest } = await supabase
    .from("tests")
    .select("id")
    .eq("id", testId)
    .maybeSingle();

  if (!visibleTest) return null;

  const { data: test } = await admin
    .from("tests")
    .select("id,batch_id,question_paper_id,scheduled_at,duration_minutes,closed_at")
    .eq("id", testId)
    .single();

  if (!test) return null;

  const startsAt = new Date(test.scheduled_at).getTime();
  const endsAt = startsAt + test.duration_minutes * 60_000;
  const now = Date.now();

  return {
    test,
    isOpen: !test.closed_at && now >= startsAt && now <= endsAt,
    hasStarted: now >= startsAt
  };
}

// Creates (or resumes) the student's attempt after they accept the instructions. The
// submission row exists from this moment with submitted_at null, which is what marks it
// in progress — so a refresh, a dead battery or a switched device resumes instead of losing
// the paper. Every read that counts finished attempts filters submitted_at is not null.
export async function startTestAction(formData: FormData) {
  const { user } = await requireRole("student");
  const admin = createSupabaseAdminClient();
  const testId = readString(formData, "test_id");

  const loaded = await loadAttemptTest(testId);
  if (!loaded) redirect("/student?error=Test%20is%20not%20available");
  if (!loaded.isOpen) {
    redirect(`/student/tests/${testId}?error=${encodeURIComponent("This test is not open right now")}`);
  }

  const { data: existing } = await admin
    .from("test_submissions")
    .select("id,submitted_at")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing?.submitted_at) {
    redirect("/student?error=You%20already%20submitted%20this%20test");
  }

  if (!existing) {
    const { error } = await admin
      .from("test_submissions")
      .insert({ test_id: testId, student_id: user.id, submitted_at: null, status: "pending" });

    if (error) redirect(`/student?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/student/tests/${testId}/attempt`);
}

export type SaveAnswerResult = { ok: boolean; message?: string };

// Per-question save, called by the CBT shell on Save & Next / Mark for Review / Clear.
// Returns a value rather than redirecting so the shell can surface a failure inline without
// losing the student's place.
export async function saveAnswerAction(formData: FormData): Promise<SaveAnswerResult> {
  const { user } = await requireRole("student");
  const admin = createSupabaseAdminClient();
  const testId = readString(formData, "test_id");
  const questionId = readString(formData, "question_id");
  const studentAnswer = readString(formData, "student_answer");
  const markedForReview = readString(formData, "marked_for_review") === "true";

  const loaded = await loadAttemptTest(testId);
  if (!loaded) return { ok: false, message: "Test is not available." };
  if (!loaded.isOpen) return { ok: false, message: "This test is closed." };

  const { data: submission } = await admin
    .from("test_submissions")
    .select("id,submitted_at")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!submission) return { ok: false, message: "Start the test before answering." };
  if (submission.submitted_at) return { ok: false, message: "You already submitted this test." };

  // The question must belong to this test's paper — otherwise a crafted request could write
  // an answer against any question in the database.
  const { data: question } = await admin
    .from("questions")
    .select("id")
    .eq("id", questionId)
    .eq("question_paper_id", loaded.test.question_paper_id)
    .maybeSingle();

  if (!question) return { ok: false, message: "That question is not part of this test." };

  const { error } = await admin.from("answers").upsert(
    {
      submission_id: submission.id,
      question_id: questionId,
      student_answer: studentAnswer,
      marked_for_review: markedForReview
    },
    { onConflict: "submission_id,question_id" }
  );

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// Turns an in-progress attempt into a finished one: fills in rows for questions never
// visited, auto-scores keyed MCQs, routes anything needing a teacher to the grading queue,
// and writes the snapshot when nothing does. Used by the student's submit, the timer's
// auto-submit, and the teacher closing a test out from under live attempts.
async function finalizeAttempt(submissionId: string, questionPaperId: string) {
  const admin = createSupabaseAdminClient();

  const [{ data: questions }, { data: savedAnswers }] = await Promise.all([
    admin
      .from("questions")
      .select("id,question_type,correct_answer,max_marks,negative_marks")
      .eq("question_paper_id", questionPaperId)
      .order("position", { ascending: true }),
    admin.from("answers").select("question_id,student_answer").eq("submission_id", submissionId)
  ]);

  if (!questions) throw new Error("Questions unavailable");

  const answerByQuestion = new Map(
    (savedAnswers ?? []).map((row) => [row.question_id, row.student_answer])
  );

  // Anything the server cannot score on its own goes to the teacher: subjective answers,
  // and MCQs whose paper carries no answer key (the teacher grades those by hand).
  const needsTeacher = questions.some(
    (question) => question.question_type === "subjective" || !question.correct_answer?.trim()
  );

  const answerRows: Insert<"answers">[] = questions.map((question) => {
    const studentAnswer = answerByQuestion.get(question.id) ?? "";
    // null (not 0) for a keyless MCQ — 0 would read as a finalized wrong answer.
    const awardedMarks =
      question.question_type === "mcq" && question.correct_answer?.trim()
        ? scoreMcqAnswer(
            studentAnswer,
            question.correct_answer,
            question.max_marks,
            question.negative_marks
          )
        : null;

    return {
      submission_id: submissionId,
      question_id: question.id,
      student_answer: studentAnswer,
      awarded_marks: awardedMarks
    };
  });

  const { error: answerError } = await admin
    .from("answers")
    .upsert(answerRows, { onConflict: "submission_id,question_id" });

  if (answerError) throw answerError;

  const { error: submissionError } = await admin
    .from("test_submissions")
    .update({ submitted_at: new Date().toISOString(), status: needsTeacher ? "pending" : "graded" })
    .eq("id", submissionId);

  if (submissionError) throw submissionError;

  if (!needsTeacher) await createProgressSnapshot(submissionId);
}

export async function submitTestAction(formData: FormData) {
  const { user } = await requireRole("student");
  const admin = createSupabaseAdminClient();
  const testId = readString(formData, "test_id");

  const loaded = await loadAttemptTest(testId);
  if (!loaded) redirect("/student?error=Test%20is%20not%20available");
  if (!loaded.hasStarted) redirect("/student?error=Test%20has%20not%20started%20yet");

  const { data: submission } = await admin
    .from("test_submissions")
    .select("id,submitted_at")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!submission) redirect("/student?error=You%20did%20not%20start%20this%20test");
  if (submission.submitted_at) redirect("/student?error=You%20already%20submitted%20this%20test");

  // Deliberately no window check here: the window closing (or the teacher closing the test)
  // is exactly when an in-flight attempt most needs to be banked. Answers were already saved
  // per question while the test was open, so nothing new can be smuggled in at this point.
  try {
    await finalizeAttempt(submission.id, loaded.test.question_paper_id);
  } catch (error) {
    redirect(`/student?error=${encodeURIComponent(errorMessage(error))}`);
  }

  revalidatePath("/student");
  redirect(`/student?submitted=${testId}`);
}

// Adds or corrects an answer key on a paper that was already saved (and possibly already
// tested on). Keys are given by question number — the paper's `position`, which is the same
// numbering the student saw — so "12:B" always means the twelfth question.
export async function updateAnswerKeyAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const paperId = readString(formData, "paper_id");
  const keyText = readString(formData, "answer_key");

  const { data: paper } = await supabase
    .from("question_papers")
    .select("id")
    .eq("id", paperId)
    .maybeSingle();

  if (!paper) redirect("/teacher/papers?error=Paper%20not%20available");

  const key = parseAnswerKey(keyText);
  if (Object.keys(key).length === 0) {
    redirect("/teacher/papers?error=No%20answers%20found.%20Use%20a%20format%20like%201%3AB%2C%202%3AC");
  }

  const { data: questions } = await admin
    .from("questions")
    .select("id,question_type,options,position,max_marks")
    .eq("question_paper_id", paperId)
    .order("position", { ascending: true });

  if (!questions) redirect("/teacher/papers?error=Questions%20unavailable");

  let applied = 0;
  for (const question of questions) {
    const letter = key[question.position];
    if (!letter || question.question_type !== "mcq") continue;

    const options = Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : [];
    const optionIndex = letter.charCodeAt(0) - 65;
    if (optionIndex < 0 || optionIndex >= options.length) continue;

    const { error } = await admin
      .from("questions")
      .update({ correct_answer: options[optionIndex] })
      .eq("id", question.id);

    if (error) redirect(`/teacher/papers?error=${encodeURIComponent(error.message)}`);
    applied += 1;
  }

  try {
    await rescoreUnapprovedMcqs(paperId);
  } catch (rescoreError) {
    redirect(`/teacher/papers?error=${encodeURIComponent(errorMessage(rescoreError))}`);
  }

  revalidatePath("/teacher/papers");
  redirect(`/teacher/papers?applied=${applied}`);
}

// After a key changes, re-score MCQ answers the teacher has not already approved by hand.
// An approved answer is deliberately left alone — a teacher's manual mark outranks the key,
// and silently overwriting it would break the "teacher decides" guarantee.
async function rescoreUnapprovedMcqs(paperId: string) {
  const admin = createSupabaseAdminClient();

  const { data: tests } = await admin
    .from("tests")
    .select("id")
    .eq("question_paper_id", paperId);

  if (!tests?.length) return;

  const { data: submissions } = await admin
    .from("test_submissions")
    .select("id,status")
    .in(
      "test_id",
      tests.map((test) => test.id)
    )
    .not("submitted_at", "is", null);

  if (!submissions?.length) return;

  const { data: questions } = await admin
    .from("questions")
    .select("id,question_type,correct_answer,max_marks,negative_marks")
    .eq("question_paper_id", paperId);

  const keyedMcqs = new Map(
    (questions ?? [])
      .filter((question) => question.question_type === "mcq" && question.correct_answer?.trim())
      .map((question) => [question.id, question])
  );

  if (keyedMcqs.size === 0) return;

  for (const submission of submissions) {
    const { data: answers } = await admin
      .from("answers")
      .select("id,question_id,student_answer,approved_at")
      .eq("submission_id", submission.id)
      .is("approved_at", null);

    let changed = false;
    for (const answer of answers ?? []) {
      const question = keyedMcqs.get(answer.question_id);
      if (!question) continue;

      await admin
        .from("answers")
        .update({
          awarded_marks: scoreMcqAnswer(
            answer.student_answer,
            question.correct_answer,
            question.max_marks,
            question.negative_marks
          )
        })
        .eq("id", answer.id);
      changed = true;
    }

    // Only an already-graded submission has a snapshot to keep in step; a pending one gets
    // its snapshot when the teacher approves.
    if (changed && submission.status === "graded") await createProgressSnapshot(submission.id);
  }
}

export async function rescheduleTestAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const testId = readString(formData, "test_id");
  const scheduledAt = readString(formData, "scheduled_at");
  const durationMinutes = readNumber(formData, "duration_minutes", 60);

  const scheduledAtUtc = scheduleInputToUtcIso(scheduledAt);
  if (!scheduledAtUtc) redirect("/teacher/tests?error=Pick%20a%20valid%20date%20and%20time");

  // The RLS-respecting client is the gate: tests_update_teacher already restricts this to
  // the owning teacher, so no admin client is needed.
  const { error } = await supabase
    .from("tests")
    .update({ scheduled_at: scheduledAtUtc, duration_minutes: durationMinutes, closed_at: null })
    .eq("id", testId);

  if (error) redirect(`/teacher/tests?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher/tests");
  revalidatePath("/student");
  redirect("/teacher/tests");
}

// Closing ends the test immediately. Any attempt still in progress is banked rather than
// abandoned — otherwise those students' answers would sit unsubmitted forever and never
// reach the teacher's grading queue.
export async function closeTestAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const testId = readString(formData, "test_id");

  const { data: visibleTest } = await supabase
    .from("tests")
    .select("id,question_paper_id")
    .eq("id", testId)
    .maybeSingle();

  if (!visibleTest) redirect("/teacher/tests?error=Test%20not%20available");

  const { error } = await supabase
    .from("tests")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", testId);

  if (error) redirect(`/teacher/tests?error=${encodeURIComponent(error.message)}`);

  const { data: inProgress } = await admin
    .from("test_submissions")
    .select("id")
    .eq("test_id", testId)
    .is("submitted_at", null);

  try {
    for (const submission of inProgress ?? []) {
      await finalizeAttempt(submission.id, visibleTest.question_paper_id);
    }
  } catch (finalizeError) {
    redirect(`/teacher/tests?error=${encodeURIComponent(errorMessage(finalizeError))}`);
  }

  revalidatePath("/teacher/tests");
  revalidatePath("/student");
  redirect("/teacher/tests");
}

export async function requestGradeSuggestionsAction(formData: FormData) {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const submissionId = readString(formData, "submission_id");

  const { data: visibleSubmission } = await supabase
    .from("test_submissions")
    .select("id")
    .eq("id", submissionId)
    .maybeSingle();

  if (!visibleSubmission) redirect("/teacher/tests?error=Submission%20not%20available");

  const { data: answers, error } = await admin
    .from("answers")
    .select("id,student_answer,question_id,questions(question_text,question_type,rubric,max_marks)")
    .eq("submission_id", submissionId);

  if (error || !answers) redirect(`/teacher/tests?error=${encodeURIComponent(error?.message || "No answers")}`);

  try {
    for (const answer of answers) {
      const question = Array.isArray(answer.questions) ? answer.questions[0] : answer.questions;
      if (!question || question.question_type !== "subjective") continue;

      await enforceAiLimit(user.id, "subjective_grading");
      // Few-shot the model on this teacher's own approved marks for this same question.
      // Returns "" until there are enough of them, in which case the prompt is unchanged.
      // Teacher-only path: this block must never reach a student-facing payload.
      const calibration = await loadCalibrationBlock(supabase, {
        questionId: answer.question_id,
        maxMarks: question.max_marks,
        excludeAnswerId: answer.id
      });
      const suggestion = await gradeSubjectiveAnswer({
        question: question.question_text,
        rubric: question.rubric,
        maxMarks: question.max_marks,
        answer: answer.student_answer,
        calibration
      });

      await admin
        .from("answers")
        .update({
          ai_suggested_marks: Math.min(suggestion.suggested_marks, question.max_marks),
          ai_feedback: suggestion.feedback
        })
        .eq("id", answer.id);
      await recordAiUsage(user.id, user.id, "subjective_grading");
    }
  } catch (aiError) {
    redirect(`/teacher/tests?error=${encodeURIComponent(errorMessage(aiError))}`);
  }

  revalidatePath("/teacher/tests");
}

export async function approveGradesAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const submissionId = readString(formData, "submission_id");

  const { data: visibleSubmission } = await supabase
    .from("test_submissions")
    .select("id")
    .eq("id", submissionId)
    .maybeSingle();

  if (!visibleSubmission) redirect("/teacher/tests?error=Submission%20not%20available");

  const { data: answers, error } = await admin
    .from("answers")
    .select("id,questions(max_marks,question_type,negative_marks)")
    .eq("submission_id", submissionId);

  if (error || !answers) redirect(`/teacher/tests?error=${encodeURIComponent(error?.message || "No answers")}`);

  try {
    for (const answer of answers) {
      const question = Array.isArray(answer.questions) ? answer.questions[0] : answer.questions;
      const maxMarks = question?.max_marks ?? 0;
      // Floor at the question's own penalty: negative marking makes a mark below zero legal,
      // but only down to the configured deduction, and never for a written answer.
      const floor =
        question?.question_type === "mcq" ? -Math.abs(question?.negative_marks ?? 0) : 0;
      const awardedMarks = Math.min(
        Math.max(readNumber(formData, `mark_${answer.id}`, 0), floor),
        maxMarks
      );
      const teacherFeedback = readString(formData, `feedback_${answer.id}`) || null;

      await admin
        .from("answers")
        .update({
          awarded_marks: awardedMarks,
          teacher_feedback: teacherFeedback,
          approved_at: new Date().toISOString()
        })
        .eq("id", answer.id);
    }

    await admin.from("test_submissions").update({ status: "graded" }).eq("id", submissionId);
    await createProgressSnapshot(submissionId);
  } catch (snapshotError) {
    redirect(`/teacher/tests?error=${encodeURIComponent(errorMessage(snapshotError))}`);
  }

  revalidatePath("/teacher/tests");
}

export async function toggleRankVisibilityAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const testId = readString(formData, "test_id");
  const next = readString(formData, "show_full_ranks") === "true";

  const { data: visibleTest } = await supabase
    .from("tests")
    .select("id")
    .eq("id", testId)
    .maybeSingle();

  if (!visibleTest) redirect("/teacher/tests?error=Test%20not%20available");

  const { error } = await supabase
    .from("tests")
    .update({ show_full_ranks: next })
    .eq("id", testId);

  if (error) {
    redirect(`/teacher/tests/${testId}/results?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/teacher/tests/${testId}/results`);
  redirect(`/teacher/tests/${testId}/results`);
}

// Copies a saved paper's questions into the teacher's own bank. A COPY, deliberately: the
// paper keeps its own rows, so editing a bank question later can never retroactively change
// a paper students already sat.
//
// Idempotent — a unique index on (owner, fingerprint) means saving the same paper twice adds
// nothing the second time.
export async function savePaperToBankAction(formData: FormData) {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const paperId = readString(formData, "paper_id");

  // RLS gate: question_papers is teacher-scoped, so this returns nothing for another
  // teacher's paper, and questions_select_teacher does the same for the rows below.
  const { data: paper } = await supabase
    .from("question_papers")
    .select("id,title,batches(subject)")
    .eq("id", paperId)
    .maybeSingle();

  if (!paper) redirect("/teacher/papers?error=Paper%20not%20available");

  const { data: questions } = await supabase
    .from("questions")
    .select("question_text,question_type,topic,options,correct_answer,max_marks,negative_marks,rubric,image_path")
    .eq("question_paper_id", paperId)
    .order("position", { ascending: true });

  if (!questions?.length) redirect("/teacher/papers?error=That%20paper%20has%20no%20questions");

  const batch = Array.isArray(paper.batches) ? paper.batches[0] : paper.batches;
  const subject = (batch as { subject: string } | null | undefined)?.subject ?? "";

  const rows: Insert<"bank_questions">[] = [];
  for (const question of questions) {
    const options = Array.isArray(question.options)
      ? question.options.filter((option): option is string => typeof option === "string")
      : null;

    // The bank mirrors questions_mcq_shape; an MCQ with fewer than two options would be
    // rejected by the check constraint, so skip rather than fail the whole import.
    if (question.question_type === "mcq" && (!options || options.length < 2)) continue;

    rows.push({
      owner_teacher_id: user.id,
      question_text: question.question_text,
      question_type: question.question_type,
      topic: question.topic,
      subject,
      options: question.question_type === "mcq" ? options : null,
      correct_answer: question.correct_answer,
      max_marks: question.max_marks,
      negative_marks: question.negative_marks,
      rubric: question.rubric,
      image_path: question.image_path,
      source_label: paper.title,
      source_paper_id: paper.id,
      fingerprint: fingerprintQuestion({
        questionText: question.question_text,
        questionType: question.question_type,
        options
      })
    });
  }

  // Deduplicate within the paper itself before hitting the index, since ON CONFLICT cannot
  // resolve two conflicting rows inside one INSERT.
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.fingerprint)) return false;
    seen.add(row.fingerprint);
    return true;
  });

  const { data: inserted, error } = await supabase
    .from("bank_questions")
    .upsert(unique, { onConflict: "owner_teacher_id,fingerprint", ignoreDuplicates: true })
    .select("id");

  if (error) redirect(`/teacher/papers?error=${encodeURIComponent(error.message)}`);

  const added = inserted?.length ?? 0;
  revalidatePath("/teacher/papers");
  redirect(`/teacher/papers?banked=${added}&of=${unique.length}`);
}

export type BankScope = "mine" | "library" | "all";

export type BankSearchRow = DraftQuestion & {
  source_label: string;
  is_public: boolean;
  // Short-lived signed URL for the diagram, so the teacher can SEE what a bank question
  // carries before reusing it. A library question lives in the owner's storage folder, which
  // another teacher's own storage policy cannot read — signing is the only way through.
  image_url: string | null;
};

export type BankSearchResult = {
  ok: boolean;
  message?: string;
  questions?: BankSearchRow[];
};

// Searches the bank and returns rows already shaped as paper-builder drafts, so the builder
// can append them with no translation step.
//
// Scope note: RLS is `owner_teacher_id = auth.uid() or is_public`, so "all" needs no filter —
// a teacher sees their own rows plus the shared library and nothing else. The explicit
// filters below only narrow that further for the UI toggle.
export async function searchBankAction(formData: FormData): Promise<BankSearchResult> {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const term = sanitizeSearchTerm(readString(formData, "term"));
  const topic = readString(formData, "topic");
  const type = readString(formData, "question_type");
  const scope = readString(formData, "scope") as BankScope;

  let query = supabase
    .from("bank_questions")
    .select(
      "question_text,question_type,topic,options,correct_answer,max_marks,negative_marks,rubric,image_path,source_label,is_public"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (scope === "mine") query = query.eq("owner_teacher_id", user.id);
  if (scope === "library") query = query.eq("is_public", true);
  if (term) query = query.textSearch("search_vector", term, { type: "websearch" });
  if (topic) query = query.eq("topic_key", topicKey(topic));
  if (type === "mcq" || type === "subjective") query = query.eq("question_type", type);

  const { data, error } = await query;
  if (error) return { ok: false, message: error.message };

  // Defense-in-depth, the same shape as everywhere else: the rows above came back through the
  // RLS-respecting client, so the teacher has already been proven able to see them. Only then
  // does signQuestionImages reach for the admin client. No caller-supplied path is ever signed.
  const signedImages = await signQuestionImages((data ?? []).map((row) => row.image_path));

  const questions: BankSearchRow[] = (data ?? []).map((row) => ({
    question_text: row.question_text,
    question_type: row.question_type,
    topic: row.topic,
    options: Array.isArray(row.options)
      ? row.options.filter((option): option is string => typeof option === "string")
      : null,
    correct_answer: row.correct_answer,
    max_marks: Number(row.max_marks),
    negative_marks: Number(row.negative_marks),
    rubric: row.rubric,
    image_path: row.image_path,
    image_url: row.image_path ? (signedImages.get(row.image_path) ?? null) : null,
    source_label: row.source_label,
    is_public: row.is_public
  }));

  return { ok: true, questions };
}

export type LibraryPublishPayload = {
  questions: DraftQuestion[];
  sourceLabel: string;
  subject: string;
  difficulty: string;
  defaultTopic: string;
};

// Publishes extracted questions into the SHARED library, visible to every teacher.
//
// Gated on an env allow-list rather than a role: this writes rows that every teacher on the
// platform will see, so it must not be reachable by an ordinary teacher account.
export async function publishToLibraryAction(payload: LibraryPublishPayload) {
  const { user } = await requireRole("teacher");

  if (!isPlatformOwner(user.email)) {
    return { ok: false, message: "Only the platform owner can publish to the shared library." };
  }

  const admin = createSupabaseAdminClient();
  const sourceLabel = payload.sourceLabel.trim();
  if (!sourceLabel) return { ok: false, message: "Add a source label, e.g. 'JEE Main 2024 Shift 1'." };

  const usable = payload.questions.filter((question) => question.question_text.trim());
  if (usable.length === 0) return { ok: false, message: "Nothing to publish." };

  const difficulty = ["easy", "medium", "hard"].includes(payload.difficulty)
    ? payload.difficulty
    : null;

  const rows: Insert<"bank_questions">[] = [];
  for (const question of usable) {
    const options = question.question_type === "mcq" ? (question.options ?? []) : null;
    // Mirrors bank_questions_mcq_shape — skip rather than fail the whole upload.
    if (question.question_type === "mcq" && (!options || options.length < 2)) continue;

    const maxMarks = Math.max(0.5, Number(question.max_marks) || 1);
    rows.push({
      owner_teacher_id: user.id,
      question_text: question.question_text.trim(),
      question_type: question.question_type,
      topic: question.topic.trim() || payload.defaultTopic.trim() || "General",
      subject: payload.subject.trim(),
      options,
      correct_answer: question.correct_answer,
      max_marks: maxMarks,
      negative_marks: Math.min(Math.max(Number(question.negative_marks) || 0, 0), maxMarks),
      rubric: question.rubric,
      image_path: question.image_path ?? null,
      source_label: sourceLabel,
      difficulty,
      is_public: true,
      fingerprint: fingerprintQuestion({
        questionText: question.question_text,
        questionType: question.question_type,
        options
      })
    });
  }

  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.fingerprint)) return false;
    seen.add(row.fingerprint);
    return true;
  });

  const { data, error } = await admin
    .from("bank_questions")
    .upsert(unique, { onConflict: "owner_teacher_id,fingerprint", ignoreDuplicates: true })
    .select("id");

  if (error) return { ok: false, message: error.message };

  const added = data?.length ?? 0;
  revalidatePath("/teacher/library");
  return {
    ok: true,
    message:
      added === unique.length
        ? `Published ${added} question${added === 1 ? "" : "s"} to the shared library.`
        : `Published ${added} of ${unique.length} — the rest were already in the library.`
  };
}

export async function publishPracticeAction(formData: FormData) {
  const { user } = await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const paperId = readString(formData, "paper_id");
  const batchId = readString(formData, "batch_id");

  const { data: paper } = await supabase
    .from("question_papers")
    .select("id,title")
    .eq("id", paperId)
    .maybeSingle();

  if (!paper) redirect("/teacher/papers?error=Paper%20not%20available");

  const { error } = await supabase.from("practice_sets").insert({
    teacher_id: user.id,
    batch_id: batchId,
    paper_id: paperId,
    title: paper.title
  });

  if (error) {
    const message = error.message.toLowerCase().includes("duplicate")
      ? "That paper is already published as practice for this batch."
      : error.message;
    redirect(`/teacher/papers?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/teacher/papers");
  redirect("/teacher/papers");
}

export async function unpublishPracticeAction(formData: FormData) {
  await requireRole("teacher");
  const supabase = createSupabaseServerClient();
  const setId = readString(formData, "set_id");

  const { error } = await supabase.from("practice_sets").delete().eq("id", setId);
  if (error) redirect(`/teacher/papers?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher/papers");
}

export type PracticeCheckResult = {
  ok: boolean;
  message: string;
  kind?: "mcq" | "subjective";
  correct?: boolean;
  correctAnswer?: string | null;
  rubric?: string | null;
  attemptId?: string;
};

export async function checkPracticeAnswerAction(input: {
  setId: string;
  questionId: string;
  answer: string;
}): Promise<PracticeCheckResult> {
  const { user } = await requireRole("student");
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Visibility gate through RLS: the set is only selectable if the student belongs
  // to its batch. Only then is the answer key read with the admin client.
  const { data: visibleSet } = await supabase
    .from("practice_sets")
    .select("id,paper_id")
    .eq("id", input.setId)
    .maybeSingle();

  if (!visibleSet) return { ok: false, message: "Practice set not available" };

  const { data: question, error: questionError } = await admin
    .from("questions")
    .select("question_type,correct_answer,rubric")
    .eq("id", input.questionId)
    .eq("question_paper_id", visibleSet.paper_id)
    .maybeSingle();

  if (questionError || !question) {
    return { ok: false, message: "Question not found in this practice set" };
  }

  // The reveal only happens after the attempt is recorded (RLS-checked insert).
  const isMcq = question.question_type === "mcq";
  const correct = isMcq ? isMcqAnswerCorrect(input.answer, question.correct_answer) : null;
  const { data: attempt, error: attemptError } = await supabase
    .from("practice_attempts")
    .insert({ ...buildPracticeAttempt(input.questionId, input.answer, correct), student_id: user.id })
    .select("id")
    .single();

  if (attemptError) return { ok: false, message: attemptError.message };

  if (isMcq) {
    return {
      ok: true,
      message: "checked",
      kind: "mcq",
      correct: correct === true,
      correctAnswer: question.correct_answer,
      attemptId: attempt.id
    };
  }

  return { ok: true, message: "checked", kind: "subjective", rubric: question.rubric, attemptId: attempt.id };
}

export async function selfMarkPracticeAction(input: { attemptId: string; gotIt: boolean }) {
  await requireRole("student");
  const supabase = createSupabaseServerClient();
  // RLS restricts the update to the student's own attempt rows.
  const { error } = await supabase
    .from("practice_attempts")
    .update({ is_correct: input.gotIt ? true : null })
    .eq("id", input.attemptId);

  return error ? { ok: false, message: error.message } : { ok: true, message: "saved" };
}

export async function askDoubtAction(
  _previous: DoubtState,
  formData: FormData
): Promise<DoubtState> {
  const { user } = await requireRole("student");
  const admin = createSupabaseAdminClient();
  const question = readString(formData, "question");

  if (!question) return { ok: false, message: "Enter a question" };

  const { data: membership } = await admin
    .from("batch_students")
    .select("batch_id,batches(teacher_id,exam_target)")
    .eq("student_id", user.id)
    .limit(1)
    .maybeSingle();

  const batch = Array.isArray(membership?.batches) ? membership?.batches[0] : membership?.batches;
  const ownerTeacherId = batch?.teacher_id;

  if (!ownerTeacherId) {
    return { ok: false, message: "Join a batch before asking doubts" };
  }

  // Doubts are an open text box straight to the model, so a student sitting a CBT could
  // paste the exam question into another tab and get it solved. The questions path enforces
  // this; the doubts path had no notion of a test at all. Scoped as narrowly as possible:
  // blocked only while THIS student has an unsubmitted attempt on a test that is open right
  // now — not merely because some test exists somewhere.
  const { data: liveAttempts } = await admin
    .from("test_submissions")
    .select("id,tests(scheduled_at,duration_minutes,closed_at)")
    .eq("student_id", user.id)
    .is("submitted_at", null);

  const sittingATest = (liveAttempts ?? []).some((attempt) => {
    const test = Array.isArray(attempt.tests) ? attempt.tests[0] : attempt.tests;
    if (!test || test.closed_at) return false;
    const startsAt = new Date(test.scheduled_at).getTime();
    return Date.now() >= startsAt && Date.now() <= startsAt + test.duration_minutes * 60_000;
  });

  if (sittingATest) {
    return {
      ok: false,
      message: "You have a test in progress. Doubts unlock again once you submit it."
    };
  }

  try {
    await enforceAiLimit(ownerTeacherId, "doubt_solving");
    const answer = await answerDoubt(question, batch.exam_target);
    await recordAiUsage(ownerTeacherId, user.id, "doubt_solving");
    return { ok: true, message: "Answered", data: { answer } };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

async function requireRole(role: Row<"profiles">["role"]) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");
  if (profile.role !== role) redirect(`/${profile.role}`);

  return { user, profile };
}

async function createProgressSnapshot(submissionId: string) {
  const admin = createSupabaseAdminClient();
  const { data: submission, error: submissionError } = await admin
    .from("test_submissions")
    .select("id,test_id,student_id,tests(batch_id)")
    .eq("id", submissionId)
    .single();

  if (submissionError) throw submissionError;

  const test = Array.isArray(submission.tests) ? submission.tests[0] : submission.tests;
  if (!test) throw new Error("Submission test not found");

  const { data: answers, error: answerError } = await admin
    .from("answers")
    .select(
      "question_id,student_answer,awarded_marks,questions(question_type,topic,max_marks,negative_marks,correct_answer)"
    )
    .eq("submission_id", submissionId);

  if (answerError || !answers) throw answerError ?? new Error("Answers not found");

  const snapshot = buildProgressSnapshot(
    answers.map((answer) => {
      const question = Array.isArray(answer.questions) ? answer.questions[0] : answer.questions;
      if (!question) throw new Error("Question not found");

      return {
        questionId: answer.question_id,
        type: question.question_type,
        topic: question.topic,
        maxMarks: question.max_marks,
        correctAnswer: question.correct_answer,
        studentAnswer: answer.student_answer,
        awardedMarks: answer.awarded_marks,
        negativeMarks: question.negative_marks
      };
    })
  );

  await admin.from("progress_snapshots").upsert({
    student_id: submission.student_id,
    batch_id: test.batch_id,
    test_id: submission.test_id,
    score_percent: snapshot.scorePercent,
    topic_breakdown: snapshot.topicBreakdown
  });
}

// Known limitation: this count-then-insert check is a TOCTOU race — two concurrent calls can
// both read an under-limit count before either records usage. Acceptable at current scale;
// do not re-architect without evidence of abuse.
async function enforceAiLimit(ownerTeacherId: string, feature: string) {
  const admin = createSupabaseAdminClient();
  const limit = Number(optionalEnv("AI_MONTHLY_TEACHER_LIMIT", "200"));
  // The billing month is an IST calendar month, like every other wall-clock notion here.
  const since = monthStartUtcIso();

  const { count, error } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("owner_teacher_id", ownerTeacherId)
    .gte("created_at", since);

  if (error) throw error;
  if ((count ?? 0) >= limit) throw new Error(`Monthly AI limit reached for ${feature}`);
}

async function recordAiUsage(ownerTeacherId: string, actorId: string, feature: string) {
  const admin = createSupabaseAdminClient();
  await admin.from("ai_usage_events").insert({
    owner_teacher_id: ownerTeacherId,
    actor_id: actorId,
    feature
  });
}

function normalizeDraftQuestions(questions: DraftQuestion[]) {
  return questions
    .filter((question) => question.question_text.trim())
    .map((question) => {
      const maxMarks = Math.max(0.5, Number(question.max_marks) || 1);
      return {
      ...question,
      topic: question.topic.trim() || "General",
      options: question.question_type === "mcq" ? question.options ?? [] : null,
      correct_answer: question.question_type === "mcq" ? question.correct_answer : null,
      rubric: question.question_type === "subjective" ? question.rubric : null,
      max_marks: maxMarks,
      // Capped at max_marks: the DB enforces the same bound, and it keeps a paper from
      // being able to drive a student below -100%.
      negative_marks:
        question.question_type === "mcq"
          ? Math.min(Math.max(Number(question.negative_marks) || 0, 0), maxMarks)
          : 0,
      image_path: question.image_path?.trim() || null
    };
  });
}

function requestOrigin() {
  const headerList = headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

// SHA-256 of the normalized stem+options. Fixed length so it indexes cleanly, and the
// normalization lives in lib/question-bank.ts where it is unit-tested.
function fingerprintQuestion(candidate: {
  questionText: string;
  questionType: "mcq" | "subjective";
  options: string[] | null;
}) {
  return createHash("sha256")
    .update(
      normalizeForFingerprint({
        questionText: candidate.questionText,
        questionType: candidate.questionType,
        options: candidate.options
      })
    )
    .digest("hex");
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(readString(formData, key));
  return Number.isFinite(value) ? value : fallback;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}
