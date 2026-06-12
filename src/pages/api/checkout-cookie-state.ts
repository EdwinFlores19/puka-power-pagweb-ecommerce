import type { APIRoute } from 'astro';
import { verifyWonCookie, WON_COOKIE_NAME } from '@/lib/session';

export const prerender = false;

/**
 * GET /api/checkout-cookie-state
 * Returns { won: true } if the browser has a valid signed won-cookie.
 * Used by the client (cartStore.refreshCouponFromServer) to mirror
 * the server-side truth into the local UI state.
 */
export const GET: APIRoute = async ({ request, cookies }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    let raw = cookies.get(WON_COOKIE_NAME)?.value || null;
    if (!raw) {
      // Fallback: read the raw header
      const header = request.headers.get('cookie');
      if (header) {
        const part = header.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${WON_COOKIE_NAME}=`));
        if (part) raw = part.slice(WON_COOKIE_NAME.length + 1);
      }
    }
    const header = raw ? `${WON_COOKIE_NAME}=${raw}` : null;
    const session = await verifyWonCookie(header);
    if (session && session.won === true) {
      return new Response(JSON.stringify({ won: true, ts: session.ts }), {
        status: 200,
        headers: cc,
      });
    }
    return new Response(JSON.stringify({ won: false }), { status: 200, headers: cc });
  } catch (err) {
    return new Response(JSON.stringify({ won: false, error: (err as Error).message }), {
      status: 500,
      headers: cc,
    });
  }
};
