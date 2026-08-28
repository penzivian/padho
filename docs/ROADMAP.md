# Roadmap — autonomous daily build

> **This file is the single source of truth for the daily autonomous run.** A fresh Claude
> session fires once a day, reads this file, does **exactly one** backlog item, verifies it,
> commits, pushes, updates this file, and stops. The container is ephemeral — nothing survives
> except what is committed here.

**Branch:** `claude/coaching-platform-phase0-tdg3bf` — all work goes here.
**Owner:** Supratim Deb. Commits must be authored `Supratim Deb <supratimdebshan@gmail.com>`
or Vercel Hobby refuses the deploy.

## Rules of engagement (read before doing anything)

1. **One item per run.** Do the first item that is `todo` and not blocked, **in file order** —
   the sections are sequenced deliberately (S1 must land before B1; L3 must land before anyone
   takes money). Finish it, then stop — even with budget left. This is a deliberate token-pacing
   constraint, not a suggestion.
2. **Read `CLAUDE.md` first**, especially "Working agreements" and "Non-negotiable guardrails".
   They override anything here.
3. **Verify before claiming done:**
   ```
   corepack pnpm@10.14.0 test && corepack pnpm@10.14.0 lint && corepack pnpm@10.14.0 build
   ```
   All three must pass. Never mark an item `done` on a red run.
4. **Migrations.** Supratim has approved automatic application, **additive only**
   (`add column`, `create table`, `create policy`, `create index`, `create or replace function`).
   **Never** drop a column, drop a table, delete rows, or alter a constraint in a way that could
   reject existing rows. `.env.local` points at PRODUCTION with real students.
   **In practice the scheduled runs have no Supabase MCP** — Routines created from inside a CCR
   session cannot carry connector grants, so the fired sessions start without `mcp__Supabase__*`.
   So the real procedure is: write the `.sql`, commit it, add a line under **Blocked on
   Supratim**, and carry on with a non-migration item. Check whether the tools exist before
   assuming either way. This costs almost nothing today — decision D1 means the whole of section
   A needs no migration at all, and section B needs none either.
5. **Delete verification data.** If you seed rows to verify against the live DB, remove them and
   confirm zero orphans before finishing.
6. **Never impersonate a real user.** `supratimdebshan@gmail.com` is the owner and fine.
   `adrisaha000@gmail.com` and the `sharma*` accounts are real people. Use `*.demo@padho.app`.
7. **If you hit a blocker**, write it under **Blocked on Supratim** with enough detail to act on,
   mark the item `blocked`, and stop the run. Do not burn budget guessing.
8. **Update this file every run** — item status plus one line in the Progress log.

## Status legend

`todo` · `in-progress` · `done` · `blocked`

---

## Design decisions (made once, do not re-litigate)

**D1 — Option images need no migration.** `questions_mcq_shape` (migration `0001`) only checks
`jsonb_typeof(options) = 'array'`. It does not require string elements, so an array of
`{text, image_path}` objects satisfies it unchanged. Only `types/database.ts` widens.

**D2 — An option's `text` is never empty.** When a teacher attaches an image to an option and
types no text, the builder fills `text` with the option letter (`"A"`, `"B"`, …). Reason:
`correct_answer` stores the option's *text* and `scoreMcqAnswer` compares strings — two options
with empty text would be indistinguishable and would silently mis-score. This keeps
`scoreMcqAnswer`, `applyAnswerKey`, `updateAnswerKeyAction` and the bank fingerprint untouched.

**D3 — The bank fingerprint ignores option images.** `lib/question-bank.ts` hashes normalized
stem + options. Hash the option **text only**. The same question re-extracted with a
differently-cropped diagram must still dedupe to one row.

**D4 — Rasterization stays client-side.** Server-side PDF rendering needs `@napi-rs/canvas`
(~30MB native) against a Vercel Hobby function budget. `components/teacher/diagram-cropper.tsx`
already rasterizes in the browser via a dynamic `unpdf` import; the vision path reuses it —
the browser renders pages to webp and posts the images to the server action.

**D5 — `image_url` is UI-only, never persisted.** Applies to options exactly as it does to
questions. Storing a URL leaks the diagram to anyone with the link, including before a test opens.

**D9 — A deliberately dark band must not use `bg-primary`.** The landing page's thesis band used
`bg-primary` / `text-primary-foreground`. In dark mode `--primary` resolves to a bright mint and
`--primary-foreground` to near-black, so the band inverted — the loudest element on the page
became a glowing turquoise slab. It is now pinned to the same `from-[#1a6b63] to-[#14544e]`
gradient the auth brand panel uses, with explicit light text, so it stays deep in both themes.
Any component meant to be dark regardless of theme needs literal colors, not semantic tokens
whose meaning flips.

**D7 — Nothing that calls `cookies()` belongs in the root layout.** `<AppNav />` sat there and
made *every* route dynamic, including the marketing page and the sign-in screen, for a component
that renders `null` when logged out. It now lives in per-section layouts. Anything added to
`app/layout.tsx` in future must be static, or `/` silently stops being statically rendered.
Watch for it in the build output: `○ /` is the signal, `ƒ /` means someone regressed it.

**D8 — A middleware redirect must carry the session cookies forward.** `NextResponse.redirect()`
builds a fresh response, which drops the refreshed cookies `getUser()` just wrote onto the
original — silently signing the user out on exactly the requests that redirect. `withCookies()`
in `middleware.ts` copies them across; use it for every redirect added there.

**D6 — Stay on Next.js + Vercel + Supabase. Do not migrate to Astro or Cloudflare.** Evaluated
2026-08-25 against the "micro tool site" stack (AstroJS + Cloudflare Pages). It solves the
opposite problem: Astro wins on public, static, SEO-fed content pages by shipping zero JS, while
almost every Padho route is authenticated, RLS-backed and dynamic — and the CBT shell, paper
builder and cropper are stateful React that would become Astro's worst case (islands). Migrating
also forfeits Server Actions, RSC and the middleware session refresh. Cloudflare's edge is
*further* from Supabase `ap-south-1` than the `bom1` pin in `vercel.json`, which was the single
biggest latency win the project has made. The one legitimate insight from that stack — that the
public marketing surface is a different engineering problem from the app — is captured in
sections S and L below, and Next handles it with a statically-generated route. Revisit only if a
real content/blog operation appears, and then as a separate site on a subdomain, never a rewrite.

---

## Backlog

### A — Diagrams in options (four graphs as the four answers)

- [x] **A1 · `lib/options.ts` + migrate the six read sites** — `done`
  - New pure module: `type QuestionOption = { text: string; image_path?: string | null }`, plus
    `normalizeOptions(raw: unknown): QuestionOption[]` accepting **both** legacy `string[]` and the
    new object form, and `optionText(o)`. Unit-tested.
  - Replace all six `typeof option === "string"` filters:
    `components/student/cbt-shell.tsx:141`, `app/actions.ts:727,1060,1168`,
    `app/teacher/tests/[testId]/responses/[studentId]/page.tsx:145`,
    `app/student/results/[testId]/responses/page.tsx:181`.
  - **Acceptance:** behaviour identical for existing string papers; tests/lint/build green.
    No UI change in this item.

- [x] **A2 · Serve option images** — `done`
  - Collect option `image_path`s into the existing `signQuestionImages` calls on the attempt page,
    both responses pages and the grading page. Render the image inside each option.
  - `get_student_test_questions` already returns `options` as jsonb — no RPC change needed.
  - **Acceptance:** verify against the live DB that an option image renders for a student mid-test
    and that the raw storage path returns HTTP 400 unauthenticated. Delete the verification data.

- [x] **A3 · Builder UI for option diagrams** — `done`
  - Per-option diagram slot in `components/teacher/paper-builder.tsx`, reusing `DiagramCropper`.
    Thumbnail after attach, remove button, D2's letter auto-fill.
  - **Acceptance:** crop from an uploaded PDF onto option B, save, reopen — image persists,
    `image_url` never reaches the database.

- [x] **A4 · Bank and shared library carry option images** — `done`
  - `savePaperToBankAction`, `searchBankAction`, `BankPicker` copy option images through.
    Sign them in the picker the same way question images are signed (RLS read first, then admin).
  - Implement D3 and add a test proving two identical questions with different option images
    produce the **same** fingerprint.

### S — Static public surface (do this **before** the landing rebuild)

- [x] **S1 · Make `/` static by moving the auth redirect into middleware** — `done`
  - Today **every route is `ƒ`** — dynamic, server-rendered per request. The only static asset in
    the whole build is `manifest.webmanifest`. That includes `/`, the one page Google will ever
    crawl: it calls `getCurrentProfile()` and waits on Supabase before it can paint, for every
    anonymous visitor.
  - `middleware.ts` already binds a Supabase client and calls `getUser()` on every request. Move
    the logged-in redirect (`/` → `/{role}`, or `/onboarding` with no profile) there, so
    `app/page.tsx` becomes a pure static page and renders as `○`.
  - **Risk — take this seriously.** The auth-param forwarding at the top of `app/page.tsx`
    (`?code=`, `?token_hash=`, `?error=`) exists because Supabase's redirect fallback lands on the
    site root, and CLAUDE.md records a past round of auth-looping bugs here. Either move that
    forwarding into middleware too, or keep `/` dynamic and stop — a fast landing page is not
    worth breaking sign-in.
  - **Acceptance:** `/` shows as `○` in the build output; a logged-out visitor sees the landing;
    a logged-in teacher still lands on `/teacher`; **and the full email-code login flow is
    exercised end to end** — request code, enter it, reach the dashboard.

### B — Landing page

- [x] **B1 · Rebuild the landing page** — `done`
  - `app/page.tsx` is 105 lines with three feature bullets. Rebuild denser but still calm:
    hero with one-line value prop, a three-step "how it works", a six-card feature grid, and the
    three differentiators from the positioning work (runs on your own papers · learns how *you*
    mark · a teacher approves every grade). Keep the auth-forwarding logic at the top **exactly**
    as-is — it handles Supabase redirect fallbacks.
  - Position on **ownership, not "AI"** (see the positioning artifact). No new dependencies,
    no new fonts — Spectral / Public Sans / IBM Plex Mono only.
  - **Acceptance:** builds clean, no horizontal scroll at 360px, correct in both themes.

- [x] **B2 · Landing polish and verification** — `done`
  - Responsive pass at 360 / 768 / 1440, both themes, reduced-motion respected, copy tightened,
    real screenshots or honest placeholders (never fabricated numbers — O3 does that and it reads
    as theatre when the live counter disagrees).

### L — SEO, error pages and legal (after the landing rebuild)

- [ ] **L1 · `robots.ts` and `sitemap.ts`** — `todo`
  - Neither exists, so nothing tells Google what not to index. Allow the public pages; disallow
    `/teacher/`, `/student/`, `/profile/`, `/onboarding`, `/auth`. Sitemap lists only the public
    routes. Use the App Router metadata files (`app/robots.ts`, `app/sitemap.ts`), matching the
    existing `app/manifest.ts` pattern.

- [ ] **L2 · Custom 404 and error boundaries** — `todo`
  - `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` are all absent, so an unhandled
    exception currently shows the stock Next page. The app has a loading skeleton on every route
    and no error state — close the gap using `components/page-skeleton.tsx` for visual continuity.
    Error pages must not leak stack traces to students.

- [ ] **L3 · Legal pages: privacy, terms, contact, refund** — `todo`
  - None exist. **This is a hard blocker on charging money:** Razorpay and every Indian payment
    gateway require a privacy policy, terms, refund policy and a contact page before approving a
    merchant account. Needed before the day-46 pricing step in the positioning plan, not after.
  - Static routes under `app/(legal)/`, linked from the landing footer. Keep them honest and
    specific — the app stores student names, phone numbers, answers and grades, and that is what
    the privacy policy has to describe.

### C — Filling the global library (vision ingestion)

> Supratim has said he will add `ANTHROPIC_API_KEY`. Build this so it is dormant without a key
> and lights up when one is set — never assume the key exists at build time.

- [ ] **C1 · Client rasterize → server vision extract** — `todo`
  - Reuse D4. Browser renders each PDF page to webp; a server action sends the page images to
    Claude and returns questions as JSON. Must call `enforceAiLimit` and `recordAiUsage`.
  - Key absent → the existing key-free path runs unchanged and the UI says why.
  - **This is the only thing that fixes scanned PYQs**, which is the library's real blocker.

- [ ] **C2 · Diagram bounding boxes from the vision pass** — `todo`
  - Extend C1's schema with a normalized `diagram_bbox` per question; crop it out of the page the
    browser already rendered and pre-fill the cropper so the teacher confirms rather than draws.

- [ ] **C3 · Library bulk-ingest UX + a written upload guide** — `todo`
  - Multi-file queue on `/teacher/library`, per-file progress, and `docs/LIBRARY_INGEST.md`
    covering exactly how to get a paper in.

---

## Blocked on Supratim

- **`PLATFORM_OWNER_EMAILS` must contain `supratimdebshan@gmail.com` in the Vercel production
  environment**, or `/teacher/library` denies everyone (it fails closed by design). Unverified —
  the daily run cannot read Vercel env. *Confirm this before the library work in C matters.*
- **`ANTHROPIC_API_KEY` not yet set in Vercel.** C1/C2 will be built dormant; they do nothing
  until the key is present. Supratim has said he will add one.
- **The daily Routine has no Supabase MCP** (`trig_01HqCWBWP6gvYiagVDv3Br1m`, fires 09:00 IST).
  Connector grants cannot be attached to a Routine created from inside a session. Nothing needs
  a migration until section C, so this is not urgent. To fix it, Supratim can recreate the
  Routine from the claude.ai Routines UI with the Supabase connector attached — or simply apply
  any committed `.sql` by hand at
  https://supabase.com/dashboard/project/rimkfjivabguavmuddxo/sql/new

## Progress log

Newest last. One line per run: date · item · outcome.

- 2026-08-25 · setup · Roadmap created; daily routine scheduled 09:00 IST. No code changes.
- 2026-08-25 · setup · Added sections S (static landing) and L (SEO/errors/legal) after auditing
  the public surface: every route builds as `ƒ`, and robots/sitemap/404/error/legal are all
  absent. Recorded D6 — staying on Next+Vercel, not migrating to Astro/Cloudflare.
- 2026-08-26 · infra · First scheduled run pushed nothing: fired sessions run unattended in auto
  permission mode and git was on no allowlist, so the push could never be approved. Added
  `.claude/settings.json` (project settings travel into every fresh container). Routine model
  switched to Opus 5; prompt now pushes an `in-progress` claim as a tripwire before building.
- 2026-08-26 · A1 · done. `lib/options.ts` + 10 tests; all six `typeof option === "string"` sites
  now go through it. Behaviour unchanged for existing string papers. 113 → 123 tests, green.
- 2026-08-26 · A2 · done. Option diagrams now render on the live attempt and both review pages.
  Option image paths ride along in the existing `signQuestionImages` call, so there is no extra
  round-trip. `CbtQuestion.options` is now `SignedQuestionOption[]` rather than raw `Json` — the
  client never handles a storage path. Grading page needed no change: it does not select
  `options`. 123 → 126 tests, green. **Live-DB verification still outstanding** (needs a seeded
  option-image question) — do it as part of A3 once the builder can create one.
- 2026-08-26 · A3 · done. `DraftQuestion.options` is now `DraftOption[]`, and the builder's
  one-option-per-line textarea became per-option rows with their own crop slot. Ripple was
  wider than the six read sites: extraction and the AI mock both emit strings and are
  normalized at the boundary; `toStoredOptions` strips the UI-only `image_url` so a URL can
  never reach the column; the bank fingerprint takes `optionTexts` (D3). **`questionListSchema`
  is deliberately NOT the draft shape** — it validates the JSON Claude returns over the wire,
  where options are strings, and `tests/ai.test.ts` no longer round-trips drafts through it.
  126 → 128 tests, green. Live-DB verification for A2+A3 still outstanding.
- 2026-08-26 · A4 · done. Option diagrams now survive the round-trip into the bank and the shared
  library, and `BankPicker` shows them. **Found and fixed a leak:** `publishToLibraryAction` wrote
  draft options straight through, so a `blob:` or signed `image_url` would have been persisted
  into the PUBLIC library column — `savePaperAction` was already safe because it builds its
  insert field by field, but options are passed whole. Both paths now go through
  `toStoredOptions`. D3 has a regression test: the same question re-cropped fingerprints
  identically, while two questions sharing a stem still separate. 128 → 130 tests, green.
  Section A complete.
- 2026-08-26 · S1 · done. `/` and `/_not-found` now build as `○`. **The landing page was never
  the blocker** — the ROOT layout rendered `<AppNav />`, which calls `getCurrentProfile()` →
  `cookies()`, making every route in the app dynamic. AppNav returns null when logged out, so on
  `/` and `/auth` it was pure cost with no output. It moved into four small section layouts
  (teacher/student/profile/onboarding); the root layout no longer touches cookies. The
  signed-in redirect and Supabase's auth-param fallback moved into `middleware.ts`, so the page
  no longer reads `searchParams` (which alone would keep it dynamic). See D7.
- 2026-08-26 · B1+B2 · done. Landing rebuilt: header, hero, the ownership trio, a numbered
  three-step "how it works", a six-card feature grid, the thesis band, footer. Positioned on
  ownership, never on "AI". No invented numbers or testimonials — O3's live counter says 14
  active streaks while its marketing block claims 3,210, and that gap is exactly what makes
  fabricated proof read as theatre. Verified by actually rendering it (headless Chromium against
  `next start`) at 360 and 1440 in both themes: no horizontal overflow at any size, correct
  heading order (1×h1, 3×h2, 9×h3), no console errors beyond the two `_vercel/*` analytics
  scripts that only exist on a Vercel deploy. `/` still builds `○` at 192 B. **One real bug
  found and fixed** — see D9.
