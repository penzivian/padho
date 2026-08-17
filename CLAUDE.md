# CLAUDE.md — Coaching Platform (Phase 0)

> This file is auto-loaded by Claude Code every session. It is the single source of truth for project context. Keep it updated as the project evolves — when a phase completes or a convention changes, edit this file, not your memory.

**Last updated: 2026-07-28** (grading calibration; AI-doubts hole during a live test closed; AI cap month fixed to IST — see [Recent changes](#recent-changes-2026-07-28-grading-calibration)).

## Recent changes (2026-07-28 grading calibration)

**Subjective grading suggestions now few-shot on the teacher's own approved marks** for that same question, so over a term they converge on that teacher's standard instead of a generic rubric reading. Guardrail 1 is untouched — this improves the *suggestion*; a teacher still approves before `awarded_marks` and a snapshot are written.

- **`lib/calibration.ts`** is pure and unit-tested. The non-obvious part is `selectCalibrationExamples`: the naive "take the k most recent approved marks" is **wrong**, because on a question most of the batch did well on, every sample sits at full marks and the model learns "award full marks". It buckets by mark band and takes round-robin across bands. On a realistic skewed batch (30 students, 19 at full marks) naive returns `[5,5,5,5,5,5]` and band selection returns `[0,0,1,2.5,4,5]`. **Keep the banding even if everything else is restructured.** Deterministic — ties break by id, so a suggestion is reproducible.
- **`hasUsefulCalibration`** requires ≥3 examples *and* more than one distinct mark; otherwise the block is `""` and the prompt is byte-for-byte what it was before. That is what makes this safe to leave on globally rather than behind a flag — it switches itself on per question once a teacher has marked enough of it.
- **`lib/calibration-source.ts` deliberately uses the RLS-respecting client, not admin.** `answers_select_visible` grants a teacher only the answers on tests they own, so the query structurally cannot reach another teacher's marking — which is the semantics we want, since the point is to match *this* teacher's standard. The query filters `approved_at is not null` **and** `awarded_marks is not null` (a row can carry an AI suggestion with no approval), `test_submissions.submitted_at is not null`, and `questions.question_type = 'subjective'` (MCQ marks can be negative since 0008). It over-fetches 200 rows because selection is band-based.
- **No migration.** An optional partial index on `answers (question_id, awarded_marks) where approved_at is not null` is available if the query ever shows up slow.

### Two bugs found while in here

- **AI doubts were completely ungated during a live test.** `askDoubtAction` had no notion of a test at all, so a student mid-CBT could open `/student/doubts` in another tab and paste the exam question in. Now blocked, scoped as narrowly as possible: only while *that* student has an unsubmitted attempt on a test that is open right now.
- **`enforceAiLimit`'s monthly window was computed in the process's timezone**, so on Vercel (UTC) the cap rolled over at 05:30 IST on the 1st — the same defect shape as the test scheduled for 12:30 AM that went live at 6:00. `monthStartUtcIso()` in `lib/time.ts` now resolves it in IST. **`lib/nav-counts.ts` had the same window duplicated**, so the AI-credits meter in the profile menu disagreed with the cap that actually bites; both now share the helper.

Tests 66 → 84, green under `TZ=UTC`, `TZ=Asia/Kolkata` and `TZ=America/New_York`.

**Deliberately not built:** the question bank (`bank_questions` separate from `questions`, since papers must copy rather than reference), pgvector, ingest jobs. Revisit only once calibration has been live a week and there is a signal that retrieval is the bottleneck.

## Recent changes (2026-07-28 negative marking)

## Recent changes (2026-07-28 negative marking)

JEE/NEET-style marking: **+4 correct, −1 wrong, 0 unattempted**, authored in the paper builder.

- **`questions.negative_marks`** (migration `0008_negative_marking.sql`, **applied live**) stores the penalty as a **positive magnitude** — the amount to deduct — so no code has to reason about a double negative. `scoreMcqAnswer` turns it into the negative award. Checked `>= 0 and <= max_marks`.
- **An unattempted question is never penalised.** That is the JEE rule and the whole point: it keeps "skip if unsure" a real choice. Only a genuinely wrong answer deducts. MCQ-only — a written answer is never negatively marked.
- **Two constraints had to go, and both would have silently broken this.** `answers_non_negative_awarded_marks` rejected any negative award outright; `progress_score_range` rejected a net-negative percent. The score range is now `-100..100`, which is safe *because* `negative_marks <= max_marks` — the worst possible paper is every question wrong, i.e. exactly −100%.
- **`scoreSubmission` no longer clamps a persisted mark at 0.** It previously ran every stored mark through `normalizeSuggestedMark`, which floors at zero — that would have wiped every deduction the moment a snapshot was rebuilt (e.g. after an answer-key update). It now floors at the question's own penalty for MCQs, and still at 0 for subjective. `approveGradesAction` clamps the teacher's typed mark to the same range.
- **Apply-to-all** in the paper builder for both the marks and the penalty, plus per-question fields. Lowering a question's marks pulls its penalty down with it, so the DB check can never trip.
- Students are told before they answer: the instructions page carries a **Negative marking** row and an extra numbered instruction ("unanswered costs you nothing, so skip rather than guess blindly"), and the CBT header reads `+4 / −1`. `get_student_test_questions` returns `negative_marks` (return type changed, so the function is dropped and recreated). Both response views show `−1 if wrong`.
- Watch for `-0`: `-Math.abs(0)` produces it, and it would reach the database and render as "-0". `scoreMcqAnswer` guards the zero-penalty case explicitly.
- Tests 61 → 66. Verified end-to-end against the live DB: apply-to-all set 4 marks and −1 across the paper, the cap clamped an over-large penalty, and a real attempt scored correct **+4**, wrong **−1**, blank **0** → 3/12 = 25%, with the review page showing it. Verification data removed.

## Recent changes (2026-07-28 question order + paper fixes)

## Recent changes (2026-07-28 question order + paper fixes)

**Questions were coming out of a paper in a scrambled order.** `savePaperAction` inserts a whole paper in ONE statement, so every row gets an identical `created_at`; ordering by `created_at, id` therefore fell through to the **id — a random UUID**. On the owner's real 45-question paper, question 1 was being served as question 23.

- **Scoring was never affected.** Answers are stored and scored by `question_id`, and each is compared against *its own* `correct_answer` — never by position. Nothing needed re-grading; this was purely presentational. (Verified in-database before changing anything.)
- Migration `0007_question_position.sql` (**applied live**) adds `questions.position`, backfills it from `ctid` (these rows are append-only, so physical order is still the insert order), and both student RPCs now `order by q.position, q.created_at, q.id`. `savePaperAction` sets `position` from the array index; the grading page and the new responses page sort by it too. **Anything that lists a paper's questions must order by `position`.**
- **Deliberately no shuffling.** There is none anywhere in the codebase, and per-student randomised order is a *later* feature — if it is ever added it must not change `position`, since that is what the teacher's numbering and the pasted answer key both mean.
- **Answer keys can be added or corrected after a paper is saved** (`updateAnswerKeyAction`, paste box on `/teacher/papers`). Keys are numbered by `position` — the same numbering the student saw. Applying a key **re-scores already-submitted attempts**, except answers with `approved_at` set: a teacher's manual mark outranks the key, and snapshots are refreshed only for submissions already `graded`.
- **15-minute entry window.** `DeclarationGate` is a live client clock now: it ticks every second and **enables the Begin button at the exact start time with no reload** (the page is server-rendered once, so a student sitting on it would otherwise stay locked out). Inside `ENTRY_WINDOW_MS` (15 min) it reads as a waiting room. Upcoming tests finally have a **"View instructions" link** on `/student/tests` and the dashboard — previously an upcoming test had a countdown but no way in, which is what made the instructions page feel unreachable.
- **Teacher can read any student's responses** — `/teacher/tests/[testId]/responses/[studentId]`, linked from the results table *and* from the "Awaiting grading" list (ungraded students are not in the rank table, so that was the only way to reach them). Shows every question in paper order with the chosen option, the key, per-question marks, mark-for-review flags and teacher feedback.
- **Students get the same review of their own paper** — `/student/results/[testId]/responses` ("Check answers" on the tests list, the result page and the dashboard). Two gates, both required: the student must own a **submitted** attempt, and **the test must be over** (window ended or teacher-closed). The second gate is the important one — a student who finishes early would otherwise be handed the answer key while classmates are still writing. Students cannot SELECT `questions` at all (teacher-only policy), so the paper is read with the admin client only after both gates. **`rubric` and `ai_suggested_marks`/`ai_feedback` are deliberately not selected** — a rubric is the teacher's marking guide, and an AI mark is not final until approved. Available while still `pending`, showing "–" for marks the teacher has not approved yet.
- **Both results pages now filter `submitted_at is not null`** — an attempt in progress was leaking into the rank list.
- Tests 58 → 61; lint and build clean. Verified end-to-end against the live DB, then all verification data removed.

## Recent changes (2026-07-28 CBT test interface)

## Recent changes (2026-07-28 CBT test interface)

Replaced the take-test screen with an NTA/JEE-style CBT flow. The old screen rendered **every question in one `<form>` and submitted once** — answers lived only in browser DOM state, so a refresh, a flat battery or a dropped connection destroyed the whole attempt, and `TestCountdown` merely displayed time without submitting. That was the biggest risk in the product.

- **Attempts are server-persisted and resumable** (migration `0006_cbt_attempts.sql`, **applied live**). `startTestAction` creates the `test_submissions` row up front; **`submitted_at is null` is what marks an attempt in progress** (no new enum value — Postgres forbids *using* one in the transaction that adds it, which would force a two-step deploy). `saveAnswerAction` upserts one answer per question as the student works, and verifies the question actually belongs to the test's paper before writing.
  - **Every read that means "a finished attempt" must filter `submitted_at is not null`.** Already done in: teacher dashboard counts + to-grade list, `lib/nav-counts.ts`, the teacher tests page (`pending` vs the new `takingNow`), the grading page, and both student pages (`submittedByTest` / `inProgress`). Miss one and a student mid-test shows up as a graded/pending submission.
- **Closing and rescheduling.** `tests.closed_at` (a timestamp, not an enum value) drives it. `closeTestAction` ends the test *and finalizes any attempt still in progress* — otherwise those answers would sit unsubmitted forever and never reach the grading queue. `rescheduleTestAction` moves the window and clears `closed_at`, so saving a new time reopens a closed test. Students see a **closed** chip and a "Closed by your teacher" card.
- **`is_test_live` fixed while it was being touched.** It was **not end-bounded** — questions stayed fetchable forever after the window shut — and a `status = 'completed'` branch let a finished test serve questions again. It now means "open right now": scheduled, not closed, and inside the window. Callers (`get_student_test_questions`, `submissions_insert_student`) are unchanged.
- **Instructions + declaration** (`/student/tests/[testId]`) is now the door: paper-at-a-glance (count, marks, MCQ/descriptive split), numbered CBT instructions, and a declaration checkbox that gates the Begin button. **Readable before the test opens**, with the button disabled and a countdown running. Aggregates are read with the admin client *after* the RLS visibility gate — counts and marks only, never text/options/keys.
- **CBT shell** (`components/student/cbt-shell.tsx` + pure, unit-tested `lib/attempt.ts`): one question at a time, numbered palette, Save & Next / Save & Mark for Review / Clear Response / Previous / Next, live legend counts, a pre-submit summary dialog, a 5-minute warning, and **auto-submit at zero**. The client clock only drives display — `submitTestAction` re-derives the window server-side.
  - **Palette colours deliberately diverge from NTA.** NTA uses red for "visited, not answered"; this product never shows students red, so ochre carries that weight. Teal = answered, violet = marked for review, muted = not visited. Answered-and-marked counts as answered, matching NTA scoring.
  - Visiting a question writes a blank answer row — that is what turns a tile from "not visited" to "not answered", so **absence of a row is the only thing meaning "not visited"**.
- **Question numbering is now consistent between student and teacher.** Bulk-inserted papers share one `created_at`, so ordering by it alone is non-deterministic; the grading page had *no* ordering at all, so its "Question 3" could be a different question than the student's. It now sorts by `(created_at, id)`, matching `get_student_test_questions`.
- `SubmitButton` now combines its `disabled` prop with the pending state instead of letting a caller's `disabled` overwrite the double-submit guard.
- Verified end-to-end against the live DB with two seeded students: instructions → declaration gate (button disabled until checked) → palette states → **full page reload restored every answer and palette state from the server** → submit → correct auto-scoring (keyed MCQ 2/2, unanswered 0, subjective `null` → `pending`), then teacher **close with an attempt in flight banked that student's work**, and reschedule reopened it with the IST wall clock prefilled. Tests 55 → 58; lint and build clean. Verification data removed afterwards.

## Recent changes (2026-07-28 schedule timezone)

**A test scheduled for 12:30 AM went live at 6:00 AM.** `<input type="datetime-local">` submits a bare wall-clock string with no timezone, and `scheduleTestAction` did `new Date(value).toISOString()` — which resolves that string in **the server process's** zone. Node on Vercel runs UTC, so `2026-07-28T00:30` was stored as `00:30Z` (= 06:00 IST); the same input on the owner's Mac (IST) stored `19:00Z`. Same form, two different instants. `formatDateTime` had the mirror defect: `Intl.DateTimeFormat("en-IN")` with no `timeZone` renders in the *renderer's* zone, so a server component printed UTC while the browser printed IST for the same row.

- **`lib/time.ts`** is now the single source of truth: `APP_TIME_ZONE = "Asia/Kolkata"` plus `scheduleInputToUtcIso`, which resolves a `datetime-local` value in IST (via an `Intl` offset probe, two-pass so it stays DST-correct if the zone ever changes) and returns an absolute UTC instant. Malformed input returns `null` and the action rejects rather than storing a bad instant.
- `formatDateTime` pins `timeZone: APP_TIME_ZONE`, so server and client agree and the displayed time always means what the teacher typed. **Every wall-clock time in the app is IST** — the product serves Indian coaching institutes; do not reintroduce zone-dependent parsing or formatting.
- Schedule field is labelled "Schedule (IST)".
- Tests 52 → 55, and the suite is run under `TZ=UTC` and `TZ=America/New_York` as well as IST — the timezone tests fail against the old code under UTC, which is the case that shipped.
- The one already-affected live row (`PSAT sample`) was corrected by hand to the intended instant. Rows created before this fix on Vercel are 5h30m late; rows created on a local IST machine are correct.

## Recent changes (2026-07-27 test visibility + manual grading)

Two linked fixes for "I scheduled a test but it never reached the students."

- **Students could not see a test until the second it started.** `tests_select_visible` gated a student's SELECT behind `is_test_live()`, which is only true once `scheduled_at <= now()`. A scheduled test was therefore invisible to its batch until it went live, so the **Upcoming sections on `/student` and `/student/tests` could never populate** — scheduling looked like it did nothing. Migration `0005_test_visibility.sql` relaxes the policy to `is_test_teacher(id) or is_test_student(id)`. **Applied to the live project.**
  - **Row visibility ≠ question access.** `get_student_test_questions` keeps its `is_test_live()` check and `submissions_insert_student` keeps its own — neither was touched, so no answer key or question text reaches a student early. Verified in-database as a real student: old predicate showed 1 of 2 tests, new shows 2, and the RPC returns **0 rows** for the not-yet-started test.
  - RLS was silently acting as the "has it started?" gate, so **`submitTestAction` gained an explicit start-time guard** (it only checked `endsAt` before). `/student/tests/[testId]` renders a **waiting room** ("Not started yet" + countdown) instead of a blank form.
  - Student UI now distinguishes open / upcoming / missed: `openTests`, `firstOpenTestId` and the hero are scoped to tests whose window is actually open, and an upcoming card shows a "starts in" countdown rather than a Take-test button.
- **A paper with keyless MCQs can now be scheduled** — teachers grade those by hand. `scheduleTestAction` no longer hard-blocks (that check named the offending question numbers and refused). Instead the answer routes to the teacher:
  - `submitTestAction` writes `awarded_marks = null` (not `0`) for a keyless MCQ, and sends the submission to `pending` when *anything* needs a teacher (subjective **or** keyless MCQ) rather than only on subjective.
  - `scoreSubmission` now prefers a **persisted mark over re-deriving from the key** — otherwise the snapshot would overwrite the teacher's manual mark with 0. Keyed MCQs are unaffected (their persisted mark *is* the auto-score).
  - The subjective guardrail is untouched: AI still only suggests, and a teacher still approves before `awarded_marks` and a snapshot are written.
  - UI: schedule form annotates keyless papers ("· 25 to grade by hand") with a one-line explainer; the papers chip is now "manual grading", not "needs answer key"; the grading page flags each keyless MCQ with "no answer key · mark by hand".
- Verified end-to-end in the preview browser against the live DB: scheduled a 25-keyless-MCQ paper (previously rejected) into a batch, then confirmed as a seeded student that it appears under **Upcoming** with a countdown, the take page shows the waiting room, and questions are withheld. Tests 50 → 52, lint and build clean.

## Recent changes (2026-07-26 PDF extraction robustness)

Fix for "uploaded a paper, clicked Extract, nothing happened." Root cause: the key-free heuristic (`lib/extract.ts`, used whenever `AI_MOCK_MODE`/no Anthropic key) only recognized questions numbered `"1. "` (digit-period-space) with uppercase options, so papers numbered `Q1)` / `1)` (and/or lowercase `(a)` options) parsed to **zero** questions — and the resulting error rendered **buried in the Review & save card**, far below the Extract button, so it looked silent.

- **The real blocker was the answer-key split.** `extractDraftQuestions` cut the document at the *first* `/answer\s*key/i` match, but real papers mention the phrase in their preamble ("the answer key is supplied as a separate document"), which discarded the entire paper (on the owner's 45-question AML/KYC PDF: 852 of 19,149 chars kept → **0 questions**). Now `splitAnswerKeySection` scans *all* occurrences and only splits where questions already precede it **and** the tail parses as ≥2 key pairs; otherwise no split.
- **Inter-question furniture is stripped** (`stripBlockNoise`) so it can't be swallowed by the preceding question's last option: difficulty tags (`[ Hard ]`), `SECTION X | …` headers, and `——— END OF QUESTION PAPER ———`. Uppercase-only `SECTION` and 2+ dashes keep prose ("Section 5 of the Act", "analysts — Kiran") intact.
- **Option detection takes the longest *adjacent* A→B→C→D run** instead of anchoring on the first `A`, so a stem containing `'A. Rao, S. Mehta'` no longer hijacks the split.
- `QUESTION_MARKER` broadened to `/(?:[Qq]\.?\s*)?(\d{1,3})[.)]\s+/g` — accepts `1.`, `1)`, `Q1.`, `Q1)`, `Q.1)`. Still sequential-only (conservative). `OPTION_MARKER` accepts lowercase and period-delimited options, with a captured leading boundary (not a lookbehind — this module is imported by a client component, and `[\s\S]*` is used over the `/s` flag, since tsconfig targets < ES2018).
- Verified end-to-end against the owner's real 8-page PDF through the actual `unpdf` → `extractDraftQuestions` pipeline: **45/45 questions, all MCQ, all with exactly 4 clean options, zero residual noise.** Tests 44 → 50.
- `lib/ai.ts` extraction error is now specific: distinguishes a **scanned/no-text PDF** (needs an Anthropic key or manual entry) from a **format the heuristic missed** (hint: number questions `1.` / `1)` / `Q1)`).
- `components/teacher/paper-builder.tsx` renders the extract result (success/error) **inline under the Extract button**, not only in the Review card. Still key-free-only for images/scans — those need the AI path (`ANTHROPIC_API_KEY`).

## What this project is

A teacher-first coaching-management web platform for tutors and small coaching institutes, starting in Agartala, Tripura. Teachers create batches, add students, build/upload question papers, run tests, get AI-assisted grading, and track progress. Students join a batch by invite code, take tests, view their own progress, and ask AI doubts.

**Current phase: Phase 0 is functionally complete.** There is no public discovery/marketplace layer yet — that is a deliberate later phase. Do not build discovery, payments, WhatsApp, leaderboards, or multi-teacher institute hierarchies unless explicitly asked.

## Owner / working style

Senior software developer. Wants simple, concise, efficient code: clean structure, minimal unnecessary abstraction, attention to time/space complexity. Do not over-engineer. Match the existing patterns rather than introducing new ones. Before a non-trivial change, briefly state the plan and flag assumptions; don't silently guess on ambiguous requirements.

## Tech stack

- Next.js 14.2.35 (App Router) + TypeScript strict mode
- Tailwind CSS + shadcn-style local UI primitives in `components/ui`
- Supabase (Postgres + Auth + Storage)
- Anthropic Claude API via a thin adapter with a mock fallback
- `unpdf` for key-free local PDF text extraction (question-paper upload path when no Anthropic key is set)
- pnpm 10.14.0. Dev is now on macOS via a bootstrapped Node toolchain: `export PATH="$HOME/.local/nodetool/node-v24.14.0-darwin-arm64/bin:$PATH"` then `corepack pnpm@10.14.0 <cmd>`. (Historically Windows via `npm.cmd exec pnpm@10.14.0 ...`.)
- Deployed on **Vercel** (Hobby) with GitHub auto-deploy; email via **Brevo SMTP**. See [Deploy / live state](#recent-changes-2026-07-19-deploy--performance).

## Architecture conventions (follow these — they are already consistent across the codebase)

- **RLS is enforced at the database level**, not just in app code. Every table has explicit policies; security-definer helper functions (`is_batch_teacher`, `is_test_student`, `is_test_live`, etc.) back them. When adding tables, add policies in the same migration. Never rely on app-layer checks alone.
- **Defense-in-depth in server actions** (`app/actions.ts`): the pattern is to first confirm visibility through the RLS-respecting server client (e.g. select the row with the user-scoped client), then perform privileged work with the admin client only after that check passes. Preserve this pattern — do not reach for the admin client without a prior visibility gate.
- **Mutations use Next.js Server Actions**, not hand-rolled API routes.
- **Three Supabase clients, used deliberately**: `supabase-server` (user-scoped, RLS applies), `supabase-browser` (client components), `supabase-admin` (service role, bypasses RLS — only after a visibility check).
- **AI calls go through `lib/ai.ts`**. It returns deterministic mock data when `AI_MOCK_MODE` is on or no API key is set, so the whole app is usable offline. All AI JSON is validated with zod and retried once on parse failure. Keep new AI features inside this adapter with the same mock-first shape.
- **Pure logic lives in `lib/grading.ts`** (scoring, snapshot building) and is unit-tested. Keep business logic pure and testable where practical; the server actions orchestrate, the lib functions compute.
- **`lib/extract.ts` follows the same pure/testable pattern** for the key-free PDF path: a marker-based parser (question/option regexes over a flattened text stream, tolerant of PDFs that lose line breaks) plus an answer-key parser, both unit-tested and called from `lib/ai.ts`.

## Non-negotiable guardrails

- **Subjective grades are never finalized automatically.** AI produces a *suggestion* (`ai_suggested_marks`, `ai_feedback`); a teacher must approve/override before it becomes `awarded_marks` and a progress snapshot is written. This is a product trust requirement, not a technical preference. Do not add any path that auto-finalizes subjective marks.
- **Student-facing test questions must never expose answer keys or rubrics.** They are served only through the `get_student_test_questions` RPC, which omits `correct_answer` and `rubric` and checks the test is live. Do not add a code path that sends full question rows to students.
- **Never commit secrets.** `.env.local`, the Supabase service role key, and the Anthropic key stay in env only. `.gitignore` already covers this.
- **Per-teacher AI usage is capped** via `ai_usage_events` + `AI_MONTHLY_TEACHER_LIMIT` to prevent runaway API cost. New AI features must record usage and respect the limit.

## Implementation status (done)

Auth (email OTP via link + code, dev-only on-screen codes, Google Sign-In code path) + onboarding · teacher batch management (create, invite code with copy-to-clipboard, manual add by phone, remove, roster with avatar stack) · question papers (AI-generate, key-free PDF extraction via `lib/extract.ts` + `unpdf`, review/edit with an answer-key paste box, save) · tests (schedule with or without an answer key, teacher close/reschedule, visible to students from the moment they're scheduled, NTA-style CBT take screen with instructions + declaration, question palette, resumable server-persisted attempts and auto-submit) · grading (MCQ auto-score server-side, subjective AI-suggest + teacher approval) · progress snapshots + dashboards (both roles, animated topic bars) · single-turn AI doubt solving · profile page (view/edit name + phone) · top nav with role-aware links and a profile menu. Consistent pending/error states across all forms and AI actions. Unit tests pass (`pnpm test`, 20/20) — pure scoring helpers (including `findKeylessMcqs`), a full mixed multi-topic `buildProgressSnapshot`, the `lib/ai.ts` mock outputs, and the `lib/extract.ts` PDF-parsing heuristics (verified against a real 25-question uploaded PDF, not just synthetic fixtures). A manual full-cycle E2E script lives in `MANUAL_E2E.md`; a demo-data seed script lives in `scripts/seed-demo.ts`.

A real Supabase project is provisioned (`ap-south-1` Mumbai, ref in `.env.local`) with all migrations applied, and the app is **deployed live** (Vercel Hobby, GitHub auto-deploy, Brevo SMTP for login codes). See [Recent changes (2026-07-19)](#recent-changes-2026-07-19-deploy--performance) for the live URLs and remaining go-live gaps.

## Recent changes (2026-07-23 mobile bottom nav, activity strip, result bars)

Grafted three prototype refinements, each with a deliberate mobile/desktop split. No new deps/fonts, no backend/RPC/RLS/migration/AI changes. Verified: 44/44 tests (+4 `topic-segments`), lint, build; visual pass at 360/1440 in both themes — bottom nav + week strip on mobile only, top nav + full heatmap on desktop only, never both, no horizontal scroll, zero console errors.

- **Shared nav source** (`components/nav-config.ts`) — `STUDENT_NAV` / `TEACHER_NAV` (`{href, label, shortLabel?, icon}`) now feed both the desktop top nav (AppNav → NavLinks, labels only — icons dropped to avoid crossing the RSC boundary) and the new mobile bottom bar. Single source of truth so the two navs can't drift.
- **Mobile bottom tab bar** (`components/bottom-nav.tsx`) — fixed, `md:hidden`; the top nav's link row is now `hidden md:flex`, so exactly one shows per breakpoint. Role-aware tabs (Home/Tests/Practice/Doubts · Home/Batches/Papers/Tests), lucide icon + 11px label, ≥56px targets, active tab in `text-primary`, routes via the shared `useTransition` nav-progress pattern, `env(safe-area-inset-bottom)`. **Hidden on the immersive `/{role}/(tests|practice)/[id]` screens** so it never collides with their sticky CTA. `.page-shell` gained `pb-24 md:pb-6` so the bar never covers the last card.
- **Responsive activity** — the ≤400-row practice scan moved to a `cache()`d `getStudentPracticeEvents` (`lib/student-practice-events.ts`) shared by both presentations (one query). Desktop keeps the full 12-week `StudentActivityHeatmap` (`hidden md:block`); mobile gets a compact current-week strip (`components/student-week-strip.tsx`, `md:hidden`) under the stat trio — `buildActivityCalendar(events, 1)` yields the Mon→Sun week, filled teal = active, today ringed, no new data source.
- **Segmented topic result bars** (`components/topic-segment-bar.tsx` + pure, unit-tested `lib/topic-segments.ts`) — a slim multi-segment bar under each result title on the student dashboard rows and the result page, built from the existing `topic_breakdown.percent`: teal ≥75, muted-teal 60–74, ochre <60 (never red). Empty breakdown renders nothing.

## Recent changes (2026-07-22 middleware, PWA, dark mode, landing)

Round-2 audit follow-up (all verified: 40/40 tests, lint, build; visual pass in preview at 360/1440 in both themes, zero console errors). New deps this pass: `@vercel/speed-insights`, `@vercel/analytics` (only ones permitted).

- **Session middleware** (`middleware.ts`) — was missing entirely. Binds a `@supabase/ssr` client to the request/response cookie pair and calls `getUser()` to refresh the token (server components can't write cookies, so sessions used to silently expire mid-use → bounce to `/auth`). **Session refresh only — `requireProfile` stays the authorization authority.** Matcher excludes `_next`, images, icons, `manifest.webmanifest`.
- **Scroll-jank fix** — replaced `body { background-attachment: fixed }` (full repaint every scroll frame on Android) with a fixed `body::before` gradient layer (composites). Sticky nav `backdrop-blur` now `sm:`-only; solid `bg-card` on mobile.
- **Per-nav query trimming + streaming** — the teacher to-grade badge + AI-credits counts moved to a `cache()`d `getTeacherNavCounts` (`lib/nav-counts.ts`) and stream via `<Suspense>` (`NavTeacherBadge`, `ProfileCredits`) so the nav shell paints immediately. `student/practice` awaits parallelized.
- **Dashboard section streaming** — the two heaviest, cleanly-separable bands stream via `<Suspense>`: teacher activity feed (`TeacherActivityFeed`, `loadActivityEvents` aggregates 3 tables) and student heatmap (`StudentActivityHeatmap`, the ≤400-row practice scan). Snapshot-derived bands (reteach radar, trend, impact strip) deliberately left in the page's single `Promise.all` — they share `snapshotData`, so splitting would duplicate fetches for no gain.
- **Measurement** — `@vercel/speed-insights` + `@vercel/analytics` mounted in `layout.tsx`; enable both in the Vercel dashboard after deploy. README note: judge further perf work from real TTFB/LCP, not feel.
- **PWA install** — `app/manifest.ts` (standalone, theme `#1a6b63`, bg `#eef0e7`) + SVG brand-mark icons (`public/icon.svg`, `public/icon-maskable.svg`) + apple-touch/iOS meta via the metadata API. **No service worker** (install prompt only). Icons are SVG (Android install fully works; a rasterized PNG apple-touch-icon is a follow-up if iOS home-screen polish matters — audience is Android-first).
- **Dark mode** — `.dark` token block in `globals.css` (same Calm Ledger palette inverted; body text ≥4.5:1 both themes), dark variants for `body::before` + the gradient utilities. `prefers-color-scheme` by default, manual toggle in the profile menu (`components/theme-toggle.tsx`), persisted in `localStorage`, applied **pre-paint** via a tiny inline script in `layout.tsx` (`<html suppressHydrationWarning>` to avoid the class-mismatch warning). Hardcoded light hexes that would break (LIVE-NOW hero card, low-score result chip) moved to `surface-teal` / `dark:` variants.
- **Landing page at `/`** — logged-out visitors now get a real door (brand split-panel matching the auth screen, one-line value prop, 3 feature points, Sign-in CTA) instead of an immediate redirect to `/auth`; logged-in users still redirect to their role dashboard. Auth-forward params (code/token_hash/error) still forwarded first.

## Recent changes (2026-07-19 deploy + performance)

- **Live deployment.** Repo `github.com/penzivian/padho` (private) → Vercel Hobby, auto-deploy on push to `main`. Production URL **`https://padho-three.vercel.app`**. Migration `0004_fix_practice_insert.sql` applied live (practice-attempts RLS insert fix — security-definer `can_practice_question`, replacing a policy that joined `questions`, which students can't SELECT).
- **Git author gotcha (resolved).** Vercel Hobby *blocks* deploys whose commit-author email isn't tied to the account's GitHub identity (surfaces as "Deployment Blocked" / an "Upgrade to Pro" Redeploy). Commits must be authored as `Supratim Deb <supratimdebshan@gmail.com>` — the repo's `git config user.email` is set to this. If a deploy is ever blocked on author again, that email isn't verified on GitHub.
- **Email = 6-digit code, not a link.** Brevo SMTP (`smtp-relay.brevo.com:587`; login is a Brevo-assigned `…@smtp-brevo.com` address, **not** the account email). Supabase auth templates (magic_link + confirmation) were edited to be **code-only** (`{{ .Token }}`, `mailer_otp_length=6`, no `{{ .ConfirmationURL }}`). Supabase auth config is managed via the **Management API** (`PATCH /v1/projects/{ref}/config/auth`, via `curl` — Python urllib hits Cloudflare 1010; `smtp_port` must be a **string** `"587"`).
- **Performance pass (fixes "navigation feels slow"):**
  - **Region pin** — added `vercel.json` `{"regions": ["bom1"]}` so serverless functions run in Mumbai, co-located with Supabase `ap-south-1` (was defaulting to `iad1`/US → every DB+auth round-trip crossed the planet). Biggest single latency win.
  - **Per-request auth dedupe** — `getCurrentProfile` in `lib/auth.ts` is now wrapped in React `cache()`, so `AppNav` and the page share one `auth.getUser()` + profile fetch instead of two each.
  - **Instant loading skeletons** — `components/ui/skeleton.tsx` + `components/page-skeleton.tsx` (generic shell matching `page-shell`) rendered via a `loading.tsx` in every navigable route; `.skeleton` pulse in `globals.css`, reduced-motion aware.
- **Design/mobile (2026-07-09→19):** dropped the Caveat cursive face for a clean ochre `.greeting-eyebrow` (Spectral/Public Sans/IBM Plex Mono only); fixed mobile horizontal overflow (nav `min-w-0`, `grid-cols-1` bases on the `lg:grid-cols-5` dashboard bands).
- **Perceived-performance + auth front-door pass (2026-07-19, second commit):**
  - `touch-action: manipulation` on all tappables (base layer) — kills mobile double-tap-zoom delay.
  - **Nav progress bar** — `NavLinks` routes through `useTransition` + `router.push`; a thin teal `.nav-progress` bar shows at the top while the server component streams (reduced-motion: static bar). Modified clicks (cmd/ctrl) still open new tabs.
  - Sign-out buttons (profile menu + `AppNav` fallback) gained pending states; every mutation in the app is now double-submit-proof via `SubmitButton`/`useFormStatus`.
  - **Auth page redesigned as the front door** (`/` redirects to `/auth`, so it's the first thing a shared link shows): desktop split panel — deep-teal brand panel (Spectral "Padho." display wordmark, tagline, "Made for tutors and small institutes · Agartala") beside a card-less form column on the sage gradient; mobile collapses to a brand header + single column. **Segmented 6-digit OTP input** (`components/otp-input.tsx`: auto-advance, backspace steps back, full-code paste fills all boxes, hidden input carries `token` for the unchanged server action; dev-code prefill still works). 48px inputs, 44px buttons, Google button unchanged. Verified in preview at 375px and desktop — no overflow, no console errors.
  - Note for future design prompts: external reviews may reference "Fraunces/Caveat" — those were the *old* fonts; the owner deliberately removed Caveat. Fonts are Spectral/Public Sans/IBM Plex Mono only.
- **Remaining go-live gaps** (owner will do): custom domain + **Brevo DKIM/SPF** (Gmail sender currently risks spam — the #1 signup blocker); enable Vercel **Speed Insights + Web Analytics** (both off) and error monitoring; run `MANUAL_E2E.md` against the live URL. Housekeeping: **rotate the secrets pasted during setup** (GitHub PAT, Supabase management token, Brevo SMTP key); confirm `DEV_LOGIN_CODES` is unset in Vercel env (also hard-disabled in prod by code).

## Recent changes (2026-07-09 activity feed + dashboard polish)

- **Real student-activity tracking** (was already real for submissions/joins — now comprehensive): unified feed derived on read from `test_submissions` + `batch_students` + `practice_attempts`, all via the RLS-respecting client so a teacher only sees their own students. Pure helpers in `lib/activity-feed.ts` (`aggregatePractice` collapses attempts to one event per student per day, `mergeFeed`, `feedText`) + tests; server loader `lib/teacher-activity.ts`; shared renderer `components/activity-feed-list.tsx`.
- **Activity history page** `/teacher/activity` — full chronological feed, linked from the dashboard "Recent activity" card via "View all →". Dashboard card shows action todos (grading/keyless/live) above the latest 5 feed events.
- **AI credits moved off the dashboard into the profile-menu popup** (`ProfileMenu` gained an optional `aiCredits` prop; `AppNav` computes it from `ai_usage_events` for teachers).
- **Dashboard warm-up** (owner: "too white") — added `.hero-gradient` / `.surface-gradient` / `.surface-teal` utilities; teacher dashboard now leads with a gradient hero band holding the greeting + quick actions (Create batch / Schedule test / New paper), gradient stat cards, a teal impact strip, and a "Create a new batch" affordance in the batches panel; balanced two-column body (batches + reteach radar | activity + trend). Tests 38 → 40.

## Recent changes (2026-07-08 Calm Ledger v2)

- **Visual refresh from the owner's Claude Design prototype** (`prototype/`, gitignored): fonts now Spectral (serif) / Public Sans (body) / IBM Plex Mono (chips, stat labels); exact prototype palette (`#1a6b63` teal, `#fffdf8` paper cards, `#e6dfce` sand borders, `#c98a3c` ochre accents, terracotta destructive); **sage gradient page background** (`#eef0e7 → #d3ded8`, fixed).
- **Header**: प brand mark, "Agartala · Phase 0" mono chip, name + role block beside the avatar, and a terracotta **to-grade count badge** on the teacher's Tests link (count query in `AppNav`).
- **Teacher dashboard** rebuilt to the prototype (top nav kept, sidebar deliberately not adopted): time-of-day script greeting, "✦ New paper" header primary, 4 uppercase-label stat cards (dark-filled **To grade**), "Your batches" rows (avg-score bar + copy chip) beside a **Recent activity feed** (action items with links first, then submissions/joins with `timeAgo`), and an **AI credits** meter fed by `ai_usage_events`.
- **Student dashboard**: LIVE NOW hero (mono eyebrow, tinted card, full-width CTA), prototype-style stat cards (teal avg %), result chips colored by score band. The **12-week heatmap stays** (the prototype's 1-week strip is a mobile compromise; owner wants the LeetCode grid on web).
- Verified end-to-end in the preview browser (auth → teacher cockpit → student dashboard). `.claude/launch.json` has `padho-dev` (Next dev) + `prototype-static` preview configs.

## Recent changes (2026-07-07 direction-first dashboards)

- **Student Tests section** — `/student/tests` (nav link) grouped Live now / Upcoming / Done with countdown chips; dashboard tests trimmed to the latest 4 + "All tests →".
- **Student dashboard is now a "Today" view** — hero card resolves to one action (live test with ends-in timer → next test with starts-in timer → practice nudge); practice **day-streak chip** (`lib/streak.ts`, grace day, tested); score-trend **sparkline** (pure SVG `components/sparkline.tsx`, draw-in animation, reduced-motion safe).
- **Teacher dashboard is a cockpit** — "Needs your attention" queue (ungraded submissions per test, keyless papers, live tests; max 4, each with an action link); **Reteach radar** (`lib/topics.ts`: marks-weighted 3 weakest topics, amber under 60%); batch-average trend sparkline.
- **Share with parent** — student result page opens the student's own WhatsApp with a prefilled result message via phoneless `wa.me/?text=` (`buildStudentShareMessage`); parents are the payer — every good result becomes teacher marketing.
- `TestCountdown` generalized (prefix/expired text) for "starts in" chips. Tests 29 → 36.
- **Activity heatmap (same day)** — LeetCode-style 12-week Monday-start calendar on the student dashboard (`lib/activity.ts` pure + tested, `components/activity-heatmap.tsx`): green teal intensity for practice answers + tests taken (test days get an amber outline), current-streak chip and best-run stat folded in (greeting chip removed — one source of truth). Sits as the right half of a hero/activity two-column band; ambient by design, never the page's focus. Tests 36 → 38.

## Recent changes (2026-07-06 results, ranks, WhatsApp, practice)

- **Results & ranks** — teacher `/teacher/tests/[testId]/results` (ranked table with top-3 accents, CSS score-distribution strip, per-row strongest topic) and student `/student/results/[testId]` (score, rank + percentile, delta, topic bars). Pure `lib/ranks.ts` (standard competition ranking, computed on read, never stored) + tests. Migration `0002` adds `tests.show_full_ranks` (default false); the top-3-vs-full-list gate is enforced **server-side** — the full list never ships to students unless the flag is on.
- **WhatsApp result delivery (zero-API)** — `lib/whatsapp.ts` builds warm bilingual-friendly messages + `wa.me` links (Indian number normalization; rank line only when ranks are visible; login-required result URLs, deliberately no public tokens). Per-row send buttons + "Copy all messages" on the results page. Business-API upgrade path noted in `README.md` — `buildResultMessage` is the seam.
- **Practice mode** — migration `0003`: `practice_sets` (papers reused, never cloned) + `practice_attempts` (effort log) with RLS, and the answer-key-safe `get_student_practice_questions` RPC. `checkPracticeAnswerAction` follows defense-in-depth: RLS-gated set visibility → admin key read → attempt recorded before any reveal. One-question-at-a-time session UI (`/student/practice`): streak counter, teal/amber never-red feedback states, sticky mobile check/next button, self-marked subjective rubric reveals, session summary. **Practice never touches `progress_snapshots`, ranks, or test stats** — that's a product boundary, keep it.
- Teacher side: "Publish as practice" per paper (+ unpublish), "practice answers this week" on the impact strip.
- `prefers-reduced-motion` now disables the bar/pop animations. Tests 20 → 29 (`ranks`, `whatsapp`, `practice`).

## Recent changes (2026-07-05 design psychology pass)

- **First-run experiences** — teacher dashboard shows a 3-step guided checklist (batch → paper → test) until the loop completes; student dashboard becomes a single "join your batch" hero until they're in a batch.
- **Results reveal** — students see each new graded result once as a celebration card (score, delta vs previous test, static encouragement line; seen-state in `sessionStorage`, no schema change, no AI calls).
- **Teacher impact strip** — tests taken / graded / ≈grading time automated / students improving, computed from RLS-visible data.
- **One primary action per screen** — quick actions, join form, and take-test buttons re-weighted so each screen directs instead of presenting options; nav tap targets enlarged; dev-code banner toned down to muted "local test mode"; privacy line added under the auth card.

## Recent changes (2026-07-05 correctness + deploy prep)

- **Keyless-MCQ footgun closed** — `scheduleTestAction` now blocks scheduling any paper containing MCQs without an answer key (they would silently auto-score 0), naming the offending question numbers in the `?error=`; check runs on the RLS-respecting client. Pure helper `findKeylessMcqs` added to `lib/grading.ts` (+ unit test, 19 → 20).
- **Early warning in the UI** — the papers list shows an amber "needs answer key" chip on any saved paper with keyless MCQs.
- **Deploy prep** — `.env.example` rewritten with per-var comments and `DEV_LOGIN_CODES` deliberately excluded; `README.md` gained a Deploy section (Vercel: Node 22+, `pnpm build`, `pnpm install --frozen-lockfile`; Supabase dashboard click-paths for Site URL, custom SMTP, and the "Magic link or OTP" template edit with `{{ .Token }}`).
- **`MANUAL_E2E.md` updated** — login steps cover local on-screen codes vs deployed email codes; extraction steps reflect real key-free PDF parsing; new guard-check step for keyless-MCQ scheduling; steps renumbered 1–25.

## Recent changes (2026-06-30 platform pass)

- **Real Supabase project provisioned and migrated** (`ap-south-1`) for local dev/demo use; `.env.local` points at it.
- **Auth hardened end-to-end** — `/auth/callback` handles both PKCE `code` and `token_hash` link styles and surfaces errors instead of looping; the home page forwards stray `?code=`/`?token_hash=` to the callback; URL-fragment errors (expired/used links) are now surfaced on `/auth` via a small client component. Added a `DEV_LOGIN_CODES` flag (dev-only, hard-disabled in production) that shows the login code on-screen for friction-free local testing. Added a Google Sign-In code path (`signInWithGoogleAction`); inactive until Google OAuth credentials are added in the Supabase dashboard.
- **Key-free PDF extraction shipped** — `lib/extract.ts` (marker-based parser, tolerant of PDFs that lose line breaks) + `unpdf` replace the old fixture-based mock extraction; verified against a real uploaded question paper (25/25 questions extracted correctly). The AI-vision extraction path in `lib/ai.ts` still applies when an Anthropic key is set.
- **`questions_mcq_shape` constraint relaxed** (migration + live DB) so an MCQ can be saved without a `correct_answer` — real uploaded papers often lack an embedded answer key. The Paper Builder gained an "apply answer key" paste box (`1:B, 2:C, ...`) to fill answers by position after the fact.
- **Full visual redesign** — cream/deep-teal "Padho." theme (serif headings, script accents) inspired by the owner's wireframes; sticky top nav with active-link highlighting; profile avatar menu + a dedicated `/profile` page; copy-to-clipboard invite-code chips; animated progress bars; tactile button press states.
- **Demo data** — `scripts/seed-demo.ts` (idempotent, additive) seeds 5 students, a batch, papers, tests (including one live test and one submission deliberately left pending review), and progress snapshots so the app can be explored with realistic data.
- Test suite grew 12 → 19 (added `tests/extract.test.ts`).

## Recent changes (2026-06-30 hardening pass)

- **AI model default updated** — `lib/ai.ts` defaults `ANTHROPIC_MODEL` to `claude-sonnet-4-6`; documented as an optional override in `.env.example` and `README.md`.
- **Extraction hardened** — `extractQuestionsFromFile` shares the validate-and-retry path with `generateQuestions` (`claudeValidatedJsonFromContent`, single retry, attachment preserved); mock branch unchanged.
- **Error/loading states tightened** — paper Generate/Extract and the remove-student button now show pending states; generation/extraction errors surface instead of being swallowed; `requestGradeSuggestionsAction` and `approveGradesAction` catch failures and report via `?error=`.
- **Test coverage expanded** — mixed multi-topic snapshot test + hermetic `lib/ai.ts` mock tests (`tests/ai.test.ts`); 6 → 12 tests.
- **Cleanup** — removed the unused `_actorId` param from `enforceAiLimit`; annotated its accepted TOCTOU race in-code.

## Known issues / tech debt (address opportunistically, not urgently)

- **Performance is now measurable — judge it from data, not perception.** Speed Insights + Analytics are mounted; once enabled in the Vercel dashboard, read real per-route TTFB/LCP before any further perf work. The obvious wins (region pin, middleware session refresh, Suspense streaming, scroll-jank fix) are done.
- `enforceAiLimit` has a check-then-insert race (TOCTOU) — fine at current scale and now documented in-code; revisit only if abuse appears.
- No automated **integration** test of the take-test → grade → snapshot cycle through the server actions (they need Supabase). The pure scoring pipeline and AI mock outputs are now unit-tested; `MANUAL_E2E.md` covers the full flow manually.
- **`DEV_LOGIN_CODES=true` is set in the local `.env.local`.** It mints and displays login codes on-screen, bypassing email delivery entirely — anyone reaching the app can sign in as any email while it's on. Hard-disabled whenever `NODE_ENV=production` regardless of the flag, but remove it from env before any real deployment.
- **Google Sign-In is wired but inactive** — needs OAuth credentials from Google Cloud Console pasted into Supabase Auth → Providers → Google. Until then the button shows a clean "provider not enabled" error.
- **Email delivery uses Supabase's default mailer**, which only sends a link (no visible code) and is rate-limited; the "Magic Link or OTP" template can't be edited until custom SMTP is configured in the Supabase dashboard. Fine for local/demo use with `DEV_LOGIN_CODES`; needs custom SMTP + an edited template before onboarding real users.

## Verification (run before considering any change done)

macOS (current):
```
export PATH="$HOME/.local/nodetool/node-v24.14.0-darwin-arm64/bin:$PATH"
corepack pnpm@10.14.0 test    # unit tests
corepack pnpm@10.14.0 lint    # eslint
corepack pnpm@10.14.0 build   # type-check + production build
```
(Windows equivalent: `npm.cmd exec pnpm@10.14.0 <test|lint|build>`.)

## Candidate next steps (pick explicitly; don't assume)

1. **Hardening pass — DONE (2026-06-30).** Model string fixed, extraction made resilient, error/loading states tightened, scoring-pipeline + AI-mock tests added, `enforceAiLimit` cleaned up.
2. **Platform bring-up + design pass — DONE (2026-06-30).** Real Supabase project provisioned and migrated; auth hardened with a dev-only on-screen-code fallback and a Google Sign-In code path; key-free PDF extraction; full redesign; demo data seed script. See [Recent changes](#recent-changes-2026-06-30-platform-pass).
3. **Production readiness — LARGELY DONE (deployed live 2026-07-19).** App is on Vercel with Brevo SMTP sending 6-digit codes, functions pinned to Mumbai, loading skeletons in place. Remaining before real onboarding: **custom domain + Brevo DKIM/SPF** (deliverability — top blocker), enable Vercel Speed Insights/Analytics + error monitoring, run `MANUAL_E2E.md` against the live URL, rotate setup secrets — then **put it in front of one real teacher**. See [Recent changes (2026-07-19)](#recent-changes-2026-07-19-deploy--performance).
4. **Phase 1** — student/parent polish, WhatsApp weekly reports, fee tracking, attendance (deferred features; only when chosen). Also queued: **WhatsApp Business API upgrade** (swap `wa.me` behind `buildResultMessage` when volume justifies it), **AI-coached practice feedback** (deliberately not built yet). *(Dark mode, the landing page at `/`, and Speed Insights/Analytics shipped 2026-07-22.)*
5. **Phase 3 (later)** — public discovery layer, once 8–10 institutes have real activity in the platform.
