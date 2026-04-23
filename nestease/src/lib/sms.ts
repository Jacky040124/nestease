// Telnyx SMS sender with graceful fallback when credentials are missing

/** Normalize a phone number to E.164 format. Adds +1 for North American numbers. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+")) return digits;
  // 10-digit North American number → +1
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  // 11-digit starting with 1 → +
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  // Fallback: return as-is with + prefix
  return `+${digits}`;
}

export async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!process.env.TELNYX_API_KEY || !process.env.TELNYX_PHONE_NUMBER) {
    console.warn("[sms] Telnyx credentials not configured, skipping SMS to", to);
    console.warn("[sms] Message:", body);
    return false;
  }

  const normalizedTo = normalizePhone(to);

  try {
    const apiKey = process.env.TELNYX_API_KEY!.trim();
    const from = process.env.TELNYX_PHONE_NUMBER!.trim();

    const Telnyx = (await import("telnyx")).default;
    const telnyx = new Telnyx({ apiKey });

    await telnyx.messages.send({
      from,
      to: normalizedTo,
      text: body,
    });
    console.log("[sms] Sent to", normalizedTo);
    return true;
  } catch (err) {
    console.error("[sms] Failed to send to", to, err);
    return false;
  }
}
