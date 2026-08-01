import { authenticatedFetch, authenticatedJson } from "@/services/authenticatedApi";

export async function downloadAccountExport() {
  const response = await authenticatedFetch("/api/account/export", {}, "export your account data");
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? "Failed to export account data.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `stonecode-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function permanentlyDeleteAccount() {
  await authenticatedJson<{ deleted: true }>("/api/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: "DELETE" })
  }, "delete your account");
}
