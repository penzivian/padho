# CLAUDE.md — Coaching Platform (Phase 0)

> This file is auto-loaded by Claude Code every session. It is the single source of truth for project context. Keep it updated as the project evolves — when a phase completes or a convention changes, edit this file, not your memory.

**Last updated: 2026-07-26** (key-free PDF extraction now handles `Q1)` / `1)` numbering + lowercase options; extract feedback surfaced at the button — see [Recent changes](#recent-changes-2026-07-26-pdf-extraction-robustness)).

## Recent changes (2026-07-26 PDF extraction robustness)

Fix for "uploaded a paper, clicked Extract, nothing happened." Root cause: the key-free heuristic (`lib/extract.ts`, used whenever `AI_MOCK_MODE`/no Anthropic key) only recognized questions numbered `"1. "` (digit-period-space) with uppercase options, so papers numbered `Q1)` / `1)` (and/or lowercase `(a)` options) parsed to **zero** questions — and the resulting error rendered **buried in the Review & save card**, far below the Extract button, so it looked silent.

- `QUESTION_MARKER` broadened to `/(?:[Qq]\.?\s*)?(\d{1,3})[.)]\s+/g` — accepts `1.`, `1)`, `Q1.`, `Q1)`, `Q.1)`. Still sequential-only (conservative). `OPTION_MARKER` now `[A-Ea-e]` + `[).]` (lowercase + period-delimited options). Verified against a real generated AML-style PDF through the actual `unpdf` → `extractDraftQuestions` pipeline: 0 → 2 questions. +2 unit tests (`tests/extract.test.ts`, 46 total).
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

Auth (email OTP via link + code, dev-only on-screen codes, Google Sign-In code path) + onboarding · teacher batch management (create, invite code with copy-to-clipboard, manual add by phone, remove, roster with avatar stack) · question papers (AI-generate, key-free PDF extraction via `lib/extract.ts` + `unpdf`, review/edit with an answer-key paste box, save) · tests (schedule with a keyless-MCQ answer-key guard, student take via safe RPC, live countdown) · grading (MCQ auto-score server-side, subjective AI-suggest + teacher approval) · progress snapshots + dashboards (both roles, animated topic bars) · single-turn AI doubt solving · profile page (view/edit name + phone) · top nav with role-aware links and a profile menu. Consistent pending/error states across all forms and AI actions. Unit tests pass (`pnpm test`, 20/20) — pure scoring helpers (including `findKeylessMcqs`), a full mixed multi-topic `buildProgressSnapshot`, the `lib/ai.ts` mock outputs, and the `lib/extract.ts` PDF-parsing heuristics (verified against a real 25-question uploaded PDF, not just synthetic fixtures). A manual full-cycle E2E script lives in `MANUAL_E2E.md`; a demo-data seed script lives in `scripts/seed-demo.ts`.

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
