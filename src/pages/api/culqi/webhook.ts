import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * POST /api/culqi/webhook
 * Culqi webhook for asynchronous payment notifications (refunds, chargebacks,
 * etc.). Configure this URL in the Culqi dashboard:
 *   https://dashboard.culqi.com/#/webhooks
 *
 * Note: This is a SERVER-ONLY endpoint. Culqi requires the URL to be HTTPS
 * and reachable. For local dev, use a tool like ngrok.
 *
 * Body from Culqi (Charge event):
 *   {
 *     "object": "event",
 *     "type": "charge.charge.succeeded" | "charge.charge.failed" | "charge.refund.created",
 *     "data": { ... full charge object ... }
 *   }
 *
 * We verify the Authorization header against CULQI_WEBHOOK_SECRET (set in
 * Culqi dashboard). If verification fails → 401.
 */
export const POST: APIRoute = async ({ request }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const env = (import.meta as any).env || process.env;
    const CULQI_WEBHOOK_SECRET = env.CULQI_WEBHOOK_SECRET;

    // Verify webhook signature (Culqi sends a Bearer token in the header)
    const authHeader = request.headers.get('authorization') || '';
    if (CULQI_WEBHOOK_SECRET) {
      if (authHeader !== `Bearer ${CULQI_WEBHOOK_SECRET}`) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: cc },
        );
      }
    }

    const body = await request.json();
    const { type, data } = body as { type?: string; data?: any };

    // Persist event for audit / future processing.
    // In production, write to a queue / DB. For now, console-log.
    console.log('[culqi-webhook]', type, data?.id, data?.reference_code);

    // TODO (Phase 6 / Vercel KV): update the order status in storage
    // based on the event type:
    //   - charge.charge.succeeded → mark order as 'paid'
    //   - charge.charge.failed    → mark order as 'cancelled'
    //   - charge.refund.created    → mark order as 'cancelled' + record refund
    //   - charge.dispute.created  → alert admin
    // For now this is a no-op.

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: cc });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', detail: (err as Error).message }),
      { status: 500, headers: cc },
    );
  }
};
