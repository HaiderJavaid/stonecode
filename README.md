# Stonecode

Persistent AI programming tutor workspace for a focused paid beta.

## Developer Handoff

Read first:

1. `docs/HANDOFF.yaml`
2. `docs/README.md`
3. `docs/PROJECT.md`
4. `docs/TASKS.md`
5. `docs/DECISIONS.md`
6. `docs/project-architecture.md`

## Current Direction

Stonecode is moving from prototype to production SaaS:

- audience: self-taught beginners.
- launch: focused paid beta.
- stack: Vite + React, Supabase, Stripe, OpenAI.
- core UX: dashboard -> course workspace -> persistent IDE/tutor state.

## Current App

- routed app shell in `src/App.tsx`.
- workspace shell in `src/components/stonecode/StonecodePrototype.tsx`.
- extracted workspace components/hooks under `src/components/stonecode` and `src/hooks`.
- Supabase schema scaffold in `supabase/schema.sql`.
- Stripe endpoint scaffolds in `server/stonecode-server.mjs`.

## Run

```bash
npm install
npm run dev
```

Then open the printed local URL.

## Verify

```bash
npm run build
npm run typecheck
```

`npm run lint` needs an ESLint 9 config.
