import { config } from "../config.js";
import { toE164 } from "../lib/phone.js";

export async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!config.telnyxApiKey || !config.telnyxPhoneNumber) {
    console.warn("[SMS] Missing Telnyx credentials, skipping send");
    return false;
  }

  const normalized = toE164(to);
  try {
    const Telnyx = (await import("telnyx")).default;
    const telnyx = new Telnyx({ apiKey: config.telnyxApiKey });
    await telnyx.messages.send({
      from: config.telnyxPhoneNumber,
      to: normalized,
      text: body,
    });
    console.log(`[SMS] Sent to ${normalized}: ${body.slice(0, 60)}...`);
    return true;
  } catch (err) {
    console.error(`[SMS] Failed to send to ${normalized}:`, err);
    return false;
  }
}
