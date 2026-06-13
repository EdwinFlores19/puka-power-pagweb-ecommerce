import type { APIRoute } from 'astro';
import { formatAmountToCents } from '@/lib/culqi';

export const prerender = false;

/**
 * POST /api/culqi/charge
 * Server-side charge creation. Called by PaymentModal after the user
 * has tokenized their card via Culqi Checkout v4 (client-side).
 *
 * Required env vars:
 *   CULQI_SECRET_KEY
 *
 * Body:
 *   {
 *     sourceId: string,           // token from Culqi Checkout
 *     amount: number,             // in soles
 *     email: string,
 *     description: string,
 *     customer: { name, phone, dni, address, ... }
 *     items: [{ id, qty }],
 *     orderId: string             // our internal order id
 *   }
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const body = await request.json();
    const { sourceId, amount, email, description, customer, items, orderId } = body as {
      sourceId?: string;
      amount?: number;
      email?: string;
      description?: string;
      customer?: {
        name?: string;
        phone?: string;
        dni?: string;
        address?: string;
        department?: string;
        province?: string;
        district?: string;
      };
      items?: { id: number; qty: number }[];
      orderId?: string;
    };

    if (!sourceId || !amount || !email || !orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan datos del pago' }),
        { status: 400, headers: cc },
      );
    }

    const env = (import.meta as any).env || process.env;
    const CULQI_SECRET_KEY = env.CULQI_SECRET_KEY;

    if (!CULQI_SECRET_KEY) {
      // Dev / no-config mode: accept the order without real charge.
      // The PaymentModal should fall back to the simulated flow in this case.
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'simulated',
          message: 'CULQI_SECRET_KEY no configurada. Pago simulado (modo desarrollo).',
          charge: {
            id: 'sim_' + Date.now().toString(36),
            object: 'charge',
            amount: formatAmountToCents(amount),
            currency: 'PEN',
            email,
            status: 'paid',
            reference_code: orderId,
            created_at: Date.now(),
          },
        }),
        { status: 200, headers: cc },
      );
    }

    // Real Culqi charge creation
    const [firstName, ...lastParts] = (customer?.name || '').trim().split(' ');
    const lastName = lastParts.join(' ') || '-';

    const culqiBody = {
      amount: formatAmountToCents(amount),
      currency_code: 'PEN',
      email,
      source_id: sourceId,
      description: description || 'Pedido Puka Power',
      reference_code: orderId,
      antifraud: {
        firstName: firstName || 'Cliente',
        lastName,
        address: customer?.address,
        addressCity: customer?.district || customer?.province || 'Lima',
        countryCode: 'PE',
        phone: customer?.phone,
      },
      metadata: {
        order_id: orderId,
        items_count: (items || []).reduce((s, i) => s + i.qty, 0),
        dni: customer?.dni || '',
        ...(customer?.department ? { department: customer.department } : {}),
      },
    };

    const culqiRes = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CULQI_SECRET_KEY}`,
      },
      body: JSON.stringify(culqiBody),
    });

    const culqiData: any = await culqiRes.json();

    if (!culqiRes.ok || culqiData.object === 'error') {
      return new Response(
        JSON.stringify({
          success: false,
          error: culqiData.merchant_message || culqiData.user_message || 'Pago rechazado',
          culqi: culqiData,
        }),
        { status: 400, headers: cc },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'live',
        charge: {
          id: culqiData.id,
          object: 'charge',
          amount: culqiData.amount,
          currency: 'PEN',
          email: culqiData.email,
          status: culqiData.outcome?.type === 'sale' ? 'paid' : 'pending',
          reference_code: culqiData.reference_code,
          created_at: culqiData.creation_date ? culqiData.creation_date * 1000 : Date.now(),
        },
      }),
      { status: 200, headers: cc },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error al procesar el pago', detail: (err as Error).message }),
      { status: 500, headers: cc },
    );
  }
};
