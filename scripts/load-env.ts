import { config } from "dotenv";

// Exported environment values take precedence over the local files.
config({ path: [".env.local", ".env"], quiet: true });
