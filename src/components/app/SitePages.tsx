import { MouseEvent as ReactMouseEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeroWorkspacePreview } from "@/components/app/HeroWorkspacePreview";
import SideRays from "@/components/effects/SideRays";
import { StonecodeLogoMark } from "@/components/stonecode/StonecodeBrand";

type PublicPageMode = "landing" | "support" | "privacy" | "terms";

const landingLinks = [
  { href: "#courses", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
  { href: "#docs", label: "Docs" }
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
          <p className="hero-eyebrow">Your AI programming tutor</p>
          <RotatingLearningHeadline />
          <p className="hero-body">
            Learn with an AI tutor that builds your path, guides your practice, and helps you understand what you build.
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
          <p className="trust-label">One tutor. Four ways to learn.</p>
          <div className="trust-row" aria-label="Stonecode learning experience types">
            <span>Courses</span>
            <span>Short courses</span>
            <span>Exercises</span>
            <span>Guided projects</span>
          </div>
        </div>
      </section>

      <section className="landing-section showcase-section" id="courses">
        <FeatureShowcase
          eyebrow="Personalized curriculum"
          title="AI-generated courses."
          copy="Tell your AI tutor what you want to learn. It assesses what you already know, then generates a course with the right modules, theory, workshops, and checkpoints."
          imageLabel="AI-generated personalized course preview"
          points={["Generated around your goal", "Prerequisites added only when needed", "Your course adapts as you progress"]}
          scene="modules"
        />
        <FeatureShowcase
          eyebrow="Guided AI workshops"
          title="Build projects side-by-side with AI."
          copy="Build inside the editor while your AI tutor explains each change, reads the current files, and guides the next step beside you."
          imageLabel="Side-by-side guided workshop preview"
          points={["One continuous project", "Small guided edits with visible results", "AI feedback grounded in your files"]}
          scene="workshop"
          reverse
        />
        <FeatureShowcase
          eyebrow="Adaptive AI practice"
          title="AI-generated exercises."
          copy="Ask for practice by topic and difficulty. Your AI tutor generates coding problems and MCQs, checks your work, gives targeted hints, and turns verified progress into XP."
          imageLabel="AI-generated coding exercise preview"
          points={["Choose topics, difficulty, and exercise count", "Coding and MCQ practice generated for you", "Verified results become language XP"]}
          scene="exercises"
        />
      </section>

      <section className="landing-section pricing-board" data-reveal-group id="pricing">
        <div className="section-copy panel-fade">
          <p className="panel-label">Pricing</p>
          <h2>Choose who powers your tutor.</h2>
          <p>Use your own OpenAI key for free, or let Stonecode handle the AI for $9 per person each month.</p>
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
            Generating software is becoming easier. Knowing why it works—and how to fix it when it does not—is becoming more valuable.
          </p>
          <p className="panel-body">
            Stonecode gives beginners a personal AI tutor, a progressive curriculum, hands-on practice, and one
            workspace that remembers the course, project files, conversations, and progress.
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
          <h2>Learn the code AI helps you create.</h2>
          <p>Start with a personal course, a focused exercise set, or one guided project.</p>
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
          <span>Beta draft</span>
          <p>Last updated June 23, 2026. Final legal review still required before broader public launch.</p>
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
          <span>Personalized AI programming tutor for learning, practice, projects, and progress.</span>
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

function WorkspacePreview() {
  return (
    <div className="workspace-preview-frame">
      <div className="preview-chrome">
        <span />
        <span />
        <span />
      </div>
      <div className="preview-tabs">
        <b>main.py</b>
        <span>Modules</span>
      </div>
      <div className="preview-editor">
        <div className="preview-gutter" aria-hidden="true">
          <span>01</span>
          <span>02</span>
          <span>03</span>
          <span>04</span>
          <span>05</span>
          <span>06</span>
          <span>07</span>
          <span>08</span>
        </div>
        <pre>
          <code>{`import pygame\n\npygame.init()\n\nWIDTH = 960\nHEIGHT = 540\nscreen = pygame.display.set_mode((WIDTH, HEIGHT))\n\n# Next: create the player`}</code>
        </pre>
      </div>
      <div className="preview-rail">
        <div className="preview-terminal">
          <span>stonecode ~/pygame-platformer</span>
          <p>$ python main.py</p>
          <p>Window opened: 960 × 540</p>
          <p>Step 3 of 12 ready</p>
        </div>
        <div className="preview-tutor">
          <strong>Why these dimensions?</strong>
          <p>WIDTH and HEIGHT describe the game window. Next, we will use them to position the player.</p>
        </div>
      </div>
    </div>
  );
}

function FeatureShowcase({
  copy,
  eyebrow,
  imageLabel,
  points,
  reverse = false,
  scene,
  title
}: {
  copy: string;
  eyebrow: string;
  imageLabel: string;
  points: string[];
  reverse?: boolean;
  scene: ProductMediaScene;
  title: string;
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
      <LandingLoop fill label={imageLabel} reveal scene={scene} />
    </article>
  );
}

type ProductMediaScene = "discovery" | "assessment" | "modules" | "tutor" | "workshop" | "exercises" | "progress";

function RealAppStill({ compact = false, label }: { compact?: boolean; label: string }) {
  return (
    <div className={`feature-shot landing-real-still${compact ? " is-compact" : ""}`} aria-label={label}>
      <img alt={label} loading="lazy" src="/marketing/app-dashboard-poster.jpg" />
    </div>
  );
}

function ProductMedia({ compact = false, label, scene }: { compact?: boolean; label: string; scene: ProductMediaScene }) {
  const sceneContent = productMediaScenes[scene];
  return (
    <div className={`feature-shot product-media product-media-${scene}${compact ? " is-compact" : ""}`} aria-label={label}>
      <LandingLoop fill label={label} scene={scene} />
      <div className="shot-window">
        <span />
        <span />
        <span />
        <b>{sceneContent.windowTitle}</b>
      </div>
      <div className="product-media-body">
        <aside aria-hidden="true">
          {sceneContent.rail.map((item, index) => <span className={index === 0 ? "is-active" : ""} key={item}>{item}</span>)}
        </aside>
        <div className="product-media-main">
          <small>{sceneContent.eyebrow}</small>
          <strong>{sceneContent.title}</strong>
          <p>{sceneContent.copy}</p>
          <div className="product-media-actions">
            {sceneContent.actions.map((action) => <span key={action}>{action}</span>)}
          </div>
        </div>
      </div>
      {!compact && <p className="product-media-caption">{label}</p>}
    </div>
  );
}

function LandingLoop({ compact = false, fill = false, label, reveal = false, scene }: {
  compact?: boolean;
  fill?: boolean;
  label: string;
  reveal?: boolean;
  scene: ProductMediaScene;
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
  const [displayedTarget, setDisplayedTarget] = useState("");
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("typing");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayedTarget("programming");
      return;
    }

    const target = learningTargets[activeIndex];
    let delay = 78;
    if (phase === "typing" && displayedTarget === target) delay = 1150;
    if (phase === "holding") delay = 42;

    const timer = window.setTimeout(() => {
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
  }, [activeIndex, displayedTarget, phase, reduceMotion]);

  return (
    <h1 aria-label="Learn programming with your personalized AI tutor.">
      <span className={`learning-headline-line${learningTargets[activeIndex].length > 14 ? " is-long-target" : ""}`} aria-hidden="true">
        Learn <b>{displayedTarget}<i className="learning-type-cursor" /></b>{(phase === "holding" || reduceMotion) && "."}
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
        [...centerTargets, ...edgePanels].forEach((target) => resetObserver.observe(target));
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

const featureCards = [
  {
    icon: "01",
    scene: "discovery" as const,
    title: "Conversational discovery",
    copy: "Describe what you want to learn or build. Stonecode asks only the questions that change your path."
  },
  {
    icon: "AI",
    scene: "assessment" as const,
    title: "Personalized curriculum",
    copy: "Your goal, prior knowledge, and optional prerequisite check shape the modules Stonecode generates."
  },
  {
    icon: "Aa",
    scene: "tutor" as const,
    title: "Theory for beginners",
    copy: "New concepts, words, symbols, and code are explained before you are expected to use them."
  },
  {
    icon: "{}",
    scene: "workshop" as const,
    title: "Guided workshops",
    copy: "Build real features through small connected edits, with the tutor and editor sharing the same context."
  },
  {
    icon: "[]",
    scene: "exercises" as const,
    title: "Targeted practice",
    copy: "Generate coding and MCQ exercises for the exact language, framework, or topic you want to strengthen."
  },
  {
    icon: "XP",
    scene: "progress" as const,
    title: "Skills and achievements",
    copy: "Track language XP, solved exercises, program completion, and titles earned through verified progress."
  }
];

const pricingPlans = [
  {
    name: "Free",
    tagline: "Bring your own OpenAI key",
    price: "$0",
    unit: "/ person / month",
    cta: "Start free",
    href: "/signup",
    featured: false,
    badge: null,
    points: ["Generate courses, short courses, exercises, and guided projects", "Personalized discovery with an optional skill assessment", "AI tutor, persistent workspace, XP, and achievements", "Pay OpenAI directly for model usage"]
  },
  {
    name: "Pro",
    tagline: "Stonecode handles the AI",
    price: "$9",
    unit: "/ person / month",
    cta: "Choose Pro",
    href: "/signup",
    featured: true,
    badge: "AI included",
    points: ["Everything in Free", "Monthly AI credits managed by Stonecode", "Start without configuring an OpenAI key", "One subscription for Stonecode and AI usage"]
  }
];

const aboutStats = [
  { value: "4", label: "Learning experience types" },
  { value: "1", label: "Persistent coding workspace" },
  { value: "∞", label: "Personal paths Stonecode can shape" }
];

const learningTargets = ["JavaScript", "Python", "C++", "C#", "Web Development", "Game Development"];

const productMediaScenes: Record<ProductMediaScene, {
  actions: string[];
  copy: string;
  eyebrow: string;
  rail: string[];
  title: string;
  windowTitle: string;
}> = {
  discovery: {
    windowTitle: "Add learning",
    eyebrow: "AI discovery",
    title: "What would you like to learn or build?",
    copy: "I want to build a 2D game with Python, but I have never used Pygame.",
    actions: ["Python fundamentals", "2D game with Pygame", "Help me choose"],
    rail: ["Goal", "Background", "Optional check", "Review"]
  },
  assessment: {
    windowTitle: "Optional prerequisite check",
    eyebrow: "Question 2 of 3",
    title: "What does this Python loop repeat?",
    copy: "Your answer helps Stonecode decide whether to add a short Python bridge before Pygame.",
    actions: ["Choose an answer", "I don't know", "Skip assessment"],
    rail: ["Goal", "Background", "Assessment", "Review"]
  },
  modules: {
    windowTitle: "Personal course",
    eyebrow: "Module 1 ready",
    title: "Pygame foundations for your first platformer",
    copy: "Theory → guided workshop → quiz, with later modules planned around the game you want to build.",
    actions: ["Start Module 1", "View modules"],
    rail: ["Modules", "Files", "Progress"]
  },
  tutor: {
    windowTitle: "Personal AI tutor",
    eyebrow: "Theory · variables",
    title: "A variable is a label attached to a value.",
    copy: "WIDTH keeps the number 960 under a useful name, so the rest of the program can reuse it clearly.",
    actions: ["Show an analogy", "Explain this line", "Give me an example"],
    rail: ["Modules", "Theory", "main.py", "Tutor"]
  },
  workshop: {
    windowTitle: "Guided workshop",
    eyebrow: "Step 3 of 12",
    title: "Create the game window",
    copy: "Add WIDTH and HEIGHT, then pass both values into pygame.display.set_mode().",
    actions: ["Why these values?", "Show the code change", "Check"],
    rail: ["Modules", "main.py", "Visual", "Terminal"]
  },
  exercises: {
    windowTitle: "Focused exercise",
    eyebrow: "Python · easy",
    title: "Create a display surface with the requested size.",
    copy: "Run your code as often as you need. Stonecode checks the result and explains what is still missing.",
    actions: ["Run", "Ask one hint", "Check answer"],
    rail: ["Exercise 3", "main.py", "Terminal", "Checklist"]
  },
  progress: {
    windowTitle: "Skill progression",
    eyebrow: "Verified progress",
    title: "+20 Python XP",
    copy: "Exercise passed: initialize Pygame and create a correctly sized display surface.",
    actions: ["Python · 140 XP", "Game Development · 65 XP", "First Steps earned"],
    rail: ["Overview", "Languages", "Exercises", "Titles"]
  }
};

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
    copy: "Tutor prompts, course context, and generated responses may be sent to the configured AI provider so the tutor can respond and apply requested workspace changes."
  },
  {
    title: "Billing data",
    copy: "Payments, invoices, and subscription portal flows are handled by Stripe. Stonecode stores subscription status and plan identifiers needed to enforce product access."
  }
];

const termsSections = [
  {
    title: "Beta access",
    copy: "Stonecode is offered as a paid beta. Features may change as the learning workspace, billing flows, and tutor behavior are refined."
  },
  {
    title: "Acceptable use",
    copy: "Use Stonecode for lawful learning and coding practice. Do not attempt to bypass plan limits, abuse AI endpoints, or run untrusted code outside the provided safe browser runner."
  },
  {
    title: "AI limitations",
    copy: "AI tutor responses can be incomplete or wrong. Review generated explanations and code before relying on them, especially outside beginner practice projects."
  },
  {
    title: "Subscriptions",
    copy: "Billing is managed through Stripe checkout and portal flows. Plan access, course limits, and usage limits are enforced by the application."
  }
];
