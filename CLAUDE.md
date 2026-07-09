# CLAUDE.md — Coaching Platform (Phase 0)

> This file is auto-loaded by Claude Code every session. It is the single source of truth for project context. Keep it updated as the project evolves — when a phase completes or a convention changes, edit this file, not your memory.

**Last updated: 2026-07-08** (Calm Ledger v2 visual refresh from the owner's design prototype — see [Recent changes](#recent-changes-2026-07-08-calm-ledger-v2)).

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
- pnpm 10.14.0 (on Windows, invoked via `npm.cmd exec pnpm@10.14.0 ...`)

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

Auth (email OTP via link + code, dev-only on-screen codes, Google Sign-In code path) + onboarding · teacher batch management (create, invite code with copy-to-clipboard, manual add by phone, remove, roster with avatar stack) · question papers (AI-generate, key-free PDF extraction via `lib/extract.ts` + `unpdf`, review/edit with an answer-key paste box, save) · tests (schedule with a keyless-MCQ answer-key guard, student take via safe RPC, live countdown) · grading (MCQ auto-score server-side, subjective AI-suggest + teacher approval) · progress snapshots + dashboards (both roles, animated topic bars) · single-turn AI doubt solving · profile page (view/edit name + phone) · top nav with role-aware links and a profile menu. Consistent pending/error states across all forms and AI actions. Unit tests pass (`pnpm test`, 20/20) — pure scoring helpers (including `findKeylessMcqs`), a full mixed multi-topic `buildProgressSnapshot`, the `lib/ai.ts` mock outputs, and the `lib/extract.ts` PDF-parsing heuristics (verified against a real 25-question uploaded PDF, not just synthetic fixtures). A manual full-cycle E2E script lives in `MANUAL_E2E.md`; a demo-data seed script lives in `scripts/seed-demo.ts`.

A real Supabase project is provisioned (`ap-south-1`, ref in `.env.local`) with the migration applied — currently used for local dev/demo, not yet deployed.

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

- `enforceAiLimit` has a check-then-insert race (TOCTOU) — fine at current scale and now documented in-code; revisit only if abuse appears.
- No automated **integration** test of the take-test → grade → snapshot cycle through the server actions (they need Supabase). The pure scoring pipeline and AI mock outputs are now unit-tested; `MANUAL_E2E.md` covers the full flow manually.
- **`DEV_LOGIN_CODES=true` is set in the local `.env.local`.** It mints and displays login codes on-screen, bypassing email delivery entirely — anyone reaching the app can sign in as any email while it's on. Hard-disabled whenever `NODE_ENV=production` regardless of the flag, but remove it from env before any real deployment.
- **Google Sign-In is wired but inactive** — needs OAuth credentials from Google Cloud Console pasted into Supabase Auth → Providers → Google. Until then the button shows a clean "provider not enabled" error.
- **Email delivery uses Supabase's default mailer**, which only sends a link (no visible code) and is rate-limited; the "Magic Link or OTP" template can't be edited until custom SMTP is configured in the Supabase dashboard. Fine for local/demo use with `DEV_LOGIN_CODES`; needs custom SMTP + an edited template before onboarding real users.

## Verification (run before considering any change done)

```
npm.cmd exec pnpm@10.14.0 test    # unit tests
npm.cmd exec pnpm@10.14.0 lint    # eslint
npm.cmd exec pnpm@10.14.0 build   # type-check + production build
```

## Candidate next steps (pick explicitly; don't assume)

1. **Hardening pass — DONE (2026-06-30).** Model string fixed, extraction made resilient, error/loading states tightened, scoring-pipeline + AI-mock tests added, `enforceAiLimit` cleaned up.
2. **Platform bring-up + design pass — DONE (2026-06-30).** Real Supabase project provisioned and migrated; auth hardened with a dev-only on-screen-code fallback and a Google Sign-In code path; key-free PDF extraction; full redesign; demo data seed script. See [Recent changes](#recent-changes-2026-06-30-platform-pass).
3. **Production readiness — IN PROGRESS (code/config side done 2026-07-05; recommended next).** Code and docs are deploy-ready: clean production build, env checklist in `.env.example`, deploy guide in `README.md`. Remaining are the manual dashboard steps (Site URL, custom SMTP + OTP template edit, optional Google OAuth credentials) and the Vercel deploy itself — then run `MANUAL_E2E.md` against the deployed app and **put it in front of one real teacher**.
4. **Phase 1** — student/parent polish, WhatsApp weekly reports, fee tracking, attendance (deferred features; only when chosen). Also queued: **WhatsApp Business API upgrade** (swap `wa.me` behind `buildResultMessage` when volume justifies it), **AI-coached practice feedback** (deliberately not built yet), **dark mode** (students study at night).
5. **Phase 3 (later)** — public discovery layer, once 8–10 institutes have real activity in the platform.
