import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "./env";
import { sha256 } from "./hash";

export function createRevealToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRevealToken(token: string) {
  return sha256(token);
}

function getEncryptionKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("REVEAL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptRevealToken(token: string, encodedKey = getEnv().revealTokenEncryptionKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(encodedKey), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptRevealToken(ciphertext: string, encodedKey = getEnv().revealTokenEncryptionKey) {
  const [version, encodedIv, encodedTag, encodedValue] = ciphertext.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedValue) {
    throw new Error("Unsupported reveal token ciphertext.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(encodedKey),
    Buffer.from(encodedIv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function buildRevealUrl(appUrl: string, token: string) {
  return `${appUrl.replace(/\/$/, "")}/r#${token}`;
}
