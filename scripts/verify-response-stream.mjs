import assert from "node:assert/strict";
import { createSseEventParser } from "../server/response-stream.mjs";
import {
  extractTutorStreamDelta,
  isTutorStreamDone,
  resolveTutorProviderConfig
} from "../server/llm-providers.mjs";

const events = [];
const parser = createSseEventParser((event) => events.push(event));

parser.push('event: response.output_text.delta\ndata: {"delta":"Hel');
parser.push('lo"}\n\n');
parser.push('event: response.completed\ndata: {"response":{"status":"completed"}}\n\n');

assert.deepEqual(events, [
  {
    event: "response.output_text.delta",
    data: { delta: "Hello" }
  },
  {
    event: "response.completed",
    data: { response: { status: "completed" } }
  }
]);

const openRouterEvents = [];
const openRouterParser = createSseEventParser((event) => openRouterEvents.push(event));
openRouterParser.push('data: {"choices":[{"delta":{"content":"Hi"}}]}\r\n\r\n');
openRouterParser.push("data: [DONE]\r\n\r\n");

assert.equal(extractTutorStreamDelta("openrouter", openRouterEvents[0]), "Hi");
assert.equal(isTutorStreamDone("openrouter", openRouterEvents[1]), true);

const openRouterConfig = resolveTutorProviderConfig({
  LLM_PROVIDER: "openrouter",
  OPENROUTER_API_KEY: "test-key",
  OPENROUTER_MODEL: "test/model:free"
});
assert.equal(openRouterConfig.provider, "openrouter");
assert.equal(openRouterConfig.model, "test/model:free");
assert.equal(openRouterConfig.apiKey, "test-key");

const missingOpenRouterConfig = resolveTutorProviderConfig({
  LLM_PROVIDER: "openrouter",
  OPENROUTER_API_KEY: "test-key"
});
assert.equal(missingOpenRouterConfig.error, "OPENROUTER_MODEL is not configured on the server.");

console.log("response stream checks passed");
