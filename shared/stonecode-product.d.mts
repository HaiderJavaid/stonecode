export type ProductPlanId = "free" | "pro";
export type ProductExperienceType = "course" | "project" | "exercise";
export type WorkspaceSurface = "code" | "output" | "terminal";

export type PlanDefinition = {
  id: ProductPlanId;
  name: "Free" | "Pro";
  priceMonthlyUsd: number;
  registrationCredits: number;
  monthlyCredits: number;
  activePathLimit: number;
  tutorRepliesPerMonth: number;
  aiImagesPerMonth: number;
  judge0ActionsPerDay: number;
};

export type TechnologyCapability = {
  id: string;
  displayName: string;
  editorId: string;
  defaultFilePath: string;
  runtime: "browser" | "judge0";
  ragCorpusKey: string;
  ragRequired: boolean;
  hiddenUntilRuntime: boolean;
  surfaces: { code: true; output: boolean; terminal: boolean };
};

export type LearningDomainId =
  | "programming"
  | "computer_fundamentals"
  | "internet_web"
  | "algorithms_data_structures"
  | "math_for_programmers";

export type LearningDomainDefinition = {
  id: LearningDomainId;
  displayName: string;
  description: string;
  ragCorpusKey: string | null;
  technologyRequiredFor: readonly ProductExperienceType[];
  defaultTechnologyId: string | null;
  focusAreas: readonly string[];
};

export type BrowserFrameworkDefinition = {
  id: string;
  displayName: string;
  version: string;
  sourceMode: "browser_global" | "browser_sfc";
  assets: readonly { url: string; type: "script" | "module" }[];
};

export const learningExperienceTypes: readonly ProductExperienceType[];
export const planCatalog: Readonly<Record<ProductPlanId, PlanDefinition>>;
export const creationCreditBands: Readonly<Record<string, unknown>>;
export const browserFrameworkCatalog: readonly BrowserFrameworkDefinition[];
export const browserFrameworkAllowlist: readonly string[];
export const approvedBrowserAssetUrls: readonly string[];
export const technologyCatalog: readonly TechnologyCapability[];
export const launchTechnologyIds: readonly string[];
export const productionTechnologyIds: readonly string[];
export const learningDomainCatalog: readonly LearningDomainDefinition[];

export function isApprovedBrowserAssetUrl(value: unknown): boolean;

export function normalizeProductPlan(value: unknown): ProductPlanId;
export function normalizeProductExperienceType(value: unknown): ProductExperienceType;
export function quoteCreationCredits(scope?: Record<string, unknown>): {
  version: "credit-quote/v1";
  type: ProductExperienceType | "marketplace_clone";
  credits: number;
  currency: "stonecode_credit";
  scope: Readonly<Record<string, unknown>>;
};
export function findTechnology(value: unknown): TechnologyCapability | null;
export function findLearningDomain(value: unknown): LearningDomainDefinition | null;
export function resolveStepSurfaceManifest(input?: {
  technologyId?: string;
  requiresOutput?: boolean;
  requiresTerminal?: boolean;
  recommended?: WorkspaceSurface;
}): { available: WorkspaceSurface[]; recommended: WorkspaceSurface };
