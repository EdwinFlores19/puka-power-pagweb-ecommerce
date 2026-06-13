/**
 * Lightweight analytics wrapper. Pushes events to window.dataLayer
 * (for GTM / GA4) and window.fbq (for Meta Pixel).
 *
 * The existing codebase already pushes game events (puka_campaign_start,
 * puka_level_up, puka_game_over, puka_campaign_victory) to dataLayer via
 * trackGameEvent. This module standardizes e-commerce events.
 *
 * Setup: set the GTM container id and Meta Pixel id in env vars
 *   PUBLIC_GTM_ID          → GTM-XXXXX
 *   PUBLIC_META_PIXEL_ID   → numeric id
 *
 * The scripts are loaded by /layouts/BaseLayout.astro via inline
 * conditional <script> tags (not bundled — they need to run first).
 */

declare global {
  interface Window {
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    gtag?: (...args: any[]) => void;
  }
}

export const PUBLIC_GTM_ID = (import.meta as any).env?.PUBLIC_GTM_ID || '';
export const PUBLIC_META_PIXEL_ID = (import.meta as any).env?.PUBLIC_META_PIXEL_ID || '';

/** Standard e-commerce event names (Google Analytics 4) */
export const EC_EVENTS = {
  VIEW_ITEM: 'view_item',
  ADD_TO_CART: 'add_to_cart',
  VIEW_CART: 'view_cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  ADD_SHIPPING_INFO: 'add_shipping_info',
  ADD_PAYMENT_INFO: 'add_payment_info',
  PURCHASE: 'purchase',
} as const;

export type EcommerceEvent = typeof EC_EVENTS[keyof typeof EC_EVENTS];

/** Common ecommerce event params */
export interface EcommerceParams {
  currency?: string;
  value?: number;
  items?: { id: string | number; name?: string; price?: number; quantity?: number }[];
  transaction_id?: string;
}

const defaultParams = { currency: 'PEN' };

export function trackEvent(event: string, params: EcommerceParams = {}): void {
  if (typeof window === 'undefined') return;
  const merged = { ...defaultParams, ...params };

  // Google Tag Manager / GA4
  if (window.dataLayer) {
    window.dataLayer.push({ event, ...merged });
  }

  // Meta Pixel (Facebook)
  if (typeof window.fbq === 'function') {
    const fbEvent = mapToMetaEvent(event);
    if (fbEvent) {
      window.fbq('track', fbEvent, merged);
    }
  }
}

function mapToMetaEvent(event: string): string | null {
  const map: Record<string, string> = {
    view_item: 'ViewContent',
    add_to_cart: 'AddToCart',
    view_cart: 'ViewContent',
    begin_checkout: 'InitiateCheckout',
    add_shipping_info: 'AddShippingInfo',
    add_payment_info: 'AddPaymentInfo',
    purchase: 'Purchase',
  };
  return map[event] || null;
}

/** High-level helpers for the typical e-commerce funnel */

export function trackAddToCart(item: { id: number; name: string; price: number; qty?: number }): void {
  trackEvent(EC_EVENTS.ADD_TO_CART, {
    items: [{ id: item.id, name: item.name, price: item.price, quantity: item.qty ?? 1 }],
    value: item.price * (item.qty ?? 1),
  });
}

export function trackBeginCheckout(cartValue: number, itemCount: number): void {
  trackEvent(EC_EVENTS.BEGIN_CHECKOUT, {
    value: cartValue,
    items: [{ id: 'cart', name: 'Cart', price: cartValue, quantity: itemCount }],
  });
}

export function trackPurchase(orderId: string, total: number, items: { id: number; name: string; price: number; quantity: number }[]): void {
  trackEvent(EC_EVENTS.PURCHASE, {
    transaction_id: orderId,
    value: total,
    items: items.map((it) => ({ id: it.id, name: it.name, price: it.price, quantity: it.quantity })),
  });
}
