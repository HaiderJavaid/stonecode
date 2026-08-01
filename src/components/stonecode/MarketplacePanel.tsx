import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Flag, Search, Star, Unlink } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { Course } from "@/data/courses";
import {
  MarketplaceTemplateV1,
  cloneMarketplaceCourse,
  listMarketplace,
  publishMarketplaceCourse,
  reportMarketplaceCourse,
  setMarketplaceTemplateStar,
  unpublishMarketplaceCourse
} from "@/services/marketplace";

const MARKETPLACE_INTERACTIVE_DELAY_MS = 2880;

export function MarketplacePanel({
  active,
  courses,
  enabled,
  onCloneComplete
}: {
  active: boolean;
  courses: Course[];
  enabled: boolean;
  onCloneComplete: (courseId: string) => Promise<void>;
}) {
  const auth = useAuth();
  const [templates, setTemplates] = useState<MarketplaceTemplateV1[]>([]);
  const [search, setSearch] = useState("");
  const [technology, setTechnology] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [interactionReady, setInteractionReady] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const publishable = courses.filter((course) => Boolean(course.courseContent) && (course.experienceType === "course" || course.experienceType === "guided_project"));
  const technologies = useMemo(() => [...new Set(templates.flatMap((template) => template.technologies))].sort(), [templates]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (active && enabled) void refreshRef.current();
  }, [active, enabled]);

  useEffect(() => {
    setInteractionReady(false);
    if (!active) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : MARKETPLACE_INTERACTIVE_DELAY_MS;
    const timer = window.setTimeout(() => setInteractionReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (active && interactionReady) panelRef.current?.removeAttribute("inert");
    else panelRef.current?.setAttribute("inert", "");
  }, [active, interactionReady]);

  async function refresh(nextSearch = search, nextTechnology = technology) {
    setError(null);
    try {
      setTemplates(await listMarketplace({ search: nextSearch, technology: nextTechnology }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Marketplace could not be loaded.");
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    void refresh();
  }

  async function publishSelected() {
    const course = publishable.find((item) => item.id === selectedCourseId);
    if (!course) return;
    setPendingId(`publish:${course.id}`);
    setError(null);
    try {
      await publishMarketplaceCourse(course.id, {
        title: course.title,
        description: course.description,
        tags: course.tags,
        technologies: course.languages
      });
      setStatus(`${course.title} published as an immutable version.`);
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Publishing failed.");
    } finally {
      setPendingId(null);
    }
  }

  async function cloneTemplate(template: MarketplaceTemplateV1) {
    setPendingId(`clone:${template.id}`);
    setError(null);
    try {
      const result = await cloneMarketplaceCourse(template.id);
      setStatus(`Cloned for ${result.chargedCredits} Stone${result.chargedCredits === 1 ? "" : "s"}.`);
      await onCloneComplete(result.course.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Clone failed.");
    } finally {
      setPendingId(null);
    }
  }

  async function unpublishTemplate(template: MarketplaceTemplateV1) {
    setPendingId(`unpublish:${template.id}`);
    setError(null);
    try {
      await unpublishMarketplaceCourse(template.id);
      setStatus(`${template.title} unpublished. Existing clones remain available to their owners.`);
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unpublish failed.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section
      aria-hidden={!active || !interactionReady}
      aria-labelledby="marketplace-title"
      className={`marketplace-panel${active ? " is-active" : ""}`}
      ref={panelRef}
    >
      <header className="marketplace-heading">
        <h1 id="marketplace-title">Marketplace</h1>
        {enabled && (
          <div className="marketplace-publish">
            <span>Publish a learning path</span>
            <select aria-label="Course to publish" onChange={(event) => setSelectedCourseId(event.target.value)} value={selectedCourseId}>
              <option value="">Choose a generated path</option>
              {publishable.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
            <button disabled={!selectedCourseId || Boolean(pendingId)} onClick={() => void publishSelected()} type="button">{pendingId?.startsWith("publish:") ? "Publishing…" : "Publish snapshot"}</button>
          </div>
        )}
      </header>
      <div className="marketplace-content-card">
        {!enabled ? (
          <div className="marketplace-empty marketplace-unavailable">
            <strong>Marketplace unavailable</strong>
            <p>This deployment has not enabled community learning yet.</p>
          </div>
        ) : (
        <>
        <div className="marketplace-toolbar">
          <form onSubmit={handleSearch}><Search aria-hidden="true" /><input aria-label="Search Marketplace" onChange={(event) => setSearch(event.target.value)} placeholder="Search courses and projects" value={search} /><button type="submit">Search</button></form>
          <select aria-label="Filter by technology" onChange={(event) => { setTechnology(event.target.value); void refresh(search, event.target.value); }} value={technology}>
            <option value="">All technologies</option>
            {technologies.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {status && <p className="plain-success">{status}</p>}
        {error && <p className="plain-error">{error}</p>}
        <section className="marketplace-grid" aria-live="polite">
          {templates.map((template) => (
            <article className="marketplace-card" key={template.id}>
              <div className="marketplace-card-top"><span>{template.snapshot?.course.experienceType === "guided_project" ? "Guided project" : "Course"}</span><small>v{template.current_version}</small></div>
              <h2>{template.title}</h2>
              <p>{template.description}</p>
              <div className="marketplace-tags">{template.technologies.slice(0, 4).map((item) => <span key={item}>{item}</span>)}</div>
              <footer>
                <button aria-label={`${template.starredByViewer ? "Unstar" : "Star"} ${template.title}`} onClick={async () => {
                  const starred = !template.starredByViewer;
                  const result = await setMarketplaceTemplateStar(template.id, starred).catch(() => null);
                  if (!result) return;
                  setTemplates((current) => current.map((entry) => entry.id === template.id ? { ...entry, starredByViewer: starred, star_count: result.starCount } : entry));
                }} type="button"><Star fill={template.starredByViewer ? "currentColor" : "none"} /> {template.star_count}</button>
                <button aria-label={`Report ${template.title}`} onClick={() => void reportMarketplaceCourse(template.id, "other", "Reported from Marketplace listing.").then(() => setStatus("Report submitted for moderation.")).catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Report failed."))} type="button"><Flag /></button>
                {template.owner_user_id === auth.user?.id && <button aria-label={`Unpublish ${template.title}`} disabled={Boolean(pendingId)} onClick={() => void unpublishTemplate(template)} type="button"><Unlink /></button>}
                <span>{template.clone_count} clones</span>
                <button className="is-clone" disabled={Boolean(pendingId)} onClick={() => void cloneTemplate(template)} type="button">{pendingId === `clone:${template.id}` ? "Cloning…" : "Clone · 1 Stone"}</button>
              </footer>
            </article>
          ))}
          {!templates.length && !error && <div className="marketplace-empty"><strong>No listings yet</strong><p>Publish the first generated course or project.</p></div>}
        </section>
        </>
        )}
      </div>
    </section>
  );
}
