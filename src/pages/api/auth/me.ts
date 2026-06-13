import type { APIRoute } from 'astro';
import { getCurrentUserFromCookies } from '@/lib/auth';

export const prerender = false;

/**
 * GET /api/auth/me
 * Returns the current user (or null) based on the session cookie.
 * Used by the client (Header, mi-cuenta) to know if the user is signed in.
 */
export const GET: APIRoute = async ({ request }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const cookieHeader = request.headers.get('cookie');
  const user = await getCurrentUserFromCookies(cookieHeader);
  if (!user) {
    return new Response(JSON.stringify({ user: null }), { status: 200, headers: cc });
  }
  // Don't leak the internal ID unnecessarily; the client just needs to
  // know the basics for the header.
  return new Response(
    JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        totalOrders: user.totalOrders,
        totalSpent: user.totalSpent,
        createdAt: user.createdAt,
      },
    }),
    { status: 200, headers: cc },
  );
};
