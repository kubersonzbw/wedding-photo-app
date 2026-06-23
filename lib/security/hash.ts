import { createHash, timingSafeEqual } from "crypto";

type GuestCodeHashes = {
  access_code_hash?: string | null;
  gallery_code_hash?: string | null;
};

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret.trim(), "utf8").digest("hex");
}

export function verifySecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(secret), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyGuestCode(secret: string, hashes: GuestCodeHashes): boolean {
  const code = secret.trim();
  if (!code) return false;
  return [hashes.access_code_hash, hashes.gallery_code_hash]
    .filter((hash): hash is string => Boolean(hash))
    .some((hash) => verifySecret(code, hash));
}
