const openAiDefaultModel = "gpt-4.1-mini";

export function resolveTutorProviderConfig(env) {
  const provider = normalizeProvider(env.LLM_PROVIDER);

  if (provider === "openrouter") {
    const apiKey = env.OPENROUTER_API_KEY;
    const model = env.OPENROUTER_MODEL;

    if (!apiKey) {
      return {
        provider,
        model: model ?? null,
        apiKey: null,
        error: "OPENROUTER_API_KEY is not configured on the server."
      };
    }

    if (!model) {
      return {
        provider,
        model: null,
        apiKey,
        error: "OPENROUTER_MODEL is not configured on the server."
      };
    }

    return { provider, model, apiKey, error: null };
  }

  const apiKey = env.OPENAI_API_KEY ?? env.OPEN_AI_API_KEY;
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
  if (config.provider === "openrouter") {
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_ORIGIN ?? "http://localhost:5174",
        "X-Title": "Stonecode"
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        messages: [
          {
            role: "system",
            content: instructions
          },
          {
            role: "user",
            content: JSON.stringify(context)
          }
        ],
        max_tokens: 700
      })
    });
  }

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

export function extractTutorStreamDelta(provider, event) {
  if (provider === "openrouter") {
    const delta = event?.data?.choices?.[0]?.delta?.content;
    return typeof delta === "string" ? delta : "";
  }

  if (event?.event === "response.output_text.delta" && typeof event.data?.delta === "string") {
    return event.data.delta;
  }

  return "";
}

export function isTutorStreamDone(provider, event) {
  if (provider === "openrouter") return event?.data === "[DONE]";
  return event?.event === "response.completed";
}

export function isTutorStreamFailed(provider, event) {
  if (provider === "openrouter") return Boolean(event?.data?.error);
  return event?.event === "response.failed";
}

function normalizeProvider(value) {
  return value === "openrouter" ? "openrouter" : "openai";
}
