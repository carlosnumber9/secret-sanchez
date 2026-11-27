import { createTransport } from "nodemailer";
import { getEnv } from "@/lib/env";

export function createGmailTransport(credentials: { user: string; password: string }) {
  return createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: credentials.user, pass: credentials.password },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
    pool: false,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true
  });
}

export function getGmailDelivery() {
  const { gmailUser, gmailAppPassword } = getEnv();
  if (!gmailUser || !gmailAppPassword) return null;
  return {
    sender: gmailUser,
    transport: createGmailTransport({ user: gmailUser, password: gmailAppPassword })
  };
}
