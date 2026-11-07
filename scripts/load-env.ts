import { config } from "dotenv";

// Exported values select the context and take precedence over all files.
const environment = process.env.VERCEL_ENV || process.env.APP_ENV || "development";
if (!["development", "preview", "production", "test"].includes(environment)) throw new Error("Invalid APP_ENV.");
config({ path: [`.env.${environment}.local`, ".env.local", `.env.${environment}`, ".env"], quiet: true });
