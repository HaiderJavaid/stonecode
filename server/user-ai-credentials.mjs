import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

export function encryptOpenAiKey(apiKey, env = process.env) {
  const key = readEncryptionKey(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return {
    encryptedSecret: encrypted.toString("base64"),
    secretIv: iv.toString("base64"),
    secretTag: cipher.getAuthTag().toString("base64"),
    lastFour: apiKey.slice(-4)
  };
}

export function decryptOpenAiKey(record, env = process.env) {
  if (!record?.encrypted_secret || !record?.secret_iv || !record?.secret_tag) return null;
  const decipher = createDecipheriv(
    algorithm,
    readEncryptionKey(env),
    Buffer.from(record.secret_iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(record.secret_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.encrypted_secret, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function isValidOpenAiKeyShape(value) {
  return typeof value === "string" && /^sk-[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

function readEncryptionKey(env) {
  const raw = env.AI_CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY is not configured on the server.");
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}
