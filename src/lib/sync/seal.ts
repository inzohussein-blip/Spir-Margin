import crypto from "node:crypto";

/**
 * Sealing for office-network sync: AES-256-GCM under a key derived from the
 * secret in the sync code. A message that does not open was not made with
 * the code — that is the whole of the authentication. The operation name is
 * bound in as associated data, so a sealed "pull" cannot be passed off as a
 * "push". Self-contained, so the tests import it as is.
 *
 *   sealed = iv (12 bytes) · tag (16 bytes) · ciphertext
 */

function keyOf(secret: string): Buffer {
  return crypto.createHash("sha256").update("spir-margin lan sync v1\0").update(secret).digest();
}

export function seal(secret: string, op: string, plain: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", keyOf(secret), iv);
  c.setAAD(Buffer.from(`spir-sync/${op}`));
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

/** The plain message, or a throw if it was not sealed with this secret for this operation. */
export function unseal(secret: string, op: string, sealed: Buffer): Buffer {
  if (sealed.length < 28) throw new Error("sealed message too short");
  const d = crypto.createDecipheriv("aes-256-gcm", keyOf(secret), sealed.subarray(0, 12));
  d.setAAD(Buffer.from(`spir-sync/${op}`));
  d.setAuthTag(sealed.subarray(12, 28));
  return Buffer.concat([d.update(sealed.subarray(28)), d.final()]);
}

export function newSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}
