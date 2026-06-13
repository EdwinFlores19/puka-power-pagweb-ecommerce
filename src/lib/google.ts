/**
 * Google OAuth 2.0 helpers.
 *
 * Required env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REDIRECT_URI   → e.g. https://pukapower.pe/api/auth/google/callback
 *
 * The flow is the standard "Authorization Code" flow:
 *   1. /api/auth/google/start     → redirect to Google
 *   2. Google redirects back to /api/auth/google/callback?code=...&state=...
 *   3. We POST the code to https://oauth2.googleapis.com/token
 *   4. We GET https://www.googleapis.com/oauth2/v2/userinfo with the access_token
 *   5. We create/update the user in KV, set the user session cookie.
 *
 * Docs: https://developers.google.com/identity/protocols/oauth2/web-server
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export function isGoogleConfigured(): boolean {
  const env = (import.meta as any).env || process.env;
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
}

export interface GoogleAuthUrlOptions {
  state: string;
  scope?: string;
  prompt?: 'none' | 'consent' | 'select_account';
}

export function buildGoogleAuthUrl(opts: GoogleAuthUrlOptions): string {
  const env = (import.meta as any).env || process.env;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('Google OAuth not configured');
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: opts.scope || 'openid email profile',
    state: opts.state,
    access_type: 'online',
    ...(opts.prompt ? { prompt: opts.prompt } : {}),
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export async function exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
  const env = (import.meta as any).env || process.env;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('Google OAuth not configured');
  }
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${err}`);
  }
  return res.json();
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google userinfo fetch failed (${res.status}): ${err}`);
  }
  return res.json();
}
