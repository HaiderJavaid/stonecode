const knownFlags = [
  "credits_v1",
  "learning_proposals_v1",
  "runtime_catalog_v1",
  "structured_tutor_tools",
  "chat_visuals_v1",
  "dynamic_surfaces",
  "marketplace_v1"
];

export function resolveFeatureFlags(env = process.env) {
  return Object.fromEntries(knownFlags.map((flag) => [flag, readFlag(env, flag)]));
}

export function isFeatureEnabled(flag, env = process.env) {
  return Boolean(resolveFeatureFlags(env)[flag]);
}

function readFlag(env, flag) {
  const key = `FEATURE_${flag.toUpperCase()}`;
  const value = String(env[key] ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}
