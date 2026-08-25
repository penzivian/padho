# Roadmap — autonomous daily build

> **This file is the single source of truth for the daily autonomous run.** A fresh Claude
> session fires once a day, reads this file, does **exactly one** backlog item, verifies it,
> commits, pushes, updates this file, and stops. The container is ephemeral — nothing survives
> except what is committed here.

**Branch:** `claude/coaching-platform-phase0-tdg3bf` — all work goes here.
**Owner:** Supratim Deb. Commits must be authored `Supratim Deb <supratimdebshan@gmail.com>`
or Vercel Hobby refuses the deploy.

## Rules of engagement (read before doing anything)

1. **One item per run.** Do the first item that is `todo` and not blocked. Finish it, then stop —
   even with budget left. This is a deliberate token-pacing constraint, not a suggestion.
2. **Read `CLAUDE.md` first**, especially "Working agreements" and "Non-negotiable guardrails".
   They override anything here.
3. **Verify before claiming done:**
   ```
   corepack pnpm@10.14.0 test && corepack pnpm@10.14.0 lint && corepack pnpm@10.14.0 build
   ```
   All three must pass. Never mark an item `done` on a red run.
4. **Migrations may be applied automatically** via the Supabase MCP — but **additive only**
   (`add column`, `create table`, `create policy`, `create index`, `create or replace function`).
   **Never** drop a column, drop a table, delete rows, or alter a constraint in a way that could
   reject existing rows, without asking Supratim first. `.env.local` points at PRODUCTION with
   real students. If the Supabase MCP is unavailable, commit the `.sql` file, add a line to
   **Blocked on Supratim**, and continue with a non-migration item.
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

---

## Backlog

### A — Diagrams in options (four graphs as the four answers)

- [ ] **A1 · `lib/options.ts` + migrate the six read sites** — `todo`
  - New pure module: `type QuestionOption = { text: string; image_path?: string | null }`, plus
    `normalizeOptions(raw: unknown): QuestionOption[]` accepting **both** legacy `string[]` and the
    new object form, and `optionText(o)`. Unit-tested.
  - Replace all six `typeof option === "string"` filters:
    `components/student/cbt-shell.tsx:141`, `app/actions.ts:727,1060,1168`,
    `app/teacher/tests/[testId]/responses/[studentId]/page.tsx:145`,
    `app/student/results/[testId]/responses/page.tsx:181`.
  - **Acceptance:** behaviour identical for existing string papers; tests/lint/build green.
    No UI change in this item.

- [ ] **A2 · Serve option images** — `todo`
  - Collect option `image_path`s into the existing `signQuestionImages` calls on the attempt page,
    both responses pages and the grading page. Render the image inside each option.
  - `get_student_test_questions` already returns `options` as jsonb — no RPC change needed.
  - **Acceptance:** verify against the live DB that an option image renders for a student mid-test
    and that the raw storage path returns HTTP 400 unauthenticated. Delete the verification data.

- [ ] **A3 · Builder UI for option diagrams** — `todo`
  - Per-option diagram slot in `components/teacher/paper-builder.tsx`, reusing `DiagramCropper`.
    Thumbnail after attach, remove button, D2's letter auto-fill.
  - **Acceptance:** crop from an uploaded PDF onto option B, save, reopen — image persists,
    `image_url` never reaches the database.

- [ ] **A4 · Bank and shared library carry option images** — `todo`
  - `savePaperToBankAction`, `searchBankAction`, `BankPicker` copy option images through.
    Sign them in the picker the same way question images are signed (RLS read first, then admin).
  - Implement D3 and add a test proving two identical questions with different option images
    produce the **same** fingerprint.

### B — Landing page

- [ ] **B1 · Rebuild the landing page** — `todo`
  - `app/page.tsx` is 105 lines with three feature bullets. Rebuild denser but still calm:
    hero with one-line value prop, a three-step "how it works", a six-card feature grid, and the
    three differentiators from the positioning work (runs on your own papers · learns how *you*
    mark · a teacher approves every grade). Keep the auth-forwarding logic at the top **exactly**
    as-is — it handles Supabase redirect fallbacks.
  - Position on **ownership, not "AI"** (see the positioning artifact). No new dependencies,
    no new fonts — Spectral / Public Sans / IBM Plex Mono only.
  - **Acceptance:** builds clean, no horizontal scroll at 360px, correct in both themes.

- [ ] **B2 · Landing polish and verification** — `todo`
  - Responsive pass at 360 / 768 / 1440, both themes, reduced-motion respected, copy tightened,
    real screenshots or honest placeholders (never fabricated numbers — O3 does that and it reads
    as theatre when the live counter disagrees).

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
  until the key is present.

## Progress log

Newest last. One line per run: date · item · outcome.

- 2026-08-25 · setup · Roadmap created; daily routine scheduled 09:00 IST. No code changes.
