/**
 * Password hashing & verification.
 *
 * Uses Web Crypto API (available in Node 18+ and Edge runtimes) — no
 * external dependencies. PBKDF2 / SHA-256 / 100k iterations / 16-byte
 * random salt per password.
 *
 * Storage format: `<salt-base64url>:<hash-base64url>`
 *  - salt = 16 random bytes
 *  - hash = PBKDF2-SHA-256(salt, password, 100_000 iterations, 32 bytes)
 *
 * Both are stored together so verification only needs the original
 * string — no separate salt index.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const b64urlEncode = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlDecode = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const randomBytes = (n: number): Uint8Array => {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
};

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** Hash a plain-text password. Returns `salt:hash` (both base64url). */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await pbkdf2(plain, salt, PBKDF2_ITERATIONS);
  return `${b64urlEncode(salt)}:${b64urlEncode(hash)}`;
}

/**
 * Verify a plain-text password against a stored `salt:hash` string.
 * Returns true on match. Constant-time compare via XOR to avoid
 * early-exit timing leaks.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored || !stored.includes(':')) return false;
  const [saltB64, hashB64] = stored.split(':', 2);
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = b64urlDecode(saltB64);
    expected = b64urlDecode(hashB64);
  } catch {
    return false;
  }
  const actual = await pbkdf2(plain, salt, PBKDF2_ITERATIONS);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/**
 * Lightweight server-side rate limiter for the login endpoint.
 * Limits to 5 failed attempts per 15-minute window per IP, in-memory
 * (resets when the serverless function recycles — acceptable for
 * free-tier abuse protection).
 */
const loginAttempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.firstAt > WINDOW_MS) return { allowed: true };
  if (rec.count >= MAX_FAILS) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - rec.firstAt) };
  }
  return { allowed: true };
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: now });
  } else {
    rec.count += 1;
    loginAttempts.set(ip, rec);
  }
}

export function clearLoginFailures(ip: string): void {
  loginAttempts.delete(ip);
}

export const PASSWORD_ITERATIONS = PBKDF2_ITERATIONS;
