# Manual E2E — Phase 0 full cycle

Run this against a real Supabase project + a running app (`pnpm dev` or a Vercel preview).
Covers: teacher signup → batch → 3 students → AI-generated paper + uploaded paper →
2 tests → student submissions → MCQ auto-score → AI grade suggestions → teacher approval →
both dashboards show trends.

## 0. Prerequisites (one-time)

- [ ] Apply the migration `supabase/migrations/0001_phase0_schema.sql` to the project.
      It creates all tables, RLS policies, the security-definer helpers, **and** the
      `question-paper-uploads` storage bucket + its per-user folder policies — no manual
      bucket creation needed.
- [ ] Set env (`.env.local` or Vercel): `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] **AI mode** — choose one:
      - **Mock (default):** leave `AI_MOCK_MODE=true` (or omit `ANTHROPIC_API_KEY`).
        Generation/grading/doubts return deterministic fixtures; **PDF extraction is real**
        (key-free local parsing of text PDFs — images/scans need the real API).
      - **Real:** set `ANTHROPIC_API_KEY` and `AI_MOCK_MODE=false`. `ANTHROPIC_MODEL`
        is optional (defaults to `claude-sonnet-4-6`).
- [ ] **Auth — pick the path for your environment:**
      - **Local dev:** set `DEV_LOGIN_CODES=true` — the login code is shown right on the
        sign-in screen, no email needed. (Never set this in a deployed environment.)
      - **Deployed:** configure custom SMTP + the "Magic link or OTP" template edit first
        (exact click-path in `README.md` → Deploy), so emails carry a visible 6-digit code.
      - Phone OTP and login by phone-added students need an SMS provider — see §7.

> Tip: use 4 separate browsers/profiles (or incognito windows) — Teacher, Student A,
> Student B, Student C — so sessions don't collide.

## 1. Teacher signup + onboarding

1. [ ] Open `/auth`. Enter the teacher's **email**, submit "Send OTP".
2. [ ] Enter the code — shown **on-screen** (local dev with `DEV_LOGIN_CODES=true`) or in
       the **email** (deployed, after the SMTP/template setup). You land on `/onboarding`.
3. [ ] Complete profile: name, optional phone, **Role = Teacher** → redirected to `/teacher`.
       - Expect: teacher dashboard with Batches/Papers/Tests metric cards (all 0).

## 2. Create a batch

4. [ ] `/teacher/batches` → "Create batch": Name, Subject, Exam → Create.
       - Expect: the batch card appears with a 7-char **invite code** (no I/O/0/1), "0 students".

## 3. Add / invite three students

Use a mix of both roster paths.

5. [ ] **Invite-code path (Students A & B — these will take tests):** in each student's
       browser, sign up at `/auth` via **email OTP**, onboard with **Role = Student**.
       On `/student`, enter the batch **invite code** → Join.
       - Expect: each lands back on `/student` with the batch listed under their memberships.
6. [ ] **Add-by-phone path (Student C — roster demo):** as the teacher, on the batch card
       use "Add student": name + phone → Add.
       - Expect: roster count increases and Student C appears with their phone.
       - Note: Student C is a placeholder account and can only **log in** via phone OTP,
         so C only takes a test if you've configured SMS (§7). Otherwise treat C as
         roster-only and use A & B for the take-test steps.
7. [ ] Confirm the roster now shows all three; use the trash button to remove and re-add
       once to sanity-check the remove path (button shows a spinner while working).

## 4. Build two papers

### 4a. AI-generated paper (must contain MCQ **and** subjective)

8. [ ] `/teacher/papers/new` → **Generate** card: fill Subject/Topic/Exam, Difficulty,
       Questions = 5, and **Mix**:
       - Real API: choose **Mixed**.
       - Mock: choose **Subjective** (the mock interleaves subjective + MCQ; the "Mixed"
         option in mock mode yields all-MCQ).
       Click **Generate** (button shows "Generating…").
9. [ ] In the **Review** pane, confirm a draft list appears. Ensure **at least one MCQ and
       one subjective** question — edit a question's Type if needed. Set Batch + Title.
10. [ ] **Save paper** (button shows "Saving"). Expect success message; draft clears.
        - Negative check: trigger a failure (e.g. blank Topic is required by the form; or in
          real mode temporarily use a bad key) and confirm the **error text is shown in the
          message box**, not swallowed.

### 4b. Uploaded paper

11. [ ] On the same page, **Upload** card: choose a **text PDF** → **Extract** (button shows
        "Extracting…"). Extraction is real in both modes: key-free local parsing without an
        Anthropic key, AI-vision with one. Images/scans need the real API.
12. [ ] Review the extracted questions. If the PDF had no embedded answer key, the MCQs
        have empty **Correct answer** fields — paste a key into the **Answer key** box
        (e.g. `1:B, 2:C, 3:A`) and click **Apply answer key**. Pick Batch + Title,
        **Save paper**.
13. [ ] `/teacher/papers` → expect **two** papers listed with correct source tags
        (`ai_generated`, `uploaded`) and question counts. Any paper saved with keyless MCQs
        shows an amber **"needs answer key"** chip here.

## 5. Schedule two tests

14. [ ] **Guard check first:** if you saved a paper with keyless MCQs, try scheduling it —
        expect a clear error naming the offending question numbers ("Questions 2, 4 are
        MCQs with no answer key…") and **no test created**. Fix the keys, then proceed.
15. [ ] `/teacher/tests` → "Schedule test": Batch, **Paper = the AI-generated (mixed) paper**,
        Title, Duration = 60, **Schedule = now** (or 1–2 min in the past) → Schedule.
16. [ ] Repeat for **Paper = the uploaded paper** (make this one effectively MCQ-only so you
        can see the auto-grade path: in 4b/Review, ensure all its questions are MCQ).
        - Timing matters: a test is takeable only while `scheduled_at <= now` **and**
          `now <= scheduled_at + duration`. "Now + 60 min" keeps both true during the run.
17. [ ] Expect both test cards on `/teacher/tests`, status `scheduled`, Pending = 0.

## 6. Students take the tests, grading, approval

18. [ ] **Student A** on `/student`: both tests show as **open**. Open the **MCQ-only test**,
        answer all MCQs, **Submit** (button shows "Submitting").
        - Expect: redirect to `/student`; that test now shows **graded** and a **Progress**
          card appears immediately (MCQ auto-scored server-side, snapshot written on submit).
19. [ ] **Student A**: open the **mixed test**, answer MCQs + write subjective answers, Submit.
        - Expect: that test shows **pending** (has subjective → no snapshot yet).
20. [ ] **Student B**: repeat 18–19 so there are multiple submissions to grade.
21. [ ] **Teacher** → `/teacher/tests` → the mixed test → **Grade**. For each submission:
        - [ ] Click **Suggest marks** (button shows "Asking Claude…"). Expect AI suggested
              marks + feedback to populate on the subjective answers. (If the monthly AI cap
              is hit, you should see a clear error on `/teacher/tests`, not a crash.)
        - [ ] Adjust/override the marks (try a value above max — it clamps to the question
              max), optionally add teacher feedback, click **Approve grades**.
        - Expect: submission flips to **graded**.
22. [ ] Confirm the **guardrail**: subjective marks only became `awarded_marks` after you
        approved — never auto-finalized.

## 7. Dashboards reflect correct trends

23. [ ] **Student A & B** `/student`: both tests show **graded**; **Progress** cards show a
        `score_percent` and a per-topic breakdown for each test. Spot-check the math:
        MCQ-only test should reflect exactly which MCQs were right; the mixed test should
        combine auto-scored MCQs with your approved subjective marks.
24. [ ] **Teacher** `/teacher`: Batches/Papers/Tests counts are correct; `/teacher/tests`
        shows Pending counts dropping to 0 as you approve.
25. [ ] **Doubts** (bonus): Student → `/student/doubts`, ask a question (button shows
        "Thinking…"). Expect a non-empty answer; on failure the error shows in the panel.

## SMS / phone-OTP note

Phone OTP is **not usable until you configure an SMS provider** in Supabase
(Dashboard → Authentication → Providers → Phone; e.g. Twilio/MessageBird/Vonage).
Two places depend on it:

- **Signing in with a phone number** (the `/auth` form routes any non-`@` contact to
  `signInWithOtp({ phone })` / `verifyOtp({ type: 'sms' })`).
- **Login for students added "by phone"** (Student C): the teacher's add creates a
  placeholder phone account; that student can only authenticate via phone OTP.

Until SMS is configured, run the whole flow with **email OTP** and treat phone-added
students as roster-only. Email OTP uses Supabase's built-in mailer (configure SMTP for
production volumes; the default is rate-limited but fine for this walkthrough).
