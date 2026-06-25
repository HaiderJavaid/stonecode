import { ReactNode, useEffect } from "react";
import { Link } from "react-router-dom";

type PublicPageMode = "landing" | "support" | "privacy" | "terms";

const landingLinks = [
  { href: "#features", label: "Features" },
  { href: "#courses", label: "Courses" },
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
  usePublicPageMotion();

  return (
    <PublicPageShell mode="landing">
      <section className="public-hero landing-grid landing-hero-board" aria-label="Stonecode landing hero">
        <div className="hero-copy panel-fade">
          <h1>
            Master Data Structures.
            <span>Write Better Code.</span>
          </h1>
          <p className="hero-body">
            Interactive learning environment to help you understand fundamentals, practice coding patterns,
            and build real projects with AI feedback.
          </p>
          <div className="public-actions" aria-label="Landing actions">
            <Link className="public-button is-primary" to="/signup">Get started</Link>
            <a className="public-button" href="#courses">Explore courses</a>
          </div>
          <p className="trust-label">Trusted by developers from</p>
          <div className="trust-row" aria-label="Trusted by teams using coding workflows">
            <span>Google</span>
            <span>Microsoft</span>
            <span>Spotify</span>
            <span>Airbnb</span>
            <span>Stripe</span>
          </div>
        </div>

        <div className="hero-preview panel-fade" aria-label="Stonecode workspace preview">
          <WorkspacePreview />
        </div>
      </section>

      <section className="landing-section feature-board" id="features">
        <div className="feature-copy panel-fade">
          <p className="panel-label">Features</p>
          <h2>Everything you need to master DSA</h2>
          <p>
            Built for clarity, designed for focus, and engineered for deep learning inside one persistent coding
            workspace.
          </p>
        </div>
        <div className="feature-card-board panel-fade">
          {featureCards.map((card) => (
            <article className="mini-card" key={card.title}>
              <span className="mini-card-icon" aria-hidden="true">{card.icon}</span>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </article>
          ))}
        </div>
        <div className="inline-banner panel-fade">
          <div>
            <h3>Ready to level up your coding skills?</h3>
            <p>Join thousands of developers mastering DSA with Stonecode.</p>
          </div>
          <div className="cta-links">
            <Link className="public-button is-primary" to="/signup">Get started for free</Link>
            <a className="public-button" href="#courses">Explore courses</a>
          </div>
          <PlaceholderShot label="Course preview" />
        </div>
      </section>

      <section className="landing-section showcase-section" id="courses">
        <FeatureShowcase
          eyebrow="AI tutor"
          title="Learn fundamentals with guided exercises."
          copy="Ask the tutor to explain the current file, break down a topic, generate practice steps, and check your reasoning before you move on."
          imageLabel="AI tutor screenshot placeholder"
          points={["Concept-first explanations", "Practice prompts per lesson", "Feedback grounded in your files"]}
        />
        <FeatureShowcase
          eyebrow="Problem training"
          title="LeetCode-style practice for every coding track."
          copy="Train arrays, graphs, frontend, backend, SQL, Python, and more with XP, streaks, categories, and difficulty progression."
          imageLabel="Problems and XP screenshot placeholder"
          points={["XP and streak tracking", "Language and category filters", "Pattern-based problem sets"]}
          reverse
        />
        <FeatureShowcase
          eyebrow="Projects and badges"
          title="Build real projects with AI and earn proof."
          copy="Move from exercises into real project folders, ship guided milestones, and unlock badges that reflect actual building progress."
          imageLabel="Project builder screenshot placeholder"
          points={["AI project planning", "Milestone badges", "Portfolio-ready practice"]}
        />
      </section>

      <section className="landing-section review-section">
        <article className="review-card panel-fade">
          <p className="panel-label">Student review</p>
          <blockquote>
            "I finally understood graph traversal after struggling with it for months. One Stonecode session made
            the concept click."
          </blockquote>
          <div>
            <strong>Maya R.</strong>
            <span>Self-taught developer</span>
          </div>
        </article>
      </section>

      <section className="landing-section pricing-board" id="pricing">
        <div className="section-copy panel-fade">
          <p className="panel-label">Pricing</p>
          <h2>Simple, transparent pricing</h2>
          <p>Choose the plan that fits your learning journey.</p>
        </div>
        <div className="pricing-grid panel-fade">
          {pricingPlans.map((plan) => (
            <article className={`price-card${plan.featured ? " is-featured" : ""}`} key={plan.name}>
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

      <section className="landing-section about-board" id="about">
        <div className="about-copy panel-fade">
          <div className="section-copy">
            <h2>About stonecode</h2>
          </div>
          <p className="panel-body">
            We believe mastering coding concepts is the foundation of becoming a great developer.
          </p>
          <p className="panel-body">
            Stonecode was built to create a focused, distraction-free learning environment where you can study,
            visualize, practice, and build with AI as your guide.
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
          <h2>Start your coding journey.</h2>
          <p>Practice, understand, and build in one AI-powered workspace.</p>
        </div>
        <div className="cta-links">
          <Link className="public-button" to="/support">Support</Link>
          <Link className="public-button" to="/privacy">Privacy</Link>
          <Link className="public-button is-primary" to="/terms">Terms</Link>
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

function PublicPageShell({ children, mode }: { children: ReactNode; mode: PublicPageMode }) {
  return (
    <main className="site-shell public-shell">
      <StoneTexture />
      <header className="public-nav panel-fade">
        <Link className="site-mark" to="/">stonecode</Link>
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
      <footer className="public-footer panel-fade">
        <div className="footer-brand">
          <strong>stonecode</strong>
          <span>Paid-beta AI programming tutor for persistent IDE-style learning.</span>
        </div>
        <div className="footer-columns">
          <div>
            <p>Product</p>
            <Link to="/">Features</Link>
            <a href="#courses">Courses</a>
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
    </main>
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
        <b>graph.ts</b>
        <span>queue.ts</span>
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
          <code>{`const surface = createStoneIDE({\n  theme: "basement-shadow",\n  texture: "grainy basalt wall",\n  lighting: staticLowKey({\n    angle: -18,\n    spread: "soft"\n  }),\n  surface: "engraved basalt"\n});`}</code>
        </pre>
      </div>
      <div className="preview-rail">
        <div className="preview-terminal">
          <span>stonecode ~/workspace/data-structures</span>
          <p>$ node src/graph.ts --demo</p>
          <p>Added: Graphs -&gt; Shortest Path</p>
          <p>Added: Trees -&gt; Binary Trees</p>
        </div>
        <div className="preview-tutor">
          <strong>Read the current file</strong>
          <p>Name the input, output, and line that changes state before editing anything.</p>
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
  title
}: {
  copy: string;
  eyebrow: string;
  imageLabel: string;
  points: string[];
  reverse?: boolean;
  title: string;
}) {
  return (
    <article className={`showcase-row panel-fade${reverse ? " is-reverse" : ""}`}>
      <div className="showcase-copy">
        <p className="panel-label">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
        <ul>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
      <PlaceholderShot label={imageLabel} />
    </article>
  );
}

function PlaceholderShot({ label }: { label: string }) {
  return (
    <div className="feature-shot" aria-label={label}>
      <div className="shot-window">
        <span />
        <span />
        <span />
      </div>
      <div className="shot-grid">
        <i />
        <i />
        <i />
        <i />
      </div>
      <p>{label}</p>
    </div>
  );
}

function usePublicPageMotion() {
  useEffect(() => {
    const shells = Array.from(document.querySelectorAll<HTMLElement>(".site-shell"));
    shells.forEach((shell) => shell.classList.add("motion-ready"));
    return () => {
      shells.forEach((shell) => shell.classList.remove("motion-ready"));
    };
  }, []);
}

const featureCards = [
  {
    icon: "AI",
    title: "Learn with AI Tutor",
    copy: "Study fundamentals, get guided explanations, and finish exercises with feedback that follows your course."
  },
  {
    icon: "XP",
    title: "Problem tracking",
    copy: "Practice LeetCode-style problems across coding types with XP, streaks, categories, and progression."
  },
  {
    icon: "{}",
    title: "Build real projects",
    copy: "Create real project folders with AI help, complete milestones, and earn badges as proof of progress."
  },
  {
    icon: "01",
    title: "Step-by-step learning",
    copy: "Follow structured lessons that build understanding before jumping into challenge mode."
  },
  {
    icon: "[]",
    title: "Custom practice",
    copy: "Practice specific topics and patterns you find challenging."
  },
  {
    icon: "</>",
    title: "Dark, minimal, focused",
    copy: "A calm IDE-style workspace that keeps you concentrated."
  }
];

const pricingPlans = [
  {
    name: "Free",
    tagline: "For getting started",
    price: "$0",
    unit: "/ month",
    cta: "Get started",
    href: "/signup",
    featured: false,
    badge: null,
    points: ["3 practice projects", "Basic feedback", "Community support", "Limited AI hints"]
  },
  {
    name: "Pro",
    tagline: "For serious developers",
    price: "$9",
    unit: "/ month",
    cta: "Get started",
    href: "/signup",
    featured: true,
    badge: "Most popular",
    points: ["Unlimited practice", "Advanced feedback", "AI-powered hints", "Progress tracking"]
  },
  {
    name: "Team",
    tagline: "For growing teams",
    price: "$19",
    unit: "/ user / month",
    cta: "Contact us",
    href: "/support",
    featured: false,
    badge: null,
    points: ["Everything in Pro", "Shared projects", "Team analytics", "Dedicated support"]
  }
];

const aboutStats = [
  { value: "10K+", label: "Active learners" },
  { value: "150+", label: "Interactive lessons" },
  { value: "98%", label: "Satisfaction rate" }
];

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
