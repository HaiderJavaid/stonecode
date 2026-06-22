# Stonecode Docs

## Read Order

1. `HANDOFF.yaml`
2. `PROJECT.md`
3. `TASKS.md`
4. `DECISIONS.md`
5. `project-architecture.md`
6. `ROADMAP.md`
7. `SESSION.md`
8. `superpowers/plans/2026-06-18-stonecode-mvp.md`

## Current Direction

Stonecode is moving from prototype to focused paid beta:

- audience: self-taught beginners.
- SaaS stack: Supabase + Stripe.
- core UX: persistent course workspace.
- required app pages now have routes.
- Supabase-backed workspace persistence is verified live, including `workspace_folders`.
- server-side Free plan course creation and reset behavior are enforced through `/api/courses`.
- billing is scaffolded but not connected live.
- current work is on `main`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
npm run verify:supabase
npm run verify:course-reset
npm run verify:plan-limits
```

`npm run lint` needs an ESLint 9 config before it can be required.
