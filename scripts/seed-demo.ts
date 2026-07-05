/**
 * Seeds demo data under the first teacher account so the app can be explored
 * with realistic batches, papers, tests, submissions, and progress.
 *
 * Additive and idempotent: looks up by email/title before inserting, so it is
 * safe to re-run. Never deletes anything.
 *
 * Run:  set -a; source .env.local; set +a; npx tsx scripts/seed-demo.ts
 */
import { createClient } from "@supabase/supabase-js";

import { buildProgressSnapshot, type AnswerInput } from "@/lib/grading";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const DEMO_STUDENTS = [
  { email: "rahul.demo@padho.app", name: "Rahul Sharma", phone: "+919000000101" },
  { email: "meera.demo@padho.app", name: "Meera Patel", phone: "+919000000102" },
  { email: "kabir.demo@padho.app", name: "Kabir Khan", phone: "+919000000103" },
  { email: "priya.demo@padho.app", name: "Priya Nair", phone: "+919000000104" },
  { email: "arjun.demo@padho.app", name: "Arjun Das", phone: "+919000000105" }
];

type Question = {
  id: string;
  question_type: "mcq" | "subjective";
  topic: string;
  max_marks: number;
  correct_answer: string | null;
  options: string[] | null;
};

async function main() {
  const { data: teacher } = await admin
    .from("profiles")
    .select("id,full_name")
    .eq("role", "teacher")
    .order("created_at")
    .limit(1)
    .single();
  if (!teacher) throw new Error("No teacher profile found — sign up as a teacher first.");
  console.log(`Teacher: ${teacher.full_name} (${teacher.id})`);

  // 1. Students -------------------------------------------------------------
  const studentIds: Record<string, string> = {};
  const { data: userList } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const student of DEMO_STUDENTS) {
    const existing = userList?.users.find((user) => user.email === student.email);
    let id = existing?.id;
    if (!id) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: student.email,
        email_confirm: true,
        user_metadata: { full_name: student.name, role: "student" }
      });
      if (error || !created.user) throw error ?? new Error("createUser failed");
      id = created.user.id;
      console.log(`Created student ${student.name}`);
    }
    studentIds[student.email] = id;
    await admin.from("profiles").upsert({
      id,
      role: "student",
      full_name: student.name,
      phone: student.phone,
      is_placeholder: true
    });
  }

  // 2. Batch ---------------------------------------------------------------
  const batchId = await ensureBatch(teacher.id, "Class XII — Physics", "Physics", "JEE", "PHY7K4Q");
  for (const id of Object.values(studentIds)) {
    await admin
      .from("batch_students")
      .upsert({ batch_id: batchId, student_id: id }, { ignoreDuplicates: true });
  }
  console.log("Batch + roster ready");

  // 3. Papers ----------------------------------------------------------------
  const kinematicsPaper = await ensurePaper(teacher.id, batchId, "Kinematics Basics", [
    mcq("A body moving with uniform velocity has…", "Kinematics", 2, ["Zero acceleration", "Constant acceleration", "Increasing acceleration", "Variable speed"], "Zero acceleration"),
    mcq("The slope of a displacement–time graph gives…", "Kinematics", 2, ["Velocity", "Acceleration", "Distance", "Jerk"], "Velocity"),
    mcq("An object in free fall near Earth accelerates at approximately…", "Kinematics", 2, ["9.8 m/s²", "6.7 m/s²", "12 m/s²", "3.0 m/s²"], "9.8 m/s²"),
    mcq("Area under a velocity–time graph gives…", "Graphs", 2, ["Displacement", "Acceleration", "Speed", "Momentum"], "Displacement")
  ]);

  const weeklyPaper = await ensurePaper(teacher.id, batchId, "Physics Weekly", [
    mcq("A body moves with constant velocity when…", "Kinematics", 2, ["Net force on it is zero", "A constant force acts on it", "Its acceleration is constant and non-zero", "It moves in a circle"], "Net force on it is zero"),
    mcq("Newton's third law pairs act on…", "Laws of Motion", 2, ["Two different bodies", "The same body", "Only rigid bodies", "Only bodies at rest"], "Two different bodies"),
    mcq("Impulse equals change in…", "Laws of Motion", 2, ["Momentum", "Kinetic energy", "Force", "Velocity"], "Momentum"),
    subjective("Explain Newton's second law with one worked example.", "Laws of Motion", 10, "Award marks for the F = ma statement, correct reasoning, a valid example with numbers, and units.")
  ]);
  console.log("Papers ready");

  // 4. Tests -----------------------------------------------------------------
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const kinematicsTest = await ensureTest(batchId, kinematicsPaper.id, "Kinematics Basics · Unit test", daysAgo(10), 45, "completed");
  const weeklyTest = await ensureTest(batchId, weeklyPaper.id, "Physics Weekly", daysAgo(3), 40, "completed");
  const liveTest = await ensureTest(batchId, weeklyPaper.id, "Physics Weekly · Retest", new Date(Date.now() - 5 * 60_000).toISOString(), 120, "scheduled");
  console.log(`Tests ready (live test open now: ${liveTest})`);

  // 5. Submissions, answers, snapshots ----------------------------------------
  // Deterministic per-student performance, trending upward between the 2 graded tests.
  const performance: Record<string, [number, number]> = {
    "rahul.demo@padho.app": [2, 3],
    "meera.demo@padho.app": [4, 4],
    "kabir.demo@padho.app": [1, 2],
    "priya.demo@padho.app": [3, 4],
    "arjun.demo@padho.app": [2, 4]
  };
  const subjectiveMarks: Record<string, number> = {
    "rahul.demo@padho.app": 7,
    "meera.demo@padho.app": 9,
    "kabir.demo@padho.app": 5,
    "priya.demo@padho.app": 8,
    "arjun.demo@padho.app": 7.5
  };

  for (const student of DEMO_STUDENTS) {
    const studentId = studentIds[student.email];
    const [kinematicsCorrect, weeklyCorrect] = performance[student.email];

    await seedGradedSubmission({
      testId: kinematicsTest,
      batchId,
      studentId,
      paper: kinematicsPaper,
      correctCount: kinematicsCorrect,
      submittedAt: daysAgo(10),
      subjectiveAward: null,
      pendingReview: false
    });

    // Rahul's weekly submission stays pending with an unapproved AI suggestion,
    // so the grading queue shows the review flow.
    const pendingReview = student.email === "rahul.demo@padho.app";
    await seedGradedSubmission({
      testId: weeklyTest,
      batchId,
      studentId,
      paper: weeklyPaper,
      correctCount: weeklyCorrect,
      submittedAt: daysAgo(3),
      subjectiveAward: subjectiveMarks[student.email],
      pendingReview
    });
  }
  console.log("Submissions + progress seeded");
  console.log("\nDone. Demo student logins (dev code appears on the sign-in screen):");
  for (const student of DEMO_STUDENTS) console.log(`  ${student.email}`);
}

function mcq(text: string, topic: string, marks: number, options: string[], answer: string) {
  return { question_text: text, question_type: "mcq" as const, topic, max_marks: marks, options, correct_answer: answer, rubric: null };
}

function subjective(text: string, topic: string, marks: number, rubric: string) {
  return { question_text: text, question_type: "subjective" as const, topic, max_marks: marks, options: null, correct_answer: null, rubric };
}

async function ensureBatch(teacherId: string, name: string, subject: string, exam: string, code: string) {
  const { data: existing } = await admin
    .from("batches")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await admin
    .from("batches")
    .insert({ teacher_id: teacherId, name, subject, exam_target: exam, invite_code: code })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function ensurePaper(
  teacherId: string,
  batchId: string,
  title: string,
  questions: ReturnType<typeof mcq | typeof subjective>[]
): Promise<{ id: string; questions: Question[] }> {
  const { data: existing } = await admin
    .from("question_papers")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("title", title)
    .maybeSingle();

  let paperId = existing?.id as string | undefined;
  if (!paperId) {
    const { data: paper, error } = await admin
      .from("question_papers")
      .insert({ teacher_id: teacherId, batch_id: batchId, title, source: "ai_generated" })
      .select("id")
      .single();
    if (error) throw error;
    paperId = paper.id;
    const { error: questionError } = await admin
      .from("questions")
      .insert(questions.map((question) => ({ ...question, question_paper_id: paperId })));
    if (questionError) throw questionError;
  }

  const { data: rows, error: fetchError } = await admin
    .from("questions")
    .select("id,question_type,topic,max_marks,correct_answer,options")
    .eq("question_paper_id", paperId)
    .order("created_at");
  if (fetchError || !rows) throw fetchError ?? new Error("questions missing");
  return { id: paperId!, questions: rows as unknown as Question[] };
}

async function ensureTest(
  batchId: string,
  paperId: string,
  title: string,
  scheduledAt: string,
  durationMinutes: number,
  status: "scheduled" | "completed"
) {
  const { data: existing } = await admin
    .from("tests")
    .select("id")
    .eq("batch_id", batchId)
    .eq("title", title)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await admin
    .from("tests")
    .insert({ batch_id: batchId, question_paper_id: paperId, title, scheduled_at: scheduledAt, duration_minutes: durationMinutes, status })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function seedGradedSubmission(input: {
  testId: string;
  batchId: string;
  studentId: string;
  paper: { id: string; questions: Question[] };
  correctCount: number;
  submittedAt: string;
  subjectiveAward: number | null;
  pendingReview: boolean;
}) {
  const { data: existing } = await admin
    .from("test_submissions")
    .select("id")
    .eq("test_id", input.testId)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (existing) return; // already seeded

  const { data: submission, error } = await admin
    .from("test_submissions")
    .insert({
      test_id: input.testId,
      student_id: input.studentId,
      submitted_at: input.submittedAt,
      status: input.pendingReview ? "pending" : "graded"
    })
    .select("id")
    .single();
  if (error) throw error;

  const mcqQuestions = input.paper.questions.filter((question) => question.question_type === "mcq");
  const answerInputs: AnswerInput[] = [];
  const rows = input.paper.questions.map((question) => {
    if (question.question_type === "mcq") {
      const index = mcqQuestions.indexOf(question);
      const isCorrect = index < input.correctCount;
      const wrongOption =
        question.options?.find((option) => option !== question.correct_answer) ?? "—";
      const studentAnswer = isCorrect ? question.correct_answer! : wrongOption;
      const awarded = isCorrect ? question.max_marks : 0;
      answerInputs.push({
        questionId: question.id,
        type: "mcq",
        topic: question.topic,
        maxMarks: question.max_marks,
        correctAnswer: question.correct_answer,
        studentAnswer,
        awardedMarks: awarded
      });
      return {
        submission_id: submission.id,
        question_id: question.id,
        student_answer: studentAnswer,
        awarded_marks: awarded
      };
    }

    const suggested = input.subjectiveAward ?? 0;
    answerInputs.push({
      questionId: question.id,
      type: "subjective",
      topic: question.topic,
      maxMarks: question.max_marks,
      correctAnswer: null,
      studentAnswer: "F = ma. For example, a 2 kg trolley pushed with 6 N accelerates at 3 m/s².",
      awardedMarks: input.pendingReview ? 0 : suggested
    });
    return {
      submission_id: submission.id,
      question_id: question.id,
      student_answer: "F = ma. For example, a 2 kg trolley pushed with 6 N accelerates at 3 m/s².",
      ai_suggested_marks: suggested,
      ai_feedback:
        "States the law correctly and gives a valid numeric example. Missing a unit check and a brief definition of net force for full marks.",
      awarded_marks: input.pendingReview ? null : suggested,
      approved_at: input.pendingReview ? null : input.submittedAt
    };
  });

  const { error: answersError } = await admin.from("answers").insert(rows);
  if (answersError) throw answersError;

  if (!input.pendingReview) {
    const snapshot = buildProgressSnapshot(answerInputs);
    const { error: snapshotError } = await admin.from("progress_snapshots").upsert({
      student_id: input.studentId,
      batch_id: input.batchId,
      test_id: input.testId,
      score_percent: snapshot.scorePercent,
      topic_breakdown: snapshot.topicBreakdown,
      created_at: input.submittedAt
    });
    if (snapshotError) throw snapshotError;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
