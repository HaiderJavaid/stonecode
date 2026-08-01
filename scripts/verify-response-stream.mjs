import assert from "node:assert/strict";
import { createSseEventParser } from "../server/response-stream.mjs";
import {
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

const openAiConfig = resolveTutorProviderConfig({
  OPENAI_API_KEY: "test-openai-key"
});
assert.equal(openAiConfig.provider, "openai");
assert.equal(openAiConfig.model, "gpt-5.6-luna");
assert.equal(openAiConfig.apiKey, "test-openai-key");

const missingOpenAiConfig = resolveTutorProviderConfig({});
assert.equal(missingOpenAiConfig.error, "OPENAI_API_KEY is not configured on the server.");

console.log("response stream checks passed");
