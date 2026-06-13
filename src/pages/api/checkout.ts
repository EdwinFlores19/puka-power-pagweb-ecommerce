import type { APIRoute } from 'astro';
import { PRICE_MAP, VALID_COUPON } from '../../lib/constants';
import type { OrderResponse } from '../../lib/types';
import { verifyWonCookie, WON_COOKIE_NAME } from '../../lib/session';
import { sendOrderConfirmation } from '../../lib/emails';

export const prerender = false;

const CC_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' };
const CC_FLAT = 'no-store, no-cache, must-revalidate, proxy-revalidate';

const handleAll: APIRoute = ({ request }) => {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      { status: 405, headers: CC_HEADERS },
    );
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': CC_FLAT } });
};

export const ALL = handleAll;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { items, couponCode, customer } = body as {
      items?: { id: number; qty: number }[];
      couponCode?: string;
      customer?: {
        name?: string;
        email?: string;
        phone?: string;
        dni?: string;
        address?: string;
        department?: string;
        province?: string;
        district?: string;
      };
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'El carrito está vacío' }),
        { status: 400, headers: CC_HEADERS },
      );
    }

    // Basic customer validation if provided
    if (customer) {
      if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Email inválido' }),
          { status: 400, headers: CC_HEADERS },
        );
      }
      if (customer.phone && !/^9[0-9]{8}$/.test(customer.phone)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Teléfono inválido (debe empezar con 9 y tener 9 dígitos)' }),
          { status: 400, headers: CC_HEADERS },
        );
      }
    }

    let subtotal = 0;
    for (const item of items) {
      if (!Number.isInteger(item.id) || !Number.isInteger(item.qty) || item.qty < 1) {
        return new Response(
          JSON.stringify({ success: false, error: `Producto inválido: id=${item.id}, qty=${item.qty}` }),
          { status: 400, headers: CC_HEADERS },
        );
      }

      const unitPrice = PRICE_MAP[item.id];
      if (unitPrice === undefined) {
        return new Response(
          JSON.stringify({ success: false, error: `Producto con id ${item.id} no encontrado` }),
          { status: 400, headers: CC_HEADERS },
        );
      }

      subtotal += unitPrice * item.qty;
    }

    let discount = 0;
    let appliedCoupon = '';
    // SECURITY: The BOLT15 coupon is only valid if the user has legitimately
    // won the campaign (signed cookie). This prevents DevTools/curl bypass.
    if (couponCode && couponCode.trim().toUpperCase() === VALID_COUPON.code) {
      // Read cookie both from the parsed `cookies` (Astro) and from the raw
      // header (fallback for edge cases).
      let wonSession = null as Awaited<ReturnType<typeof verifyWonCookie>>;
      try {
        const rawCookie = cookies.get(WON_COOKIE_NAME)?.value || null;
        // verifyWonCookie expects the full Cookie header. Reconstruct it.
        const header = rawCookie ? `${WON_COOKIE_NAME}=${rawCookie}` : null;
        wonSession = await verifyWonCookie(header);
      } catch {
        wonSession = null;
      }
      if (wonSession && wonSession.won === true) {
        discount = subtotal * VALID_COUPON.discountPercent;
        appliedCoupon = VALID_COUPON.code;
      }
      // If no won session → discount stays 0, no error returned (silent fail)
    }

    const total = subtotal - discount;
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    const orderId = `PK-${timestamp}-${random}`;

    const order: OrderResponse = {
      orderId,
      items: items.map((i) => ({ id: i.id, qty: i.qty })),
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      total: Math.round(total * 100) / 100,
      couponApplied: appliedCoupon,
      shipping: 0,
      createdAt: new Date().toISOString(),
      customer: customer && customer.email ? {
        name: customer.name || '',
        email: customer.email,
        phone: customer.phone || '',
        dni: customer.dni || '',
        address: customer.address || '',
        department: customer.department || '',
        province: customer.province || '',
        district: customer.district || '',
      } : undefined,
    };

    // Fire-and-forget: send the order-confirmation email (Resend).
    // If email fails for any reason, the order still succeeds.
    if (order.customer?.email) {
      try {
        await sendOrderConfirmation({
          to: order.customer.email,
          orderId,
          total: order.total,
          subtotal: order.subtotal,
          discount: order.discount,
          customer: order.customer,
          items: order.items,
        });
      } catch (e) {
        console.error('[checkout] Order email failed:', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...order }),
      { status: 200, headers: CC_HEADERS },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: CC_HEADERS },
    );
  }
};
