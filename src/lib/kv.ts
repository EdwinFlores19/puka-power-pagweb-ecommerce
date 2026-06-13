/**
 * Persistence layer. Tries Vercel KV first (serverless-friendly Redis),
 * falls back to a JSON file on disk when KV is not configured.
 *
 * This lets the auth feature work in:
 *   - Production: Vercel KV (free tier: 30K req/day, 256MB)
 *   - Local dev:   just a JSON file at /tmp/puka-kv.json
 *
 * Required env vars (production):
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 *
 * Both are auto-injected by Vercel when you create a KV database
 * and link it to the project.
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

// --- Type for the Vercel KV REST client (lazy-loaded) ---
type KvClient = {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
};

let kvClient: KvClient | null = null;
let kvClientTried = false;

async function getKvClient(): Promise<KvClient | null> {
  if (kvClientTried) return kvClient;
  kvClientTried = true;
  const env = (import.meta as any).env || process.env;
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    kvClient = null;
    return null;
  }
  // Vercel KV REST API: https://vercel.com/docs/storage/vercel-kv/quickstart
  const baseUrl = env.KV_REST_API_URL;
  const token = env.KV_REST_API_TOKEN;
  kvClient = {
    async get<T = unknown>(key: string): Promise<T | null> {
      const res = await fetch(`${baseUrl}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      if (data.result == null) return null;
      try { return JSON.parse(data.result) as T; } catch { return data.result as T; }
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      await fetch(`${baseUrl}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(value) }),
      });
    },
    async del(key: string): Promise<void> {
      await fetch(`${baseUrl}/del/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    async keys(pattern: string): Promise<string[]> {
      // Vercel KV: pattern is *, not a regex
      const res = await fetch(`${baseUrl}/keys/${encodeURIComponent(pattern)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      return Array.isArray(data.result) ? data.result : [];
    },
  };
  return kvClient;
}

// --- JSON file fallback for dev / no-config ---
const JSON_FILE = process.env.PUKA_KV_FILE || '/tmp/puka-kv.json';
let jsonCache: Record<string, unknown> | null = null;
let jsonCacheLoaded = false;

async function loadJson(): Promise<Record<string, unknown>> {
  if (jsonCacheLoaded) return jsonCache!;
  jsonCacheLoaded = true;
  try {
    const raw = await fs.readFile(JSON_FILE, 'utf8');
    jsonCache = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    jsonCache = {};
  }
  return jsonCache!;
}

async function saveJson(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(JSON_FILE), { recursive: true });
    await fs.writeFile(JSON_FILE, JSON.stringify(jsonCache, null, 2), 'utf8');
  } catch (e) {
    console.warn('[kv-fs] Could not write', JSON_FILE, e);
  }
}

// --- Public API ---

/** Read a JSON-serializable value. Returns null if missing. */
export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  const client = await getKvClient();
  if (client) return client.get<T>(key);
  const cache = await loadJson();
  return (cache[key] as T) ?? null;
}

/** Write a JSON-serializable value. */
export async function kvSet<T = unknown>(key: string, value: T): Promise<void> {
  const client = await getKvClient();
  if (client) return client.set<T>(key, value);
  const cache = await loadJson();
  cache[key] = value;
  await saveJson();
}

/** Delete a key. */
export async function kvDel(key: string): Promise<void> {
  const client = await getKvClient();
  if (client) return client.del(key);
  const cache = await loadJson();
  delete cache[key];
  await saveJson();
}

/** Get all keys matching a pattern (`*` = all, `user:*` = prefix). */
export async function kvKeys(pattern: string): Promise<string[]> {
  const client = await getKvClient();
  if (client) return client.keys(pattern);
  const cache = await loadJson();
  const rx = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return Object.keys(cache).filter((k) => rx.test(k));
}

/** Read a list of items under a prefix (e.g. `user:*` → array of values). */
export async function kvListByPrefix<T = unknown>(prefix: string): Promise<T[]> {
  const keys = await kvKeys(prefix + '*');
  if (keys.length === 0) return [];
  const items = await Promise.all(keys.map((k) => kvGet<T>(k)));
  return items.filter((x): x is T => x !== null);
}

/** Returns true if Vercel KV is configured. */
export function isKvConfigured(): boolean {
  const env = (import.meta as any).env || process.env;
  return !!(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
}
