# Coaching Phase 0

Teacher-first coaching management MVP built with Next.js App Router, TypeScript, Tailwind, shadcn-style UI components, Supabase, and Claude-compatible AI calls.

## Local Setup

1. Install dependencies.

   ```powershell
   npm.cmd exec pnpm@10.14.0 install
   ```

2. Create `.env.local` from `.env.example`.

   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ANTHROPIC_API_KEY=
   ANTHROPIC_MODEL=claude-sonnet-4-6
   AI_MOCK_MODE=true
   AI_MONTHLY_TEACHER_LIMIT=200
   # Optional, LOCAL DEV ONLY — shows login codes on the sign-in screen:
   # DEV_LOGIN_CODES=true
   ```

3. Apply the Supabase migration in `supabase/migrations/0001_phase0_schema.sql`.

   If the Supabase CLI is installed:

   ```powershell
   supabase db push
   ```

   Otherwise, paste the migration into the Supabase SQL editor for the target project.

4. Run the app.

   ```powershell
   npm.cmd exec pnpm@10.14.0 dev
   ```

## Phase 0 Flow

1. Teacher signs in with email or phone OTP and completes onboarding.
2. Teacher creates a batch and shares the generated invite code.
3. Teacher adds students by phone or students join with the invite code.
4. Teacher generates or uploads a paper, reviews the draft questions, and saves.
5. Teacher schedules a test from a saved paper.
6. Student takes the live test.
7. MCQs are scored server-side; subjective answers receive Claude suggestions.
8. Teacher approves marks before the student sees finalized progress.

## Verification

```powershell
npm.cmd exec pnpm@10.14.0 test
npm.cmd exec pnpm@10.14.0 lint
npm.cmd exec pnpm@10.14.0 build
```

## Deploy (Vercel + Supabase)

### Vercel (code/config)

- Framework preset: **Next.js**. Node version: **22.x or later** (the project builds on Node 24.14.0). pnpm is pinned by `packageManager` in `package.json` (`pnpm@10.14.0`) — Vercel picks it up via corepack.
- Build command: `pnpm build` · Install command: `pnpm install --frozen-lockfile` (Vercel's defaults for a pnpm Next.js repo are fine).
- Environment variables: set everything in `.env.example` with real values. **Do not set `DEV_LOGIN_CODES`** — it is a local-dev flag that displays login codes on the sign-in screen; the code path is also hard-disabled when `NODE_ENV=production`, but keep it out of deployed env entirely.

### Supabase dashboard (manual, one-time)

1. **Site URL** — Authentication → URL Configuration → set Site URL to the deployed domain (e.g. `https://your-app.vercel.app`). Without this, email sign-in links redirect to localhost.
2. **Custom SMTP** (required to edit email templates and lift the default mailer's rate limit) — Authentication → Emails → **SMTP Settings** → enable Custom SMTP and fill host/port/username/password/sender from your provider (e.g. Brevo free tier: host `smtp-relay.brevo.com`, port `587`; or Resend: host `smtp.resend.com`, port `465`, user `resend`, password = API key). Save.
3. **Show the OTP code in the email** — Authentication → Emails → **Templates** → open **“Magic link or OTP”** → make the body include the 6-digit token, e.g.:

   ```html
   <h2>Your login code</h2>
   <p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
   <p>Or click to sign in: <a href="{{ .ConfirmationURL }}">Log in</a></p>
   ```

   The default template is link-only; without this edit users never see a typeable code.
4. **Phone OTP (optional, not needed for launch)** — email OTP is the launch path. Configure an SMS provider under Authentication → Sign In / Providers → Phone only if you later want phone logins (students added by phone can't sign in until then).

## Performance — measure before optimizing

`@vercel/speed-insights` and `@vercel/analytics` are mounted in `app/layout.tsx`. After
deploying, enable both in the Vercel dashboard (Project → Speed Insights / Analytics — free
on Hobby) and, before making any further performance changes, read the **real** TTFB / LCP
per route from Speed Insights. The region pin (`bom1`), session middleware, and Suspense
streaming are in place; judge the next move from data, not from how the app "feels."

## WhatsApp result delivery — upgrade path

Result sharing uses wa.me click-to-chat deep links: messages send from the teacher's own
WhatsApp (no Meta business verification, no per-message cost). When volume justifies it,
swap the `buildWaLink` usage for a WhatsApp Business API provider (Gupshup/AiSensy) behind
the same `buildResultMessage` helper in `lib/whatsapp.ts` — that helper is the seam.

## Notes

- Phone OTP requires SMS provider configuration in Supabase.
- `DEV_LOGIN_CODES` must never be set in a deployed environment — it bypasses email delivery and shows login codes on-screen. It is hard-disabled in production builds, but treat it as local-only regardless.
- `ANTHROPIC_MODEL` is an optional override; it defaults to `claude-sonnet-4-6` when unset.
- `AI_MOCK_MODE=true` keeps question generation, extraction, grading, and doubts usable without an Anthropic key.
- Student-facing test questions are delivered through `get_student_test_questions`, which omits answer keys and rubrics.
- Do not commit `.env.local` or Supabase service role keys.
