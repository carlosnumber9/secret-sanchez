import { Resend } from "resend";
import { getEnv } from "./env";

export function getResendClient() {
  const { resendApiKey } = getEnv();
  if (!resendApiKey) return null;
  return new Resend(resendApiKey);
}
