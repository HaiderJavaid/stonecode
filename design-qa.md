# Landing Surface-System QA

## Evidence

- Auth surface source: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/23-auth-surface-reference.png`
- Dashboard wall source: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/24-dashboard-surface-reference.png`
- Previous landing: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/25-landing-surface-before.png`
- Desktop implementation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/26-landing-dashboard-auth-match.png`
- Card implementation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/27-landing-auth-style-panels.png`
- Mobile implementation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/28-landing-dashboard-auth-mobile.png`
- Full surface comparison: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/29-auth-dashboard-landing-comparison.png`
- Focused editor comparison: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-audit/30-hero-editor-wrapper-comparison.png`
- Source and desktop implementation pixels/CSS viewport: `1440x1000` at density `1`.
- Mobile implementation pixels/CSS viewport: `390x844` at density `1`.
- Comparison normalization: full views proportionally scaled to a common `500px` height; editor crops proportionally scaled to `680px` height.
- State: unauthenticated login, development dashboard capture, and unauthenticated landing.

## Fidelity review

- Fonts and typography: landing typography remains intentionally unchanged; this task's source scope is the shared Stonecode surface system.
- Spacing and layout: navigation keeps the landing information architecture but now uses the auth panel's radius, border, blur, and elevation. Desktop and mobile margins remain balanced.
- Colors and tokens: landing now uses the dashboard/auth `#292929` wall base, matching grain/grid density and dashboard vignette. Legacy landing-specific colored glows are disabled.
- Image and component fidelity: the hero remains live Stonecode DOM and CodeMirror. The middle editor now follows the real workspace structure—tabs directly above one `.editor-shell`—without an additional surrounding `StoneSurface`.
- Corners and masking: the angled cutout now clips through a `22px` rounded outer boundary before its right/bottom fade, preventing pointed outer corners.
- Cards and panels: navigation, pricing cards, signal panel, and footer CTA reuse the login card's frosted background, border, blur/saturation, radius, inset highlight, and shadow recipe.
- Copy and content: unchanged.
- Runtime: landing CTAs remain active; desktop/mobile captures rendered without application console errors.

## Comparison history

### Iteration 1

- P1: landing used a separate near-black gradient and different grain/glow treatment from the dashboard/auth wall.
- P1: the hero's center editor had a second panel wrapping the actual editor shell.
- P2: navbar and pricing cards used landing-only transparent surfaces rather than the login panel recipe.
- P2: the overall hero cutout mask could leave pointed outer corners.

Fixes: reused dashboard/auth wall and texture values; hid landing-only glows; applied the auth-card surface recipe to landing cards; removed the editor's outer `StoneSurface`; added rounded outer clipping to the cutout.

Post-fix evidence: desktop, pricing, mobile, full-comparison, and focused-comparison images listed above.

## Findings

No remaining actionable P0, P1, or P2 findings. The landing retains its requested top-left SideRays direction while sharing the underlying dashboard/auth material system.

## Final result

passed

## Scroll-transition regression — July 22, 2026

### Evidence

- User report: `/var/folders/d4/k9tdz8l13c79z2j4k874n8r00000gn/T/TemporaryItems/NSIRD_screencaptureui_I2xfaj/Screenshot 2026-07-22 at 7.58.37 PM.png`
- Before, desktop boundary: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-scroll-audit/02-before-boundary.png`
- After, desktop return scroll: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-scroll-audit/08-desktop-return-stable.png`
- After, desktop boundary: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-scroll-audit/09-desktop-transition-final.png`
- After, mobile boundary: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-scroll-audit/07-mobile-boundary.png`
- Normalized before/after comparison: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-scroll-audit/10-before-after-comparison.png`

### Findings and fixes

- P1: `SideRays` destroyed its WebGL renderer when the hero left the viewport, then rebuilt it on return. The renderer now initializes once, keeps its canvas, and skips rendering while offscreen.
- P1: the hero used a near-black blurred fade against the `#292929` landing wall, producing a visible rectangular seam. The fade now resolves into the shared wall color without a backdrop blur.
- P2: showcase section padding and first-row padding stacked into a large empty transition. The showcase entry spacing is now compact and continuous on desktop and mobile.

### Verification

- Desktop `1440x1000`: repeated down/up scroll keeps rays and hero stable; transition is continuous; no browser errors.
- Mobile `390x844`: proof row and first feature remain separated without overlap or an oversized gap.
- `npm run build`: passed.
- `npm run typecheck`: passed.

Final result: passed

## Landing global brand mark — July 28, 2026

- Reused the canonical `StonecodeLogoMark` component in the public navbar and footer lockups.
- Navbar mark is 24px inside the existing 62px control; footer mark is 30px.
- Desktop `1440x1000` and mobile `390x844`: no alignment regression or horizontal overflow.
- Browser console: no errors.

Final result: passed.

## Landing entrance cadence and sticky navigation — July 28, 2026

- Landing panel transitions increased from 920ms to 1240ms; sequential starts increased from 240ms to 340ms.
- First-load order verified as navbar -> hero copy -> workspace preview -> proof row -> SideRays.
- SideRays begin transparent/softened, start last, and resolve over 1600ms.
- Navbar is sticky at `top: 12px` with a dedicated layer above landing content and rays.
- Desktop `1440x1000`: sticky navbar remained at 12px while the first feature crossed underneath.
- Mobile `390x844`: sticky navbar remained at 12px with exact viewport width and no horizontal overflow.
- Browser console: no errors.

Final result: passed.

## Landing auth transition and replayable reveals — July 24, 2026

- Login, signup, hero, pricing, and footer auth links now share one route transition: visible panels slide outward, rays fade, and a black curtain completes before navigation.
- The exit class is applied synchronously on click so the transition starts reliably even while landing motion is active.
- Section reveal groups reset only after leaving the viewport completely, then replay in the same 240ms one-by-one sequence when revisited.
- SideRays now uses the approved gray/slate palette, `speed={5}`, `tilt={-17}`, monochrome saturation, and stronger blend/falloff.
- Desktop login and signup routes arrived after the 760ms exit; mobile signup showed a 0.95 black-curtain opacity mid-transition.
- Desktop replay check passed: visible -> fully reset -> visible again.
- Mobile `390x844`: exact viewport width (`390px`) with no horizontal overflow.
- Browser console: no errors.

Final result: passed.

## Landing alignment refinement — July 23, 2026

### Evidence

- Before hero/navigation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-alignment-audit/01-before-hero.png`
- Before pricing: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-alignment-audit/02-before-pricing.png`
- After hero/navigation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-alignment-audit/03-after-hero.png`
- After pricing: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-alignment-audit/04-after-pricing.png`
- Mobile hero/navigation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-alignment-audit/05-mobile-hero.png`
- Mobile pricing: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-alignment-audit/06-mobile-pricing.png`

### Findings and fixes

- P2: the hero used a `0.74 / 1.26` split and a larger heading than the feature sections. It now uses equal columns and the same `50.4px`, `520`-weight heading rhythm as the feature headings at the desktop QA viewport.
- P2: long rotating topics were reduced to `72%` size. They now retain the same heading size; `Learn Web Development` fits the reserved `600px` line without overflow.
- P2: the Login link had a fixed height without flex centering. Both navbar actions now use the same flex alignment, line height, and 34px control height.
- P2: pricing inherited centered card content and generic feature copy. Cards now use a left-aligned information hierarchy, divider, aligned check column, equal CTA position, and concrete entitlement language.

### Verification

- Desktop `1440x1000` and mobile `390x844`: passed with no browser errors.
- Mobile pricing remains one column and the page remains exactly viewport width.

Final result: passed.

## Responsive hero headline wrapping — July 23, 2026

- Long topics wrap only inside the hero copy column and move its supporting copy/actions downward.
- The desktop headline is hard-limited to `520px`; long targets render as a dedicated second line, leaving at least `99px` before the visible workspace panel in the `1440x1000` check.
- A reserved copy height keeps the workspace image, proof row, and hero boundary fixed while topics rotate.
- Removed the inherited decorative `::after` line that wrapped onto an unwanted extra row.
- Mobile hero type now follows the smaller responsive section scale; `Web Development` fits on its second line with the cursor attached.
- SideRays width is viewport-bounded, removing tablet horizontal overflow.
- Evidence: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-wrap-audit/01-tablet-wrapped-headline.png`, `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-wrap-audit/02-mobile-wrapped-headline.png`, and `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-wrap-audit/03-desktop-contained-headline.png`.

Final result: passed at `1024x800` and `390x844`.

## Dark plain landing wall experiment — July 23, 2026

- Landing wall changed from dashboard gray `#292929` to the auth-adjacent `#080909` shade.
- Stone texture/grid is disabled on the landing only; SideRays and the auth-style vignette remain.
- Hero image fade now resolves into the darker wall color without a rectangular boundary.
- Evidence: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-dark-audit/01-dark-plain-hero.png` and `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-dark-audit/02-dark-plain-feature.png`.

Final result: implemented for visual review.

## Landing hero, navigation, pricing, and footer — July 23, 2026

### Evidence

- Before hero: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-pricing-audit/01-before-top.png`
- Before pricing: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-pricing-audit/02-before-pricing.png`
- Before missing footer state: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-pricing-audit/03-before-footer.png`
- After hero/navigation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-pricing-audit/04-after-top.png`
- After pricing: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-pricing-audit/05-after-pricing.png`
- After footer: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-pricing-audit/06-after-footer.png`
- Mobile hero/navigation: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-pricing-audit/07-mobile-top.png`

### Findings and fixes

- P1: the footer used the center-band observer and could never intersect it at the page end. A dedicated bottom-edge observer now reveals it once and preserves reduced-motion behavior.
- P2: the hero stacked an eyebrow, animated headline, second headline, body, and actions. It now uses one animated heading plus one supporting sentence with the same weight and tracking system as later section headings.
- P2: the navbar was wider than the content grid with undersized labels and uneven columns. It now shares the `1240px` content width, uses exact three-column centering, and has larger aligned controls.
- P1: public pricing contradicted the requested two-tier model. The landing and billing settings now offer Free and $9 Pro only; Free entitlements expose complete paths/all learning modes with BYO OpenAI.

### Verification

- Desktop `1440x1000`: hero, navigation, two-card pricing, and footer passed.
- Mobile `390x844`: hero and navigation passed; horizontal page overflow removed.
- `npm run build`, `npm run typecheck`, `npm run verify:plan-limits`, and `npm run verify:subscription-state`: passed.
- Production dependency: update the Stripe Pro price to $9 before launch.

Final result: passed with one external pricing configuration task.

## Landing stagger timing — July 22, 2026

- Hero/nav panels reveal in DOM order on first load.
- Below-fold groups wait until their section intersects the middle 40% of the scroll container.
- Feature copy appears before its media; pricing heading and cards appear one by one.
- Timing: 920ms transition duration with 240ms staggered starts.
- One-time behavior remains: revealed panels do not hide or replay on return scroll.
- Reduced-motion behavior remains static.
- Evidence: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-stagger-qa/03-copy-first.png`
- Desktop and mobile browser checks produced no application errors.
- `npm run build`: passed.
- `npm run typecheck`: passed.

Final result: passed

## Landing reveal and boundary regression — July 22, 2026

### Evidence

- User report: `/var/folders/d4/k9tdz8l13c79z2j4k874n8r00000gn/T/TemporaryItems/NSIRD_screencaptureui_atEBlB/Screenshot 2026-07-22 at 8.17.59 PM.png`
- Desktop first load: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-motion-audit/04-after-top.png`
- Scroll reveal in progress: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-motion-audit/05-scroll-reveal.png`
- Wide transition after fix: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-motion-audit/08-wide-seam.png`
- Mobile transition after fix: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-motion-audit/10-mobile-seam.png`
- Normalized seam comparison: `/Users/kinghaider/Desktop/Coding/projects/stonecode/output/landing-motion-audit/13-before-after-seam.png`

### Findings and fixes

- P1: the angled workspace escaped below its grid cell at wide aspect ratios, placing course-progress UI behind the proof row. The stage now clips only its bottom boundary after fading to the wall.
- P1: SideRays began at the hero's top edge below the navbar, exposing a hard renderer/mask boundary. Rays now live behind both navbar and hero, originate slightly off-canvas, and fade on every outer edge.
- P2: public-page panels animated together only on mount. A one-time IntersectionObserver reveal now animates each panel as it first enters view and never replays on return scroll.
- Accessibility: `prefers-reduced-motion` renders all panels immediately without transitions.

### Verification

- Reveal progression: 3/13 panels at load, 6/13 at feature 1, 7/13 across later features, 10/13 at pricing, and 13/13 at page end; all 13 remain visible after returning to the top.
- Desktop `1440x1000`, wide `1680x900`, and mobile `390x844`: passed with no browser errors.
- `npm run build`: passed.
- `npm run typecheck`: passed.

Final result: passed
