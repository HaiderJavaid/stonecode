# Stonecode Production Paid Beta Plan

This replaces the earlier local MVP plan. The historical Stage 3/4 local persistence work is complete.

## Goal

Ship Stonecode as a focused paid beta for self-taught beginners.

## Implementation Order

1. Refactor prototype into routed app/component structure.
2. Add required public/account/legal/support pages.
3. Connect Supabase Auth.
4. Move courses, files, chat, and progress from localStorage to Supabase.
5. Connect Stripe checkout, portal, and webhook persistence.
6. Enforce plan limits server-side.
7. Auth-gate tutor requests and record AI usage.
8. Add streaming tutor replies.
9. Add apply/reject flow for AI file edits.
10. Prepare production deployment and paid beta QA.

## Required Interfaces

- Supabase tables: `profiles`, `courses`, `workspace_files`, `chat_messages`, `course_progress`, `subscriptions`, `usage_events`.
- Routes: `/`, `/login`, `/signup`, `/forgot-password`, `/dashboard`, `/courses/:courseId`, `/settings/profile`, `/settings/account`, `/settings/billing`, `/settings/usage`, `/privacy`, `/terms`, `/support`.
- API routes: `/api/tutor`, `/api/billing/checkout`, `/api/billing/portal`, `/api/stripe/webhook`.

## Verification

- `npm run build`
- `npm run typecheck`
- browser route QA.
- auth isolation QA.
- Stripe webhook QA.
- AI usage tracking QA.
