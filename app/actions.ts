"use server";

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
import { devLoginCodesEnabled, optionalEnv } from "@/lib/env";
import { buildProgressSnapshot, findKeylessMcqs, scoreMcqAnswer } from "@/lib/grading";
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
    return { ok: true, message: "Draft ready", data: { questions, fileUrl, source: "uploaded" } };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
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

  const rows: Insert<"questions">[] = questions.map((question) => ({
    question_paper_id: paper.id,
    question_text: question.question_text,
    question_type: question.question_type,
    topic: question.topic,
    options: question.options,
    correct_answer: question.correct_answer,
    max_marks: question.max_marks,
    rubric: question.rubric
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

  // Guard: an MCQ without an answer key silently scores 0 for every student
  // (scoreMcqAnswer returns 0 on a null key), so refuse to schedule such a paper.
  // Numbering follows created_at order — the same order students see.
  const { data: paperQuestions, error: questionsError } = await supabase
    .from("questions")
    .select("question_type,correct_answer")
    .eq("question_paper_id", paperId)
    .order("created_at", { ascending: true });

  if (questionsError) {
    redirect(`/teacher/tests?error=${encodeURIComponent(questionsError.message)}`);
  }

  const keyless = findKeylessMcqs(
    (paperQuestions ?? []).map((question) => ({
      type: question.question_type,
      correctAnswer: question.correct_answer
    }))
  );

  if (keyless.length > 0) {
    redirect(
      `/teacher/tests?error=${encodeURIComponent(
        `Questions ${keyless.join(", ")} are MCQs with no answer key. Add answer keys to the paper before scheduling.`
      )}`
    );
  }

  const { error } = await supabase.from("tests").insert({
    batch_id: batchId,
    question_paper_id: paperId,
    title,
    scheduled_at: new Date(scheduledAt).toISOString(),
    duration_minutes: durationMinutes,
    status: "scheduled"
  });

  if (error) redirect(`/teacher/tests?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher/tests");
  redirect("/teacher/tests");
}

export async function submitTestAction(formData: FormData) {
  const { user } = await requireRole("student");
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const testId = readString(formData, "test_id");

  const { data: visibleTest } = await supabase
    .from("tests")
    .select("id")
    .eq("id", testId)
    .maybeSingle();

  if (!visibleTest) redirect("/student?error=Test%20is%20not%20available");

  const { data: test, error: testError } = await admin
    .from("tests")
    .select("id,batch_id,question_paper_id,scheduled_at,duration_minutes")
    .eq("id", testId)
    .single();

  if (testError) redirect(`/student?error=${encodeURIComponent(testError.message)}`);

  const endsAt = new Date(test.scheduled_at).getTime() + test.duration_minutes * 60_000;
  if (Date.now() > endsAt) redirect("/student?error=Test%20time%20has%20ended");

  const { data: existing } = await admin
    .from("test_submissions")
    .select("id,status")
    .eq("test_id", testId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing) redirect("/student?error=You%20already%20submitted%20this%20test");

  const { data: questions, error: questionError } = await admin
    .from("questions")
    .select("*")
    .eq("question_paper_id", test.question_paper_id)
    .order("created_at", { ascending: true });

  if (questionError || !questions) {
    redirect(`/student?error=${encodeURIComponent(questionError?.message || "Questions unavailable")}`);
  }

  const hasSubjective = questions.some((question) => question.question_type === "subjective");
  const { data: submission, error: submissionError } = await admin
    .from("test_submissions")
    .insert({
      test_id: testId,
      student_id: user.id,
      submitted_at: new Date().toISOString(),
      status: hasSubjective ? "pending" : "graded"
    })
    .select("id")
    .single();

  if (submissionError) redirect(`/student?error=${encodeURIComponent(submissionError.message)}`);

  const answerRows: Insert<"answers">[] = questions.map((question) => {
    const studentAnswer = readString(formData, `answer_${question.id}`);
    const awardedMarks =
      question.question_type === "mcq"
        ? scoreMcqAnswer(studentAnswer, question.correct_answer, question.max_marks)
        : null;

    return {
      submission_id: submission.id,
      question_id: question.id,
      student_answer: studentAnswer,
      awarded_marks: awardedMarks
    };
  });

  const { error: answerError } = await admin.from("answers").insert(answerRows);
  if (answerError) redirect(`/student?error=${encodeURIComponent(answerError.message)}`);

  if (!hasSubjective) await createProgressSnapshot(submission.id);

  revalidatePath("/student");
  redirect("/student");
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
      const suggestion = await gradeSubjectiveAnswer({
        question: question.question_text,
        rubric: question.rubric,
        maxMarks: question.max_marks,
        answer: answer.student_answer
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
    .select("id,questions(max_marks)")
    .eq("submission_id", submissionId);

  if (error || !answers) redirect(`/teacher/tests?error=${encodeURIComponent(error?.message || "No answers")}`);

  try {
    for (const answer of answers) {
      const question = Array.isArray(answer.questions) ? answer.questions[0] : answer.questions;
      const maxMarks = question?.max_marks ?? 0;
      const awardedMarks = Math.min(readNumber(formData, `mark_${answer.id}`, 0), maxMarks);
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
    .select("question_id,student_answer,awarded_marks,questions(question_type,topic,max_marks,correct_answer)")
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
        awardedMarks: answer.awarded_marks
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
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("owner_teacher_id", ownerTeacherId)
    .gte("created_at", since.toISOString());

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
    .map((question) => ({
      ...question,
      topic: question.topic.trim() || "General",
      options: question.question_type === "mcq" ? question.options ?? [] : null,
      correct_answer: question.question_type === "mcq" ? question.correct_answer : null,
      rubric: question.question_type === "subjective" ? question.rubric : null,
      max_marks: Math.max(0.5, Number(question.max_marks) || 1)
    }));
}

function requestOrigin() {
  const headerList = headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
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
