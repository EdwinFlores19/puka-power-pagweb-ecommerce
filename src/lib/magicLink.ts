import type { MagicLinkToken } from './types';
import { kvGet, kvSet, kvDel } from './kv';

// Reuse the same HMAC helpers as session.ts via a separate file that
// doesn't import session.ts (to avoid circular dependencies).
// We re-implement the sign/verify here for one specific payload.

const b64urlEncode = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlDecode = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};
const strToBytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const bytesToStr = (b: Uint8Array): string => new TextDecoder().decode(b);

let cachedSecret: string | null = null;
function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const env = (import.meta as any).env || process.env;
  cachedSecret = env.SESSION_SECRET || 'dev-only-secret-do-not-use-in-prod-12345678';
  return cachedSecret;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', strToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, strToBytes(message));
  return b64urlEncode(new Uint8Array(sig));
}

async function hmacVerify(message: string, sigB64: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', strToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, b64urlDecode(sigB64), strToBytes(message));
}

/** Sign a payload to produce a magic-link token. */
async function signToken(payload: object): Promise<string> {
  const json = JSON.stringify(payload);
  const encoded = b64urlEncode(strToBytes(json));
  const sig = await hmacSign(encoded, getSecret());
  return `${encoded}.${sig}`;
}

async function verifyToken(token: string): Promise<any | null> {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const ok = await hmacVerify(encoded, sig, getSecret());
  if (!ok) return null;
  let json: string;
  try { json = bytesToStr(b64urlDecode(encoded)); } catch { return null; }
  try { return JSON.parse(json); } catch { return null; }
}

// ---------- Public API ----------

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface CreateMagicLinkInput {
  email: string;
  intent: 'login' | 'register';
  ttlMs?: number;
}

/**
 * Create a magic-link token. The signed token is returned to the caller
 * (caller should put it in the URL). We also keep a copy in KV (keyed
 * by the token's random id) so we can invalidate it after first use
 * (one-time links).
 */
export async function createMagicLink(input: CreateMagicLinkInput): Promise<{ token: string; expiresAt: string }> {
  const ttl = input.ttlMs ?? TOKEN_TTL_MS;
  const now = Date.now();
  const expiresAt = new Date(now + ttl).toISOString();
  // Embed a nonce (not just the payload) so each link is unique even
  // for the same email.
  const nonce = Math.random().toString(36).slice(2, 12);
  const tokenRecord: MagicLinkToken = {
    token: nonce,
    email: input.email.trim().toLowerCase(),
    intent: input.intent,
    createdAt: new Date(now).toISOString(),
    expiresAt,
  };
  await kvSet('magic-link:' + nonce, tokenRecord);
  // The signed token in the URL is the nonce + the rest of the data
  // (signed, so an attacker can't forge a token by guessing the nonce).
  const signed = await signToken(tokenRecord);
  return { token: signed, expiresAt };
}

export interface VerifyMagicLinkResult {
  valid: boolean;
  email?: string;
  intent?: 'login' | 'register';
  reason?: 'not_found' | 'expired' | 'invalid_signature' | 'already_used';
}

/**
 * Verify a magic-link token. Marks it as used (one-time).
 * The user must still call createUser / getUserByEmail etc. based on
 * the returned `email` and `intent`.
 */
export async function verifyMagicLink(token: string): Promise<VerifyMagicLinkResult> {
  if (!token) return { valid: false, reason: 'not_found' };
  const payload = await verifyToken(token);
  if (!payload || typeof payload.token !== 'string') {
    return { valid: false, reason: 'invalid_signature' };
  }
  // Check the KV record (which we also use to invalidate)
  const record = await kvGet<MagicLinkToken>('magic-link:' + payload.token);
  if (!record) return { valid: false, reason: 'not_found' };
  if (record.email !== payload.email || record.intent !== payload.intent || record.expiresAt !== payload.expiresAt) {
    return { valid: false, reason: 'invalid_signature' };
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await kvDel('magic-link:' + payload.token);
    return { valid: false, reason: 'expired' };
  }
  // One-time: invalidate after first valid use
  await kvDel('magic-link:' + payload.token);
  return { valid: true, email: payload.email, intent: payload.intent };
}
