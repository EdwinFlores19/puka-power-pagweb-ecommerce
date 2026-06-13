import type { APIRoute } from 'astro';
import { buildClearedUserCookie } from '@/lib/session';

export const prerender = false;

/**
 * POST /api/auth/logout
 * Clears the user session cookie and returns 200.
 */
export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': await buildClearedUserCookie(),
      'Cache-Control': 'no-store',
    },
  });
};

/** GET also supported (so users can navigate to /api/auth/logout directly). */
export const GET: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': await buildClearedUserCookie(),
    },
  });
};
