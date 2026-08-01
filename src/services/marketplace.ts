import { authenticatedJson } from "@/services/authenticatedApi";

export type MarketplaceTemplateV1 = {
  id: string;
  owner_user_id: string;
  title: string;
  description: string;
  tags: string[];
  technologies: string[];
  status: "published" | "unpublished" | "suspended";
  current_version: number;
  star_count: number;
  clone_count: number;
  starredByViewer?: boolean;
  snapshot?: {
    version: "marketplace-template/v1";
    listing: { version: number };
    course: { experienceType: "course" | "guided_project"; languages: string[] };
  } | null;
};

export async function listMarketplace(input: { search?: string; technology?: string } = {}): Promise<MarketplaceTemplateV1[]> {
  const params = new URLSearchParams();
  if (input.search) params.set("search", input.search);
  if (input.technology) params.set("technology", input.technology);
  const payload = await authenticatedJson<{ templates: MarketplaceTemplateV1[] }>(`/api/marketplace${params.size ? `?${params}` : ""}`, {}, "load Marketplace");
  return payload.templates;
}

export async function publishMarketplaceCourse(courseId: string, metadata: { title?: string; description?: string; tags?: string[]; technologies?: string[] }) {
  return marketplaceJson("/api/marketplace/publish", { courseId, metadata });
}

export async function setMarketplaceTemplateStar(templateId: string, starred: boolean) {
  return marketplaceJson<{ starred: boolean; starCount: number }>(`/api/marketplace/${encodeURIComponent(templateId)}/star`, { starred });
}

export async function unpublishMarketplaceCourse(templateId: string) {
  return marketplaceJson<{ template: { id: string; status: "unpublished" } }>(`/api/marketplace/${encodeURIComponent(templateId)}/unpublish`, {});
}

export async function cloneMarketplaceCourse(templateId: string) {
  return marketplaceJson<{ course: { id: string }; chargedCredits: number }>(`/api/marketplace/${encodeURIComponent(templateId)}/clone`, {
    idempotencyKey: `clone-${templateId}-${crypto.randomUUID()}`
  });
}

export async function reportMarketplaceCourse(templateId: string, reason: string, details = "") {
  return marketplaceJson(`/api/marketplace/${encodeURIComponent(templateId)}/report`, { reason, details });
}

async function marketplaceJson<T = unknown>(path: string, body: unknown): Promise<T> {
  return authenticatedJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, "complete the Marketplace operation");
}
