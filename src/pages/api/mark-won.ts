import type { APIRoute } from 'astro';
import { buildWonCookie } from '@/lib/session';

/**
 * POST /api/mark-won
 * Called by the Advergame ONLY after the user legitimately wins the campaign
 * (LEVEL_COMPLETED on level 3 → "Reclamar Recompensas" button). Sets a
 * HttpOnly HMAC-signed cookie that /api/checkout uses to validate the 15% discount.
 *
 * Optional body: { score?: number } for analytics. Not required.
 */

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const cookieValue = await buildWonCookie();
    return new Response(
      JSON.stringify({ success: true, message: 'Game-won session recorded.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieValue,
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

/** GET is not allowed. */
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
};
