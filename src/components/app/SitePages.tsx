import { MouseEvent as ReactMouseEvent, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeroWorkspacePreview } from "@/components/app/HeroWorkspacePreview";
import SideRays from "@/components/effects/SideRays";
import { StonecodeLogoMark } from "@/components/stonecode/StonecodeBrand";

type PublicPageMode = "landing" | "support" | "privacy" | "terms";
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@stonecode.app";

const landingLinks = [
  { href: "#courses", label: "Features" },
  { href: "#why-stonecode", label: "Why Stonecode" },
  { href: "#stories", label: "Stories" },
  { href: "#pricing", label: "Pricing" },
];

const supportCards = [
  {
    title: "Account access",
    copy: "Use password reset first. If access still fails, include the account email and the exact auth route that blocked you."
  },
  {
    title: "Billing issues",
    copy: "Open billing settings before contacting support. If Stripe portal or checkout fails, include the plan and the failure step."
  },
  {
    title: "Workspace bugs",
    copy: "Send the route, selected course, what you clicked, and whether files, chat, or progress diverged from expected state."
  },
  {
    title: "Tutor behavior",
    copy: "Include the last prompt, whether the tutor edited code or ran a file, and the exact output or bad explanation."
  }
];

export function LandingPage() {
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);
  const routeTimerRef = useRef<number | null>(null);
  usePublicPageMotion();

  useEffect(() => () => {
    if (routeTimerRef.current) window.clearTimeout(routeTimerRef.current);
  }, []);

  const handleLandingClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const pathname = new URL(anchor.href, window.location.href).pathname;
    if (pathname !== "/login" && pathname !== "/signup") return;

    event.preventDefault();
    if (isLeaving) return;
    event.currentTarget.classList.add("is-leaving");
    event.currentTarget.setAttribute("aria-busy", "true");
    setIsLeaving(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 760;
    routeTimerRef.current = window.setTimeout(() => navigate(pathname), delay);
  };

  return (
    <PublicPageShell isLeaving={isLeaving} mode="landing" onClickCapture={handleLandingClickCapture}>
      <section className="public-hero landing-grid landing-hero-board" aria-label="Stonecode landing hero">
        <div className="hero-copy panel-fade">
          <p className="hero-eyebrow">A computing school that adapts to you</p>
          <RotatingLearningHeadline />
          <p className="hero-body">
            Choose a goal. Stonecode turns it into a structured path, gives you the right learning workspace, and stays
            beside you until the ideas click.
          </p>
          <div className="public-actions" aria-label="Landing actions">
            <Link className="public-button is-primary" to="/signup">Start learning free</Link>
            <a className="public-button" href="#courses">See how it works</a>
          </div>
        </div>

        <div className="hero-product-stage panel-fade" aria-label="Stonecode dashboard preview">
          <HeroWorkspacePreview />
        </div>
        <div className="hero-proof panel-fade">
          <p className="trust-label">One workspace. Three ways to learn.</p>
          <div className="trust-row" aria-label="Stonecode learning experience types">
            <span>Courses</span>
            <span>Exercises</span>
            <span>Guided projects</span>
          </div>
        </div>
      </section>

      <section className="landing-section showcase-section" id="courses">
        <FeatureShowcase
          eyebrow="21 runnable technologies"
          title="Learn programming—and the ideas underneath it."
          copy="Choose from 21 runtime-backed technologies or study computer fundamentals, the internet and web, algorithms and data structures, or math for programmers."
          imageLabel="Personalized computing course preview"
          points={["21 reviewed runnable technologies", "Four computing foundations domains", "A path shaped around your goal"]}
          scene="modules"
          warmMedia
        />
        <FeatureShowcase
          eyebrow="Three learning modes"
          title="Learn your way, not one fixed way."
          copy="Follow a complete course, build one guided project, or sharpen a specific skill with an exercise pack. Practical paths use the persistent IDE; conceptual paths use lessons, quizzes, reviews, and tutor diagrams."
          imageLabel="Course, guided project, and exercise learning modes preview"
          points={["Full courses for structured depth", "Guided projects for learning by building", "Exercise packs for focused practice"]}
          scene="workshop"
          reverse
        />
        <FeatureShowcase
          eyebrow="Progress you can see"
          title="Turn every session into visible progress."
          copy="Verified exercises build language XP, activity streaks, and earnable badges. Your tracker shows what is improving and brings you back to the exact place you stopped."
          imageLabel="Language progress, streak, and badge tracker preview"
          points={["Language XP from verified work", "Streaks, achievements, and equipable badges", "Course progress preserved between sessions"]}
          scene="progress"
        />
      </section>

      <section className="landing-section comparison-board" data-reveal-group id="why-stonecode">
        <div className="section-copy panel-fade">
          <p className="panel-label">Why Stonecode</p>
          <h2>Stop rebuilding your learning system every day.</h2>
          <p>
            Tutorials, courses, and chatbots can all help. The hard part is turning scattered help into the right next
            lesson, useful practice, and progress that continues tomorrow.
          </p>
        </div>
        <div className="comparison-grid">
          {learningComparison.map((item) => (
            <article className={`comparison-card panel-fade${item.featured ? " is-stonecode" : ""}`} key={item.label}>
              <p className="panel-label">{item.label}</p>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              {item.points && (
                <ul>
                  {item.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section learner-proof-board" data-reveal-group id="stories">
        <div className="section-copy panel-fade">
          <p className="panel-label">Learner proof</p>
          <h2>Stories from real learners.</h2>
          <p>
            Stonecode is entering paid beta. Verified learner stories and an aggregate rating will appear here after
            enough real people have used the product—never as placeholder praise.
          </p>
          <Link className="public-button is-primary" to="/signup">Join the founding learners</Link>
        </div>
        <div className="learner-proof-grid">
          <article className="learner-proof-card panel-fade">
            <span className="rating-stars" aria-hidden="true">☆ ☆ ☆ ☆ ☆</span>
            <p className="panel-label">Verified ratings</p>
            <h3>Published when they are real.</h3>
            <p>Only feedback from Stonecode learners will contribute to the public rating.</p>
          </article>
          <article className="learner-proof-card panel-fade">
            <p className="panel-label">Founding cohort</p>
            <h3>Your progress can become the proof.</h3>
            <p>Start free, learn in the full workspace, and help shape the experience before the public launch.</p>
          </article>
        </div>
      </section>

      <section className="landing-section pricing-board" data-reveal-group id="pricing">
        <div className="section-copy panel-fade">
          <p className="panel-label">Pricing</p>
          <h2>Start free. Upgrade when momentum demands more.</h2>
          <p>Every account includes 10 creation Stones. Pro adds more paths, more tutor access, and 100 Stones each billing cycle.</p>
        </div>
        <div className="pricing-grid">
          {pricingPlans.map((plan) => (
            <article className={`price-card panel-fade${plan.featured ? " is-featured" : ""}`} key={plan.name}>
              <div className="price-card-head">
                <div>
                  <h3>{plan.name}</h3>
                  <p>{plan.tagline}</p>
                </div>
                {plan.badge && <span>{plan.badge}</span>}
              </div>
              <div className="price-line">
                <strong>{plan.price}</strong>
                <small>{plan.unit}</small>
              </div>
              <ul>
                {plan.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <Link className={`public-button${plan.featured ? " is-primary" : ""}`} to={plan.href}>
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section about-board" data-reveal-group id="about">
        <div className="about-copy panel-fade">
          <div className="section-copy">
            <h2>Programming understanding matters more in the AI era.</h2>
          </div>
          <p className="panel-body">
            AI can produce code in seconds. The advantage belongs to people who can read it, test it, change it, and
            know when it is wrong.
          </p>
          <p className="panel-body">
            Stonecode builds that judgment through structured learning, hands-on practice, contextual guidance, and
            one workspace that remembers your lessons, files, conversations, and progress.
          </p>
          <div className="stats-row">
            {aboutStats.map((stat) => (
              <div className="stat-block" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="signal-map panel-fade" aria-hidden="true">
          <i className="ring ring-one" />
          <i className="ring ring-two" />
          <i className="ring ring-three" />
          <i className="dot dot-one" />
          <i className="dot dot-two" />
          <i className="dot dot-three" />
        </div>
      </section>

      <section className="landing-section footer-cta panel-fade" id="docs">
        <div>
          <h2>Stop collecting tutorials. Start building understanding.</h2>
          <p>Begin with a complete course, one guided project, or focused practice. Your first 10 Stones are included.</p>
        </div>
        <div className="cta-links">
          <Link className="public-button" to="/support">Support</Link>
          <Link className="public-button" to="/privacy">Privacy</Link>
          <Link className="public-button is-primary" to="/signup">Start learning free</Link>
        </div>
      </section>
    </PublicPageShell>
  );
}

export function SupportPage() {
  usePublicPageMotion();
  const [copied, setCopied] = useState(false);
  const diagnosticId = useMemo(() => globalThis.crypto?.randomUUID?.() ?? `SC-${Date.now().toString(36).toUpperCase()}`, []);
  const topic = new URLSearchParams(window.location.search).get("topic") ?? "Stonecode support request";
  const supportHref = `mailto:${supportEmail}?subject=${encodeURIComponent(topic)}&body=${encodeURIComponent(`Diagnostic ID: ${diagnosticId}\nRoute: ${window.location.pathname}\n\nWhat I did:\n\nExpected:\n\nActual:\n`)}`;

  async function copyDiagnosticId() {
    await navigator.clipboard.writeText(diagnosticId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <PublicPageShell mode="support">
      <section className="public-page-hero panel-fade">
        <div>
          <p className="panel-label">Support</p>
          <h1>Keep the workspace stable enough to keep learning.</h1>
          <p className="hero-body">
            Paid-beta support is focused on account access, billing issues, course persistence, and tutor behavior
            that blocks real course progress.
          </p>
        </div>
        <aside className="support-sidecard">
          <span>Best reports include</span>
          <ul>
            <li>Route and course name</li>
            <li>Exact action taken</li>
            <li>Expected vs actual result</li>
            <li>Whether learning is blocked</li>
          </ul>
        </aside>
      </section>

      <section className="support-card-grid">
        {supportCards.map((card) => (
          <article className="public-panel mini-support-card panel-fade" key={card.title}>
            <p className="panel-label">{card.title}</p>
            <h2>{card.title}</h2>
            <p>{card.copy}</p>
          </article>
        ))}
      </section>
      <section className="public-panel support-contact panel-fade" aria-labelledby="support-contact-title">
        <div>
          <p className="panel-label">Contact support</p>
          <h2 id="support-contact-title">Send one report we can trace.</h2>
          <p>Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> and include the reference shown in any error.</p>
        </div>
        <div className="support-contact-actions">
          <code>{diagnosticId}</code>
          <button className="public-button" onClick={() => void copyDiagnosticId()} type="button">{copied ? "Copied" : "Copy diagnostic ID"}</button>
          <a className="public-button is-primary" href={supportHref}>Email support</a>
        </div>
      </section>
    </PublicPageShell>
  );
}

export function LegalPage({ type }: { type: "privacy" | "terms" }) {
  usePublicPageMotion();
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy" : "Terms";
  const description = isPrivacy
    ? "How Stonecode handles account, workspace, billing, and tutor data during the paid beta."
    : "The operating rules for beta access, AI usage, billing, and acceptable product behavior.";

  return (
    <PublicPageShell mode={type}>
      <section className="public-page-hero legal-hero panel-fade">
        <div>
          <p className="panel-label">{title}</p>
          <h1>{title}</h1>
          <p className="hero-body">{description}</p>
        </div>
        <aside className="support-sidecard">
          <span>Effective for paid beta</span>
          <p>Effective July 31, 2026. Questions: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
        </aside>
      </section>

      <article className="legal-stack">
        {(isPrivacy ? privacySections : termsSections).map((section) => (
          <section className="public-panel legal-card panel-fade" key={section.title}>
            <p className="panel-label">{title}</p>
            <h2>{section.title}</h2>
            <p>{section.copy}</p>
          </section>
        ))}
      </article>
    </PublicPageShell>
  );
}

function PublicPageShell({
  children,
  isLeaving = false,
  mode,
  onClickCapture
}: {
  children: ReactNode;
  isLeaving?: boolean;
  mode: PublicPageMode;
  onClickCapture?: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  return (
    <main
      aria-busy={isLeaving || undefined}
      className={`site-shell public-shell is-${mode}${isLeaving ? " is-leaving" : ""}`}
      onClickCapture={onClickCapture}
    >
      <StoneTexture />
      {mode === "landing" && <LandingSideRays />}
      <header className="public-nav panel-fade">
        <Link className="site-mark" to="/">
          <StonecodeLogoMark className="public-brand-mark" />
          <span>stonecode</span>
        </Link>
        <nav aria-label="Primary">
          {mode === "landing" ? (
            <>
              {landingLinks.map((item) => (
                <a href={item.href} key={item.label}>{item.label}</a>
              ))}
            </>
          ) : (
            <>
              <Link to="/">Home</Link>
              <Link to="/support">Support</Link>
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
            </>
          )}
        </nav>
        <div className="public-nav-actions">
          <Link className="public-nav-link" to="/login">Log in</Link>
          <Link className="public-button is-compact" to="/signup">Get started</Link>
        </div>
      </header>
      {children}
      <footer className="public-footer panel-fade" data-reveal-edge>
        <div className="footer-brand">
          <div className="footer-brand-lockup">
            <StonecodeLogoMark className="public-brand-mark footer-brand-mark" />
            <strong>stonecode</strong>
          </div>
          <span>Personalized AI computing tutor for learning, practice, projects, and progress.</span>
        </div>
        <div className="footer-columns">
          <div>
            <p>Product</p>
            <a href="#courses">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div>
            <p>Resources</p>
            <Link to="/support">Support</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
          <div>
            <p>Status</p>
            <span>Supabase persistence verified</span>
            <span>Stripe plan sync live</span>
            <span>Tutor usage tracked</span>
          </div>
        </div>
      </footer>
      {mode === "landing" && <div className="landing-route-curtain" aria-hidden="true" />}
    </main>
  );
}

function LandingSideRays() {
  return (
    <div className="landing-side-rays-shell" aria-hidden="true">
      <SideRays
        className="landing-side-rays-canvas"
        rayColor1="#888484"
        rayColor2="#94a3b8"
        origin="top-left"
        speed={5}
        intensity={2}
        spread={2}
        tilt={-17}
        saturation={0}
        blend={0.95}
        falloff={3.5}
        opacity={1}
        maxDpr={1.25}
        fps={30}
      />
    </div>
  );
}

function StoneTexture() {
  return (
    <>
      <div className="site-stone" aria-hidden="true" />
      <div className="site-glow glow-one" aria-hidden="true" />
      <div className="site-glow glow-two" aria-hidden="true" />
    </>
  );
}

function FeatureShowcase({
  copy,
  eyebrow,
  imageLabel,
  points,
  reverse = false,
  scene,
  title,
  warmMedia = false
}: {
  copy: string;
  eyebrow: string;
  imageLabel: string;
  points: string[];
  reverse?: boolean;
  scene: ProductMediaScene;
  title: string;
  warmMedia?: boolean;
}) {
  return (
    <article className={`showcase-row${reverse ? " is-reverse" : ""}`} data-reveal-group>
      <div className="showcase-copy panel-fade">
        <p className="panel-label">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
        <ul>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <LandingLoop fill label={imageLabel} reveal scene={scene} warmMedia={warmMedia} />
    </article>
  );
}

type ProductMediaScene = "discovery" | "assessment" | "modules" | "tutor" | "workshop" | "exercises" | "progress";

function LandingLoop({ compact = false, fill = false, label, reveal = false, scene, warmMedia = false }: {
  compact?: boolean;
  fill?: boolean;
  label: string;
  reveal?: boolean;
  scene: ProductMediaScene;
  warmMedia?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || reduceMotion) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(shell);
    return () => observer.disconnect();
  }, [reduceMotion]);

  useEffect(() => {
    if (!warmMedia || reduceMotion) return;
    const timer = window.setTimeout(() => setShouldLoad(true), 2200);
    return () => window.clearTimeout(timer);
  }, [reduceMotion, warmMedia]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;
    if (isPaused) video.pause();
    else void video.play().catch(() => undefined);
  }, [isPaused, shouldLoad]);

  return (
    <div className={`landing-loop${compact ? " is-compact" : ""}${fill ? " is-fill" : ""}${reveal ? " panel-fade" : ""}`} ref={shellRef}>
      <video
        aria-label={label}
        autoPlay={!isPaused}
        loop
        muted
        playsInline
        poster={`/marketing/${scene}-poster.png`}
        preload="none"
        ref={videoRef}
      >
        {shouldLoad && <source src={`/marketing/${scene}-loop.mp4`} type="video/mp4" />}
      </video>
      {!compact && !reduceMotion && (
        <button
          aria-label={`${isPaused ? "Play" : "Pause"} ${label}`}
          className="landing-loop-control"
          onClick={() => setIsPaused((current) => !current)}
          type="button"
        >
          {isPaused ? "Play" : "Pause"}
        </button>
      )}
    </div>
  );
}

function RotatingLearningHeadline() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayedPrefix, setDisplayedPrefix] = useState("");
  const [displayedTarget, setDisplayedTarget] = useState("");
  const [phase, setPhase] = useState<"waiting" | "prefixTyping" | "prefixPause" | "typing" | "holding" | "deleting">("waiting");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isTypingReady, setIsTypingReady] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setIsTypingReady(true);
      return;
    }
    const timer = window.setTimeout(() => setIsTypingReady(true), 1720);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (!isTypingReady) return;
    if (reduceMotion) {
      setDisplayedPrefix("Learn");
      setDisplayedTarget("programming");
      setPhase("holding");
      return;
    }

    const target = learningTargets[activeIndex];
    let delay = 78;
    if (phase === "waiting") delay = 0;
    if (phase === "prefixPause") delay = 280;
    if (phase === "typing" && displayedTarget === target) delay = 1150;
    if (phase === "holding") delay = 42;

    const timer = window.setTimeout(() => {
      if (phase === "waiting") {
        setPhase("prefixTyping");
        return;
      }
      if (phase === "prefixTyping") {
        if (displayedPrefix === "Learn") setPhase("prefixPause");
        else setDisplayedPrefix("Learn".slice(0, displayedPrefix.length + 1));
        return;
      }
      if (phase === "prefixPause") {
        setPhase("typing");
        return;
      }
      if (phase === "typing") {
        if (displayedTarget === target) setPhase("holding");
        else setDisplayedTarget(target.slice(0, displayedTarget.length + 1));
        return;
      }
      if (phase === "holding") {
        setPhase("deleting");
        return;
      }
      if (displayedTarget.length > 0) {
        setDisplayedTarget(displayedTarget.slice(0, -1));
      } else {
        setActiveIndex((current) => (current + 1) % learningTargets.length);
        setPhase("typing");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeIndex, displayedPrefix, displayedTarget, isTypingReady, phase, reduceMotion]);

  return (
    <h1 aria-label="Learn computing in a workspace built around you.">
      <span className={`learning-headline-line${learningTargets[activeIndex].length > 14 ? " is-long-target" : ""}`} aria-hidden="true">
        {displayedPrefix}
        {(phase === "prefixTyping" || phase === "prefixPause") && <i className="learning-type-cursor is-active" />}
        {(phase !== "waiting" && phase !== "prefixTyping" && phase !== "prefixPause") && (
          <>
            {" "}
            <b>{displayedTarget}<i className="learning-type-cursor is-active" /></b>
          </>
        )}
        {(phase === "holding" || reduceMotion) && "."}
      </span>
    </h1>
  );
}

function usePublicPageMotion() {
  useLayoutEffect(() => {
    const shells = Array.from(document.querySelectorAll<HTMLElement>(".site-shell"));
    const panels = shells.flatMap((shell) => Array.from(shell.querySelectorAll<HTMLElement>(".panel-fade")));
    const landingRays = shells.flatMap((shell) => Array.from(shell.querySelectorAll<HTMLElement>(".landing-side-rays-shell")));
    const revealGroups = shells.flatMap((shell) => Array.from(shell.querySelectorAll<HTMLElement>("[data-reveal-group]")));
    const landingHeroes = shells.flatMap((shell) => Array.from(shell.querySelectorAll<HTMLElement>(".landing-hero-board")));
    const edgePanels = panels.filter((panel) => panel.matches("[data-reveal-edge]"));
    const groupedPanels = new Set(revealGroups.flatMap((group) => Array.from(group.querySelectorAll<HTMLElement>(".panel-fade"))));
    const initialPanels = panels.filter((panel) => panel.matches(".public-nav") || panel.closest(".landing-hero-board"));
    const scrollPanels = panels.filter((panel) => !initialPanels.includes(panel) && !edgePanels.includes(panel) && !groupedPanels.has(panel));
    const centerTargets = [...landingHeroes, ...scrollPanels, ...revealGroups];
    shells.forEach((shell) => shell.classList.add("motion-ready"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      panels.forEach((panel) => panel.classList.add("is-visible"));
      landingRays.forEach((rays) => rays.classList.add("is-visible"));
      return;
    }

    const revealStaggerMs = 340;
    const revealTimers = new Map<HTMLElement, number>();
    const panelsForTarget = (target: HTMLElement) => {
      if (target.matches(".landing-hero-board")) {
        return [
          ...Array.from(target.querySelectorAll<HTMLElement>(".panel-fade")),
          ...landingRays
        ];
      }
      if (target.matches("[data-reveal-group]")) {
        return Array.from(target.querySelectorAll<HTMLElement>(".panel-fade"));
      }
      return [target];
    };

    const revealInSequence = (targets: HTMLElement[]) => {
      targets.forEach((target, index) => {
        if (targets.indexOf(target) !== index || target.classList.contains("is-visible") || revealTimers.has(target)) return;
        const timer = window.setTimeout(() => {
          target.classList.add("is-visible");
          revealTimers.delete(target);
        }, index * revealStaggerMs);
        revealTimers.set(target, timer);
      });
    };

    const resetTarget = (target: HTMLElement) => {
      panelsForTarget(target).forEach((panel) => {
        const timer = revealTimers.get(panel);
        if (timer) window.clearTimeout(timer);
        revealTimers.delete(panel);
        panel.classList.remove("is-visible");
      });
    };

    const observer = new IntersectionObserver((entries) => {
      const enteringTargets = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => {
          const position = left.target.compareDocumentPosition(right.target);
          return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        })
        .map((entry) => entry.target as HTMLElement);

      const enteringPanels = enteringTargets.flatMap(panelsForTarget);
      if (enteringPanels.length > 0) revealInSequence(enteringPanels);
    }, {
      root: shells[0] ?? null,
      rootMargin: "-30% 0px -30% 0px",
      threshold: 0.08
    });

    const edgeObserver = new IntersectionObserver((entries) => {
      const enteringPanels = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLElement);
      if (enteringPanels.length > 0) revealInSequence(enteringPanels);
    }, {
      root: shells[0] ?? null,
      rootMargin: "0px 0px -6% 0px",
      threshold: 0.04
    });

    const resetObserver = new IntersectionObserver((entries) => {
      entries
        .filter((entry) => !entry.isIntersecting)
        .forEach((entry) => resetTarget(entry.target as HTMLElement));
    }, {
      root: shells[0] ?? null,
      threshold: 0.01
    });

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        revealInSequence([...initialPanels, ...landingRays]);
        centerTargets.forEach((target) => observer.observe(target));
        edgePanels.forEach((target) => edgeObserver.observe(target));
        [...centerTargets.filter((target) => !landingHeroes.includes(target)), ...edgePanels].forEach((target) => resetObserver.observe(target));
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
      revealTimers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      edgeObserver.disconnect();
      resetObserver.disconnect();
    };
  }, []);
}

const pricingPlans = [
  {
    name: "Free",
    tagline: "Start learning without a subscription",
    price: "$0",
    unit: "/ person / month",
    cta: "Start free",
    href: "/signup",
    featured: false,
    badge: null,
    points: ["10 creation Stones on registration", "All launch technologies and domains", "1 active learning path", "50 tutor replies and 5 AI images monthly"]
  },
  {
    name: "Pro",
    tagline: "Keep more learning paths moving",
    price: "$9",
    unit: "/ person / month",
    cta: "Choose Pro",
    href: "/signup",
    featured: true,
    badge: "100 Stones / month",
    points: ["100 expiring creation Stones each billing cycle", "All launch technologies and domains", "10 active learning paths", "500 tutor replies and 50 AI images monthly"]
  }
];

const learningComparison = [
  {
    label: "Learning alone",
    title: "You have to design the path.",
    copy: "Useful content is everywhere. Sequencing it, choosing the right practice, and knowing when to move on is still left to you.",
    featured: false
  },
  {
    label: "General AI chat",
    title: "Helpful answers without a learning system.",
    copy: "A chat can explain a bug. It does not automatically connect a curriculum, your project files, verified practice, and long-term progress.",
    featured: false
  },
  {
    label: "Stonecode",
    title: "One path that stays with you.",
    copy: "Your plan, lessons, editor, tutor context, exercises, and progress live together—so every session starts where the last one ended.",
    points: ["Structured around your goal", "Practice inside a live IDE", "Progress verified and remembered"],
    featured: true
  }
];

const aboutStats = [
  { value: "3", label: "Learning experience types" },
  { value: "5", label: "Learning domains" },
  { value: "∞", label: "Personal paths Stonecode can shape" }
];

const learningTargets = ["JavaScript", "Python", "Algorithms", "Internet fundamentals", "Math for programmers"];

const privacySections = [
  {
    title: "Account data",
    copy: "Stonecode uses Supabase Auth for sign up, login, password recovery, and account session state. Your email identifies your workspace and support requests."
  },
  {
    title: "Course workspace data",
    copy: "Courses, folders, files, chat messages, and progress are stored so your learning workspace can continue between sessions."
  },
  {
    title: "AI tutor data",
    copy: "Tutor prompts, relevant course context, and generated responses are sent to Stonecode's configured AI provider to provide tutoring, grading, course creation, and optional visual explanations. Do not enter secrets or highly sensitive personal information."
  },
  {
    title: "Billing data",
    copy: "Payments, invoices, and subscription portal flows are handled by Stripe. Stonecode stores subscription status and plan identifiers needed to enforce product access."
  },
  {
    title: "Execution and service providers",
    copy: "Code selected for managed execution may be sent to Judge0 through RapidAPI. Supabase hosts authentication and application data, OpenAI provides AI features, Stripe processes billing, and Netlify hosts the application. Each provider handles data under its own terms."
  },
  {
    title: "Retention and deletion",
    copy: "Workspace data is retained while your account is active. You can download your account data or permanently delete your account in Security settings. Deletion removes Stonecode account data and cancels an active subscription; payment providers may retain legally required transaction records."
  },
  {
    title: "Security and your choices",
    copy: "Stonecode uses authenticated access controls, private visual storage, scoped course ownership checks, and server-held provider credentials. You may request access, correction, export, or deletion through in-app settings or support. No internet service can guarantee absolute security."
  },
  {
    title: "Cookies and international processing",
    copy: "Stonecode uses essential browser storage and authentication data to keep you signed in and preserve workspace state. Providers may process data in countries outside yours. Continued use authorizes that processing where permitted by law."
  },
  {
    title: "Contact and changes",
    copy: `Privacy questions can be sent to ${supportEmail}. Material policy changes will be reflected here with a new effective date.`
  }
];

const termsSections = [
  {
    title: "Beta access",
    copy: "Stonecode is offered as a paid beta. Features may change as the learning workspace, billing flows, and tutor behavior are refined."
  },
  {
    title: "Acceptable use",
    copy: "Use Stonecode for lawful learning and coding practice. Do not attempt to bypass plan limits, abuse AI endpoints, or run untrusted code outside the provided execution sandbox."
  },
  {
    title: "AI limitations",
    copy: "AI tutor responses can be incomplete or wrong. Review generated explanations and code before relying on them, especially outside beginner practice projects."
  },
  {
    title: "Subscriptions",
    copy: "Pro renews monthly until canceled. Billing is managed through Stripe checkout and its customer portal. Cancellation stops future renewal and remains subject to the period shown by Stripe. Except where law requires otherwise, used periods and spent Stones are not refundable."
  },
  {
    title: "Stones and included usage",
    copy: "Stones are internal creation credits, not money or transferable property. Registration Stones do not expire; monthly Pro Stones expire at the end of their billing cycle. Failed generation releases reserved Stones, while deleting a completed path does not refund them. Tutor, image, and execution allowances are separate plan limits."
  },
  {
    title: "Your content and license",
    copy: "You retain rights you hold in prompts and project content you submit. You grant Stonecode the limited rights needed to host, process, secure, and provide the service. You are responsible for having permission to submit content and for reviewing generated output before use."
  },
  {
    title: "Service availability",
    copy: "Stonecode may change, suspend, or discontinue beta features, enforce safety or usage limits, and restrict accounts that threaten the service or other users. We aim to preserve stored learning data but do not promise uninterrupted or error-free availability."
  },
  {
    title: "Disclaimers and liability",
    copy: "Stonecode provides educational software, not professional, security, legal, medical, or financial advice. To the maximum extent permitted by law, the service is provided as available and liability is limited to amounts you paid Stonecode during the previous three months. Consumer rights that cannot legally be limited remain unaffected."
  },
  {
    title: "Termination and contact",
    copy: `You may delete your account in Security settings. Stonecode may suspend access for material breach, abuse, fraud, or security risk. Questions and notices can be sent to ${supportEmail}. These terms use the laws and mandatory consumer protections applicable to Stonecode's operating entity and your location.`
  }
];
