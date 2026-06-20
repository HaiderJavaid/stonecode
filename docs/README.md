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
- database/billing are scaffolded but not connected live.

## Commands

```bash
npm install
npm run dev
npm run build
npm run typecheck
```

`npm run lint` needs an ESLint 9 config before it can be required.
