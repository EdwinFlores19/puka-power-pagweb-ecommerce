/**
 * Session helpers — HMAC-signed cookies for "won game" and "magic link" state.
 * No external dependencies — uses Web Crypto API (available in Node 18+ and Edge runtime).
 *
 * Cookie format: base64url(payload).base64url(signature)
 *   payload   = JSON.stringify({ won: true, ts: 1700000000000 })
 *   signature = HMAC-SHA256(payload, SESSION_SECRET)  → base64url
 *
 * Required env var: SESSION_SECRET (Vercel project settings).
 * In dev, falls back to a deterministic dev-only secret so the flow still works.
 */

const COOKIE_NAME = 'puka_won_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const env = (import.meta as any).env || (typeof process !== 'undefined' ? process.env : {});
  const secret = env.SESSION_SECRET || 'dev-only-secret-do-not-use-in-prod-12345678';
  cachedSecret = secret;
  return secret;
}

// ---------- base64url helpers ----------
function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToStr(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

// ---------- HMAC-SHA256 ----------
async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    strToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, strToBytes(message));
  return b64urlEncode(new Uint8Array(sig));
}

async function hmacVerify(message: string, signatureB64: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    strToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = b64urlDecode(signatureB64);
  return crypto.subtle.verify('HMAC', key, sigBytes, strToBytes(message));
}

// ---------- Public API ----------

export interface WonSessionPayload {
  won: true;
  ts: number;
}

/** Returns the value to set in a `Set-Cookie` header. */
export async function buildWonCookie(): Promise<string> {
  const payload: WonSessionPayload = { won: true, ts: Date.now() };
  const json = JSON.stringify(payload);
  const encoded = b64urlEncode(strToBytes(json));
  const sig = await hmacSign(encoded, getSecret());
  const value = `${encoded}.${sig}`;
  return [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    // 'Secure' is added in production via the deploy
  ].join('; ');
}

export async function buildClearedWonCookie(): Promise<string> {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

/** Parses the cookie header. Returns null if missing/invalid/expired. */
export async function verifyWonCookie(cookieHeader: string | null | undefined): Promise<WonSessionPayload | null> {
  if (!cookieHeader) return null;
  // Look for our cookie inside the header
  const parts = cookieHeader.split(';').map((p) => p.trim());
  const raw = parts.find((p) => p.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  const value = raw.slice(COOKIE_NAME.length + 1);
  const dot = value.indexOf('.');
  if (dot < 0) return null;
  const encoded = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const ok = await hmacVerify(encoded, sig, getSecret());
  if (!ok) return null;
  let json: string;
  try {
    json = bytesToStr(b64urlDecode(encoded));
  } catch {
    return null;
  }
  let payload: WonSessionPayload;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!payload || payload.won !== true || typeof payload.ts !== 'number') return null;
  // Optional TTL (default 30 days)
  const ageMs = Date.now() - payload.ts;
  if (ageMs < 0 || ageMs > COOKIE_MAX_AGE * 1000) return null;
  return payload;
}

export const WON_COOKIE_NAME = COOKIE_NAME;
