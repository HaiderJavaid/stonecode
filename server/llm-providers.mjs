const openAiDefaultModel = "gpt-5.4-mini";

export function resolveTutorProviderConfig(env) {
  const provider = "openai";
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL ?? openAiDefaultModel;

  if (!apiKey) {
    return {
      provider,
      model,
      apiKey: null,
      error: "OPENAI_API_KEY is not configured on the server."
    };
  }

  return { provider, model, apiKey, error: null };
}

export async function requestTutorStream({ config, context, instructions }) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      instructions,
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
  });
}

export async function requestCourseGenerationJson({ config, prompt, maxTokens = 2200 }) {
  const instructions = "You generate Stonecode course content. Return valid JSON only. Do not wrap JSON in markdown.";

  let lastResult = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        instructions,
        input: prompt,
        text: {
          format: { type: "json_object" }
        },
        max_output_tokens: maxTokens
      })
    });
    const payload = await response.json().catch(() => null);
    const isComplete = !payload?.status || payload.status === "completed";
    lastResult = {
      ok: response.ok && isComplete,
      text: payload?.output_text ?? payload?.output?.[0]?.content?.[0]?.text ?? "",
      error: payload?.error?.message ?? (!response.ok ? `OpenAI request failed with HTTP ${response.status}.` : !isComplete ? `OpenAI response was ${payload?.status}.` : null)
    };
    if (lastResult.ok || response.status < 500) return lastResult;
    await wait(600 * (attempt + 1));
  }
  return lastResult;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestCourseSetupReply({ config, prompt }) {
  const instructions = "You are Stonecode course setup. After the learner names a subject, decide whether the subject needs prerequisite assessment. Frameworks, libraries, game dev, fullstack, and broad app paths need prerequisite checks. Fundamentals/from-zero courses can start from foundations. Do not ask for user level, learning mode, project type, Leetcode preference, or design preference. Do not generate the course here.";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      instructions,
      input: prompt,
      max_output_tokens: 180
    })
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    text: payload?.output_text ?? payload?.output?.[0]?.content?.[0]?.text ?? "",
    error: payload?.error?.message ?? null
  };
}

export async function requestChatExerciseGrade({ config, answer, prompt, rubric }) {
  const instructions = `Grade a beginner programming-course answer.
Question: ${prompt || "Explain the current programming concept in your own words."}
Rubric: ${rubric || "Pass when the learner gives a coherent, relevant explanation."}
Accept close beginner answers. Return raw JSON only: {"passed":boolean,"feedback":"one concise sentence"}.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      instructions,
      input: answer,
      max_output_tokens: 120
    })
  });
  const payload = await response.json().catch(() => null);
  return {
    ok: response.ok,
    text: payload?.output_text ?? payload?.output?.[0]?.content?.[0]?.text ?? "",
    error: payload?.error?.message ?? null
  };
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
