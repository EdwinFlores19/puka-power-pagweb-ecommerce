import type { APIRoute } from 'astro';
import { buildGoogleAuthUrl, isGoogleConfigured } from '@/lib/google';
import { buildOAuthStateCookie } from '@/lib/session';

export const prerender = false;

/**
 * GET /api/auth/google/start
 * Initiates the Google OAuth flow. Generates a random state, stores
 * it in a short-lived cookie, and redirects to Google.
 */
export const GET: APIRoute = async ({ url, request }) => {
  if (!isGoogleConfigured()) {
    return new Response(
      JSON.stringify({ error: 'Google OAuth no está configurado en este servidor' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Generate a random state for CSRF protection
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const authUrl = buildGoogleAuthUrl({ state });
  const stateCookie = buildOAuthStateCookie(state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl,
      'Set-Cookie': stateCookie,
    },
  });
};
