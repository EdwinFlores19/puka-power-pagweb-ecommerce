import type { APIRoute } from 'astro';

export const prerender = false;

interface StoredOrder {
  orderId: string;
  customerId?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    dni: string;
    address: string;
    department: string;
    province: string;
    district: string;
  };
  items: { id: number; qty: number; name?: string; price?: number }[];
  subtotal: number;
  discount: number;
  total: number;
  couponApplied: string;
  status: string;
  createdAt: string;
}

/**
 * GET /api/admin/orders
 * Password-protected endpoint that returns all orders stored server-side
 * (or empty if not yet wired to a real DB).
 *
 * Auth: HTTP Basic Auth with env vars ADMIN_USER + ADMIN_PASS.
 * Or `?key=...` with env var ADMIN_KEY for simpler integration.
 *
 * NOTE: This is a minimal admin endpoint. The full implementation
 * would query a database (Vercel KV, Postgres, etc.). For now, returns
 * the empty list unless orders are passed in via a different mechanism.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const env = (import.meta as any).env || process.env;
  const ADMIN_KEY = env.ADMIN_KEY;
  const ADMIN_USER = env.ADMIN_USER;
  const ADMIN_PASS = env.ADMIN_PASS;

  // Check auth: ?key=... OR Basic Auth
  const keyParam = url.searchParams.get('key');
  const authHeader = request.headers.get('authorization') || '';

  let authorized = false;
  if (ADMIN_KEY && keyParam === ADMIN_KEY) authorized = true;
  if (!authorized && ADMIN_USER && ADMIN_PASS) {
    const expected = 'Basic ' + Buffer.from(ADMIN_USER + ':' + ADMIN_PASS).toString('base64');
    if (authHeader === expected) authorized = true;
  }

  // If no admin credentials are set, allow the request to succeed but
  // return an empty list. This is a safe-by-default behaviour so the
  // endpoint doesn't accidentally leak in dev.
  if (!ADMIN_KEY && !ADMIN_PASS) {
    return new Response(
      JSON.stringify({
        orders: [],
        message: 'Admin endpoint not yet configured (set ADMIN_KEY or ADMIN_USER/ADMIN_PASS).',
      }),
      { status: 200, headers: cc },
    );
  }

  if (!authorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: {
          ...cc,
          'WWW-Authenticate': 'Basic realm="Puka Power Admin"',
        },
      },
    );
  }

  // TODO: query Vercel KV / DB for stored orders.
  // For now, return the placeholder list. The OrderHistory client page
  // also reads from localStorage on the client, so admins can still
  // see orders from the same browser.
  return new Response(
    JSON.stringify({ orders: [] as StoredOrder[] }),
    { status: 200, headers: cc },
  );
};
