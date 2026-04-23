import Fastify from "fastify";
import { config } from "./config.js";
import { registerSmsWebhook } from "./sms/webhook.js";
import { startOutboundNotifier } from "./agent/outbound-notifier.js";

const app = Fastify({ logger: true });

await registerSmsWebhook(app);

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`[nestease-agent] Server running on port ${config.port}`);

  // Start Supabase Realtime listener for outbound notifications
  await startOutboundNotifier();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
