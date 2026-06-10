import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  if (!plaintext) throw new Error('Password cannot be empty');
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length !== bBytes.length ? 1 : 0;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function verifyPassword(
  plaintext: string,
  stored: string
): Promise<{ valid: boolean; isLegacy: boolean }> {
  if (!plaintext || !stored) return { valid: false, isLegacy: false };

  const isBcrypt = stored.startsWith('$2b$') || stored.startsWith('$2a$');
  if (isBcrypt) {
    try {
      return { valid: await bcrypt.compare(plaintext, stored), isLegacy: false };
    } catch {
      return { valid: false, isLegacy: false };
    }
  }

  // Legacy plaintext path — temporary migration only
  return { valid: timingSafeEqual(plaintext, stored), isLegacy: true };
}
