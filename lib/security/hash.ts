import { createHash, timingSafeEqual } from "crypto";

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret.trim(), "utf8").digest("hex");
}

export function verifySecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
