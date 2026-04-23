import { createHmac, timingSafeEqual } from "crypto";

const SECRET = (process.env.CONTRACTOR_JWT_SECRET || process.env.LINK_SIGNING_SECRET)?.trim();
if (!SECRET) throw new Error("Missing CONTRACTOR_JWT_SECRET or LINK_SIGNING_SECRET environment variable");
const DEFAULT_EXPIRES_IN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hmacSign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("hex");
}

/**
 * Sign a contractor session token (HMAC-SHA256).
 * Contains: sub (auth user ID), role, exp (expiry timestamp).
 */
export function signContractorSession(authId: string, expiresInMs = DEFAULT_EXPIRES_IN_MS): string {
  const exp = Date.now() + expiresInMs;
  const payload = `${authId}:contractor:${exp}`;
  const signature = hmacSign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

/**
 * Verify a contractor session token. Returns auth user ID or null.
 */
export function verifyContractorSession(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const payload = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);

    const expected = hmacSign(payload);
    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const [authId, role, expStr] = payload.split(":");
    if (!authId || role !== "contractor") return null;

    const exp = parseInt(expStr, 10);
    if (isNaN(exp) || Date.now() > exp) return null;

    return authId;
  } catch {
    return null;
  }
}
