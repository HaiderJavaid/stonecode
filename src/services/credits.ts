import { authenticatedJson } from "@/services/authenticatedApi";

export type CreditSummary = {
  version: "credit-summary/v1";
  available: number;
  reserved: number;
  grants: Array<{
    id: string;
    grant_type: "registration" | "subscription" | "adjustment";
    original_amount: number;
    remaining_amount: number;
    expires_at: string | null;
    created_at: string;
  }>;
  reservations: Array<{
    id: string;
    amount: number;
    status: "reserved";
    expires_at: string;
    created_at: string;
  }>;
};

export async function loadCreditSummary(): Promise<CreditSummary> {
  const payload = await authenticatedJson<{ credits: CreditSummary }>("/api/credits", {}, "load credits");
  return payload.credits as CreditSummary;
}
