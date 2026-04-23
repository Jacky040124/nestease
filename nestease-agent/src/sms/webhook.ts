import { FastifyInstance } from "fastify";
import { sendSMS } from "./sender.js";
import { processMessage } from "../agent/session-manager.js";
import { SMS_SYSTEM_ERROR } from "../config/constants.js";

interface TelnyxWebhookPayload {
  data: {
    event_type: string;
    payload: {
      from: { phone_number: string };
      to: Array<{ phone_number: string }>;
      text: string;
      media?: Array<{ url: string; content_type: string }>;
      direction?: string;
    };
  };
}

export async function registerSmsWebhook(app: FastifyInstance) {
  // Telnyx inbound SMS webhook
  app.post("/webhook/sms", async (request, reply) => {
    const body = request.body as TelnyxWebhookPayload;

    // Telnyx sends various event types; we only care about inbound messages
    const eventType = body?.data?.event_type;
    if (eventType !== "message.received") {
      console.log(`[Webhook] Ignoring event: ${eventType}`);
      return reply.status(200).send({ ok: true });
    }

    const payload = body.data.payload;
    const from = payload.from.phone_number;
    const text = payload.text || "";
    const mediaUrls = (payload.media || []).map((m) => m.url);

    console.log(`[Webhook] Inbound SMS from ${from}: "${text}" (${mediaUrls.length} media)`);

    // Respond to Telnyx immediately (don't hold the webhook)
    reply.status(200).send({ ok: true });

    // Process through Agent asynchronously
    try {
      const agentReply = await processMessage(from, text, mediaUrls);
      if (agentReply) {
        await sendSMS(from, agentReply);
      }
    } catch (err) {
      console.error(`[Webhook] Agent processing failed for ${from}:`, err);
      // Send a fallback message so the contractor knows we received their message
      try {
        await sendSMS(from, SMS_SYSTEM_ERROR);
      } catch (smsErr) {
        console.error(`[Webhook] Fallback SMS also failed for ${from}:`, smsErr);
      }
    }
  });

  // Health check
  app.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok", service: "nestease-agent" });
  });
}
