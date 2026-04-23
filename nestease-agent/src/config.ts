import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file manually (no dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      const val = trimmed.slice(eqIdx + 1);
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env not found, rely on process.env
  }
}

loadEnv();

export const config = {
  telnyxApiKey: process.env.TELNYX_API_KEY!,
  telnyxPhoneNumber: process.env.TELNYX_PHONE_NUMBER!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  port: parseInt(process.env.PORT || "3001", 10),
};
