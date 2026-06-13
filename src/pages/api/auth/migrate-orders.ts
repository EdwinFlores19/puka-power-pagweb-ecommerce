import type { APIRoute } from 'astro';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { migrateLocalOrdersToUser } from '@/lib/users';
import type { OrderRecord } from '@/lib/types';

export const prerender = false;

/**
 * POST /api/auth/migrate-orders
 * Body: { orders: [...] } (array of orders from localStorage)
 *
 * The client calls this right after sign-in to attach any anonymous
 * orders (in localStorage) to the user's account on the server.
 *
 * Returns: { migrated: number }
 */
export const POST: APIRoute = async ({ request }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const user = await getCurrentUserFromCookies(request.headers.get('cookie'));
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autenticado' }),
        { status: 401, headers: cc },
      );
    }

    const body = await request.json().catch(() => ({}));
    const orders = (body as any).orders as any[] | undefined;
    if (!Array.isArray(orders) || orders.length === 0) {
      return new Response(JSON.stringify({ success: true, migrated: 0 }), { status: 200, headers: cc });
    }

    // Basic shape validation
    const valid = orders.filter((o) =>
      o && typeof o.orderId === 'string' && typeof o.total === 'number' && o.customer && o.items,
    );

    const migrated = await migrateLocalOrdersToUser(user.id, valid as any);

    return new Response(
      JSON.stringify({ success: true, migrated }),
      { status: 200, headers: cc },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno', detail: (err as Error).message }),
      { status: 500, headers: cc },
    );
  }
};
