import assert from "node:assert/strict";
import {
  decryptOpenAiKey,
  encryptOpenAiKey,
  isValidOpenAiKeyShape
} from "../server/user-ai-credentials.mjs";

const env = { AI_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };
const apiKey = `sk-${"a".repeat(32)}`;
const encrypted = encryptOpenAiKey(apiKey, env);

assert.notEqual(encrypted.encryptedSecret, apiKey);
assert.equal(encrypted.lastFour, "aaaa");
assert.equal(decryptOpenAiKey({
  encrypted_secret: encrypted.encryptedSecret,
  secret_iv: encrypted.secretIv,
  secret_tag: encrypted.secretTag
}, env), apiKey);
assert.equal(isValidOpenAiKeyShape(apiKey), true);
assert.equal(isValidOpenAiKeyShape("not-a-key"), false);

console.log("AI credential encryption checks passed");
