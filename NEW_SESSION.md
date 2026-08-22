# Starting a new session on this repo

Open Claude Code in this folder (`coaching-platform-phase0`) and paste the block below as
your first message. `CLAUDE.md` auto-loads, so the new session already has the full project
context, conventions, guardrails and history — this prompt only points it at the right part
and tells it what is in flight.

---

```
Read CLAUDE.md fully before doing anything — it is the source of truth for this project and
is auto-loaded, so you already have it.

Where things stand: Phase 0 is functionally complete and deployed (Vercel + Supabase,
ap-south-1). Everything is committed and pushed to main. The most recent work is listed
newest-first at the top of CLAUDE.md under "Recent changes".

Before you write code:
- Read the "Working agreements" section in CLAUDE.md. It carries the operational rules that
  are easy to get wrong: verify against the live database and delete verification data
  afterwards, never impersonate a real user account, .env.local points at PRODUCTION, don't
  run `pnpm build` while the dev server is running, and how to drive the preview browser.
- Read "Non-negotiable guardrails". The subjective-grading approval rule and the
  never-expose-answer-keys rule are product requirements, not preferences.
- Check "Candidate next steps" for what is actually queued.

How I work: I'm a senior developer. I want simple, concise, efficient code that matches the
existing patterns — don't over-engineer, don't introduce new patterns. Before a non-trivial
change, briefly state the plan and flag assumptions. If you find a real problem while you're
in there, tell me — several of the worst bugs in this project were found that way.

Verify before calling anything done:
  export PATH="$HOME/.local/nodetool/node-v24.14.0-darwin-arm64/bin:$PATH"
  corepack pnpm@10.14.0 test && corepack pnpm@10.14.0 lint && corepack pnpm@10.14.0 build

Commit author must be Supratim Deb <supratimdebshan@gmail.com> or Vercel refuses the deploy.

[Then say what you want done.]
```

---

## What does NOT carry over to a new session

These are environment/session state, not repo state, so a fresh chat starts without them:

- **Supabase MCP connection.** Usually fine. If its Postgres connection fails auth, apply
  migrations through the dashboard SQL Editor instead:
  `https://supabase.com/dashboard/project/rimkfjivabguavmuddxo/sql/new`
- **The dev server and browser preview.** The new session starts its own.
- **GitHub push credentials.** Already stored in the macOS keychain (classic PAT, `repo`
  scope), so pushes should just work.
- **Any in-flight verification data.** There is none right now — the database was left clean.
