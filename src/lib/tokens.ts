import { randomBytes } from "node:crypto";
import { sha256 } from "./hash";

export function createRevealToken() {
  return randomBytes(32).toString("base64url");
}

export function hashRevealToken(token: string) {
  return sha256(token);
}

export function buildRevealUrl(appUrl: string, token: string) {
  return `${appUrl.replace(/\/$/, "")}/r/${token}`;
}
