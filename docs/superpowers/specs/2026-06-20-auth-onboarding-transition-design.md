# Auth Onboarding Transition Design

## Goal

Make login, signup, and password reset feel like the same stone workspace, not a separate SaaS form page. The transition should imply the dashboard is already waiting behind auth without mounting the full authenticated app before login.

## Approved Approach

Use a lightweight dashboard preview behind the auth form.

- The preview reuses the stone wall, distant terminal block, and faint dashboard rails.
- The auth form sits in the foreground as a compact stone/glass terminal card.
- On successful login, the foreground auth layer exits while the preview terminal scales forward.
- Navigation then lands on `/dashboard`, where the real workspace loads normally.

This avoids rendering protected dashboard data behind auth, keeps the login page fast, and still creates a seamless visual bridge.

## Surfaces

- `/login`: primary returning-user path.
- `/signup`: beta account creation path using the same shell with signup copy.
- `/forgot-password`: recovery path using the same shell with simpler copy.

## Interaction

- Submit buttons show the existing submitting state.
- Auth errors and success messages stay inline inside the card.
- Login success sets a short transition state before navigating.
- Reduced-motion users skip large transforms and use opacity-only transitions.

## Implementation Notes

- Keep backend/auth behavior unchanged.
- Do not mount `StonecodePrototype` behind auth.
- Add small focused auth shell components inside `src/App.tsx` unless extraction becomes necessary.
- Use CSS-only motion in `src/app/globals.css`.
- Preserve the existing stone-textured visual direction.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- Verify `/login`, `/signup`, `/forgot-password`, and successful login transition in browser when credentials are available.
