import type { APIRoute } from 'astro';
import { PRICE_MAP, VALID_COUPON } from '../../lib/constants';
import type { OrderResponse } from '../../lib/types';

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { items, couponCode } = body as {
      items?: { id: number; qty: number }[];
      couponCode?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'El carrito está vacío' }),
        { status: 400, headers: CC_HEADERS },
      );
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
    if (couponCode?.trim().toUpperCase() === VALID_COUPON.code) {
      discount = subtotal * VALID_COUPON.discountPercent;
      appliedCoupon = VALID_COUPON.code;
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
    };

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
