import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const ITERATIONS = 240000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashPassword(plain: string) {
  if (!plain) throw new Error('Password vazio');
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(plain, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored?: string | null) {
  if (!plain || !stored) return false;
  if (!stored.startsWith('pbkdf2$')) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const hash = parts[3];
  const derived = pbkdf2Sync(plain, salt, iterations || ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  try {
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}
