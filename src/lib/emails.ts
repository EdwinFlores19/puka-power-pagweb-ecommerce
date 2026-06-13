import type { CustomerInfo } from './types';

interface OrderConfirmationParams {
  to: string;
  orderId: string;
  total: number;
  subtotal: number;
  discount: number;
  customer: CustomerInfo;
  items: { id: number; qty: number }[];
}

const CATALOG: Record<number, { name: string; price: number }> = {
  1: { name: 'Reto Puka - 3 Días', price: 24.00 },
  2: { name: 'Six Pack Poder', price: 43.20 },
  3: { name: 'Suscripción Mensual', price: 153.60 },
};

/**
 * Send an order confirmation email to the customer. Uses Resend.
 *
 * Required env vars (already in use by the existing sendLead action):
 *   RESEND_API_KEY
 *   EMAIL_RECEPTOR  → used as the From address
 *
 * Falls back to console.log if RESEND_API_KEY is not set (dev mode).
 */
export async function sendOrderConfirmation(params: OrderConfirmationParams): Promise<void> {
  const { to, orderId, total, subtotal, discount, customer, items } = params;

  const itemsHtml = items
    .map((it) => {
      const c = CATALOG[it.id];
      const name = c?.name || `Producto #${it.id}`;
      const unit = c?.price ?? 0;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${name}</td>
        <td style="padding:8px;text-align:center;border-bottom:1px solid #e5e7eb;">${it.qty}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">S/ ${(unit * it.qty).toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const subject = `✅ Puka Power · Pedido #${orderId} confirmado`;

  const html = `
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Pedido confirmado</title></head>
<body style="font-family:Arial,sans-serif;background:#f7f5f0;padding:24px;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#7B1113 0%,#4A0507 100%);padding:32px 24px;text-align:center;color:#FFF9F2;">
      <h1 style="margin:0;font-size:28px;">¡Gracias por tu compra!</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.85;">Tu pedido de Puka Power ha sido confirmado</p>
    </div>
    <div style="padding:24px;">
      <p>Hola <strong>${customer.name || 'cliente'}</strong>,</p>
      <p>Recibimos tu pedido <strong>#${orderId}</strong> por S/ ${total.toFixed(2)}. Te enviaremos un mensaje por WhatsApp para coordinar la entrega.</p>

      <h3 style="margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#7B1113;">Resumen del pedido</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f7f5f0;">
            <th style="padding:8px;text-align:left;">Producto</th>
            <th style="padding:8px;text-align:center;">Cant.</th>
            <th style="padding:8px;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr><td colspan="2" style="padding:8px;text-align:right;">Subtotal:</td><td style="padding:8px;text-align:right;">S/ ${subtotal.toFixed(2)}</td></tr>
          ${discount > 0 ? `<tr><td colspan="2" style="padding:8px;text-align:right;color:#16a34a;">Descuento (15%):</td><td style="padding:8px;text-align:right;color:#16a34a;">- S/ ${discount.toFixed(2)}</td></tr>` : ''}
          <tr><td colspan="2" style="padding:8px;text-align:right;font-weight:bold;">Envío:</td><td style="padding:8px;text-align:right;color:#16a34a;">GRATIS</td></tr>
          <tr style="border-top:2px solid #7B1113;"><td colspan="2" style="padding:12px 8px;text-align:right;font-weight:bold;font-size:16px;">Total:</td><td style="padding:12px 8px;text-align:right;font-weight:bold;font-size:18px;color:#7B1113;">S/ ${total.toFixed(2)}</td></tr>
        </tfoot>
      </table>

      <h3 style="margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#7B1113;">Datos de envío</h3>
      <p style="font-size:14px;line-height:1.5;background:#f7f5f0;padding:12px;border-radius:8px;">
        ${customer.name}<br>
        ${customer.address}<br>
        ${customer.district}, ${customer.province}, ${customer.department}<br>
        Tel: ${customer.phone} · DNI/RUC: ${customer.dni}<br>
        Email: ${customer.email}
      </p>

      <p style="margin-top:24px;font-size:12px;color:#6b7280;">Si tienes alguna duda, contáctanos respondiendo este email.</p>
    </div>
    <div style="background:#1a1a1a;color:#FFF9F2;padding:16px;text-align:center;font-size:11px;">
      Puka Power · Energía ancestral peruana
    </div>
  </div>
</body>
</html>`.trim();

  const env = (import.meta as any).env || process.env;
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_RECEPTOR || 'no-reply@pukapower.pe';

  if (!apiKey) {
    console.log('[email/skip] RESEND_API_KEY not set. Order confirmation would have been sent to', to);
    console.log('[email/skip] Subject:', subject);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }
}
