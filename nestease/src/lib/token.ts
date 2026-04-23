import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.LINK_SIGNING_SECRET?.trim();
if (!SECRET) throw new Error("Missing LINK_SIGNING_SECRET environment variable");
const DEFAULT_EXPIRES_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("hex").slice(0, 32);
}

// Generate a signed token for external links (tenant, contractor, owner)
export function generateToken(
  payload: { workOrderId: string; role: string; actorId: string },
  expiresInMs: number = DEFAULT_EXPIRES_IN_MS,
): string {
  const expires = Date.now() + expiresInMs;
  const data = `${payload.workOrderId}:${payload.role}:${payload.actorId}:${expires}`;
  const signature = sign(data);
  return Buffer.from(`${data}.${signature}`).toString("base64url");
}

// Verify and decode a signed token
export function verifyToken(token: string): { workOrderId: string; role: string; actorId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const data = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);

    const expected = sign(data);
    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    const parts = data.split(":");
    if (parts.length < 4) return null;
    const [workOrderId, role, actorId, expiresStr] = parts;
    if (!workOrderId || !role || !actorId) return null;

    const expires = parseInt(expiresStr, 10);
    if (isNaN(expires) || Date.now() > expires) return null;

    return { workOrderId, role, actorId };
  } catch {
    return null;
  }
}
