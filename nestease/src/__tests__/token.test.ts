import { describe, it, expect, vi, afterEach } from "vitest";
import { generateToken, verifyToken } from "@/lib/token";

describe("Token — generateToken + verifyToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const payload = {
    workOrderId: "wo-123",
    role: "contractor",
    actorId: "actor-456",
  };

  it("generates a base64url-encoded string", () => {
    const token = generateToken(payload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    // base64url should not contain +, /, or =
    expect(token).not.toMatch(/[+/=]/);
  });

  it("round-trips: verify(generate(payload)) returns original payload", () => {
    const token = generateToken(payload);
    const result = verifyToken(token);
    expect(result).toEqual(payload);
  });

  it("rejects a tampered token (modified payload)", () => {
    const token = generateToken(payload);
    // Decode, tamper with workOrderId, re-encode
    const decoded = Buffer.from(token, "base64url").toString();
    const tampered = decoded.replace("wo-123", "wo-999");
    const tamperedToken = Buffer.from(tampered).toString("base64url");
    expect(verifyToken(tamperedToken)).toBeNull();
  });

  it("rejects a tampered token (modified signature)", () => {
    const token = generateToken(payload);
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    const data = decoded.slice(0, lastDot);
    const badSig = "a".repeat(32);
    const tamperedToken = Buffer.from(`${data}.${badSig}`).toString("base64url");
    expect(verifyToken(tamperedToken)).toBeNull();
  });

  it("rejects an expired token", () => {
    // Generate with negative expiry (already expired)
    const token = generateToken(payload, -1000);
    expect(verifyToken(token)).toBeNull();
  });

  it("accepts a token within expiry window", () => {
    const token = generateToken(payload, 60_000); // 1 minute
    expect(verifyToken(token)).toEqual(payload);
  });

  it("rejects garbage input", () => {
    expect(verifyToken("not-a-token")).toBeNull();
    expect(verifyToken("")).toBeNull();
    expect(verifyToken("aGVsbG8=")).toBeNull(); // "hello" in base64
  });

  it("rejects token with missing parts", () => {
    // Only workOrderId:role (missing actorId and expires)
    const partial = Buffer.from("wo-123:contractor.fakesig").toString("base64url");
    expect(verifyToken(partial)).toBeNull();
  });

  it("handles different payload values", () => {
    const p2 = { workOrderId: "abc-def", role: "tenant", actorId: "tenant-1" };
    const token = generateToken(p2);
    expect(verifyToken(token)).toEqual(p2);
  });
});
