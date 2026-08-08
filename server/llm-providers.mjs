const openAiDefaultModel = "gpt-5.6-luna";
const defaultRequestTimeoutMs = 45_000;
const generationRequestTimeoutMs = 180_000;

const modelRoleByTask = {
  tutor_chat: "low",
  setup_reply: "low",
  learning_discovery: "low",
  assessment_plan: "high",
  assessment_question: "high",
  assessment_review: "reasoning",
  course_structure: "reasoning",
  short_course: "high",
  exercise_generation: "high",
  guided_project: "reasoning",
  project_milestone: "high",
  module_content: "high",
  course_repair: "grader",
  chapter_content: "medium",
  reflection_grade: "grader",
  code_grade: "grader"
};

export function resolveProviderConfig(env, task = "tutor_chat") {
  const provider = "openai";
  const apiKey = env.OPENAI_API_KEY;
  const role = modelRoleByTask[task] ?? "medium";
  const roleKey = `OPENAI_MODEL_${role.toUpperCase()}`;
  const model = env[roleKey] ?? env.OPENAI_MODEL ?? openAiDefaultModel;

  if (!apiKey) {
    return {
      provider,
      model,
      apiKey: null,
      error: "OPENAI_API_KEY is not configured on the server."
    };
  }

  return { provider, model, apiKey, role, task, error: null };
}

export function resolveTutorProviderConfig(env, task = "tutor_chat") {
  return resolveProviderConfig(env, task);
}

export async function requestTutorStream({ config, context, instructions, tools = [] }) {
  return fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      ...responseReasoningOptions(config.model),
      stream: true,
      instructions,
      ...(tools.length ? { tools, tool_choice: "auto", parallel_tool_calls: false } : {}),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(context)
            }
          ]
        }
      ],
      max_output_tokens: 700
    })
  }, defaultRequestTimeoutMs);
}

export async function requestCourseGenerationJson({ config, prompt, maxTokens = 2200, serviceTier = config?.serviceTier ?? null }) {
  const instructions = "You generate Stonecode course content. Return valid JSON only. Do not wrap JSON in markdown.";
  const requestedServiceTier = normalizeServiceTier(serviceTier);

  let lastResult = null;
  let tokenBudget = maxTokens;
  let accumulatedUsage = normalizeUsage(null);
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.model,
          ...responseReasoningOptions(config.model),
          ...(requestedServiceTier ? { service_tier: requestedServiceTier } : {}),
          instructions,
          input: prompt,
          text: {
            format: { type: "json_object" }
          },
          max_output_tokens: tokenBudget
        })
      }, generationRequestTimeoutMs);
    } catch (error) {
      lastResult = {
        ok: false,
        text: "",
        error: error?.name === "TimeoutError" || error?.name === "AbortError" ? "OpenAI generation timed out." : `OpenAI generation request failed: ${error instanceof Error ? error.message : String(error)}`,
        incompleteReason: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network_error",
        attempts: attempt + 1,
        usage: accumulatedUsage,
        latencyMs: Date.now() - startedAt,
        model: config.model,
        serviceTier: requestedServiceTier ?? "default",
        requestedServiceTier
      };
      if (attempt < 2) await retryWait(attempt);
      continue;
    }
    const payload = await response.json().catch(() => null);
    const isComplete = !payload?.status || payload.status === "completed";
    const incompleteReason = typeof payload?.incomplete_details?.reason === "string"
      ? payload.incomplete_details.reason
      : null;
    accumulatedUsage = sumUsage(accumulatedUsage, normalizeUsage(payload?.usage));
    lastResult = {
      ok: response.ok && isComplete,
      text: payload?.output_text ?? payload?.output?.[0]?.content?.[0]?.text ?? "",
      error: payload?.error?.message ?? (!response.ok
        ? `OpenAI request failed with HTTP ${response.status}.`
        : !isComplete
          ? `OpenAI response was ${payload?.status}${incompleteReason ? ` (${incompleteReason})` : ""}.`
          : null),
      incompleteReason,
      attempts: attempt + 1,
      usage: accumulatedUsage,
      latencyMs: Date.now() - startedAt,
      model: payload?.model ?? config.model,
      serviceTier: normalizeServiceTier(payload?.service_tier) ?? requestedServiceTier ?? "default",
      requestedServiceTier
    };
    if (lastResult.ok) return lastResult;
    const retryableIncomplete = response.ok && !isComplete;
    if (!retryableIncomplete && response.status < 500) return lastResult;
    tokenBudget = Math.min(Math.ceil(tokenBudget * 1.6), 16000);
    await retryWait(attempt);
  }
  return lastResult;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryWait(attempt) {
  return wait(500 * (2 ** attempt) + Math.floor(Math.random() * 250));
}

export async function requestCourseSetupReply({ config, prompt }) {
  const instructions = "You are Stonecode course setup. After the learner names a subject, decide whether the subject needs prerequisite assessment. Frameworks, libraries, game dev, fullstack, and broad app paths need prerequisite checks. Fundamentals/from-zero courses can start from foundations. Do not ask for user level, learning mode, project type, Leetcode preference, or design preference. Do not generate the course here.";

  const startedAt = Date.now();
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      ...responseReasoningOptions(config.model),
      instructions,
      input: prompt,
      max_output_tokens: 180
    })
  }, defaultRequestTimeoutMs);
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    text: payload?.output_text ?? payload?.output?.[0]?.content?.[0]?.text ?? "",
    error: payload?.error?.message ?? null,
    usage: normalizeUsage(payload?.usage),
    latencyMs: Date.now() - startedAt,
    model: payload?.model ?? config.model
  };
}

export async function requestChatExerciseGrade({ config, answer, prompt, rubric }) {
  const instructions = `Grade a beginner programming-course answer.
Question: ${prompt || "Explain the current programming concept in your own words."}
Rubric: ${rubric || "Pass when the learner gives a coherent, relevant explanation."}
Accept close beginner answers. Return raw JSON only: {"passed":boolean,"feedback":"one concise sentence"}.`;

  const startedAt = Date.now();
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      ...responseReasoningOptions(config.model),
      instructions,
      input: answer,
      max_output_tokens: 120
    })
  }, defaultRequestTimeoutMs);
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    text: payload?.output_text ?? payload?.output?.[0]?.content?.[0]?.text ?? "",
    error: payload?.error?.message ?? null,
    usage: normalizeUsage(payload?.usage),
    latencyMs: Date.now() - startedAt,
    model: payload?.model ?? config.model
  };
}

function normalizeUsage(value) {
  return {
    inputTokens: Number.isFinite(Number(value?.input_tokens)) ? Number(value.input_tokens) : null,
    outputTokens: Number.isFinite(Number(value?.output_tokens)) ? Number(value.output_tokens) : null,
    cachedInputTokens: Number.isFinite(Number(value?.input_tokens_details?.cached_tokens)) ? Number(value.input_tokens_details.cached_tokens) : 0,
    cacheWriteTokens: Number.isFinite(Number(value?.input_tokens_details?.cache_write_tokens)) ? Number(value.input_tokens_details.cache_write_tokens) : 0,
    reasoningTokens: Number.isFinite(Number(value?.output_tokens_details?.reasoning_tokens)) ? Number(value.output_tokens_details.reasoning_tokens) : 0
  };
}

function sumUsage(left, right) {
  return {
    inputTokens: sumNullable(left?.inputTokens, right?.inputTokens),
    outputTokens: sumNullable(left?.outputTokens, right?.outputTokens),
    cachedInputTokens: nonNegative(left?.cachedInputTokens) + nonNegative(right?.cachedInputTokens),
    cacheWriteTokens: nonNegative(left?.cacheWriteTokens) + nonNegative(right?.cacheWriteTokens),
    reasoningTokens: nonNegative(left?.reasoningTokens) + nonNegative(right?.reasoningTokens)
  };
}

function responseReasoningOptions(model) {
  return String(model ?? "").trim().toLowerCase().startsWith("gpt-5.6")
    ? { reasoning: { effort: "none" } }
    : {};
}

function normalizeServiceTier(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["fast", "priority"].includes(normalized)) return normalized;
  if (normalized === "default") return "default";
  return null;
}

function sumNullable(left, right) {
  const values = [left, right].filter((value) => Number.isFinite(Number(value)));
  return values.length ? values.reduce((total, value) => total + Number(value), 0) : null;
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function fetchWithTimeout(url, init, timeoutMs) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

export function extractTutorStreamDelta(provider, event) {
  if (event?.event === "response.output_text.delta" && typeof event.data?.delta === "string") {
    return event.data.delta;
  }

  return "";
}

export function isTutorStreamDone(provider, event) {
  return event?.event === "response.completed";
}

export function isTutorStreamFailed(provider, event) {
  return event?.event === "response.failed";
}
