# Stonecode Auth Email Setup

## Hosted Supabase

1. Open **Authentication → Email Templates → Confirm signup**.
2. Set the subject to `Your Stonecode verification code`.
3. Copy `supabase/templates/confirmation.html` into the template body and save.
4. Keep email confirmation enabled.

The template must retain `{{ .Token }}`. Stonecode displays a centered eight-digit verification modal after signup and calls Supabase `verifyOtp` before opening `/onboarding`; do not include a confirmation link in this template.

## Production Delivery

Configure custom SMTP in **Project Settings → Authentication → SMTP Settings**. Supabase's default sender is only suitable for limited development testing. Disable provider-level click tracking for auth emails so the confirmation URL is not rewritten.

## Smoke Test

1. Sign up with a real inbox and a display name.
2. Confirm the subject, Stonecode styling, personalized greeting, CTA, and fallback URL render correctly.
3. Enter the email’s eight-digit code in the centered Stonecode popup and confirm it creates a session at `/onboarding`.
4. Choose Free and verify `/dashboard?firstRun=1` opens.
5. Repeat with Pro and verify Stripe checkout returns to `/onboarding?checkout=success`.
