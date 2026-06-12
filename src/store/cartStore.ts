import { atom, computed } from 'nanostores';
import type { CartItem, CouponState } from '@/lib/types';
import { CATALOG, VALID_COUPON } from '@/lib/constants';

const isClient = typeof window !== 'undefined';
const CART_KEY = 'puka_cart';

/**
 * Coupon state is no longer trusted from localStorage on its own.
 * The 15% discount is granted ONLY when the server has set a signed
 * "puka_won_session" cookie via POST /api/mark-won. The client side
 * reflects that server-side truth (called /api/checkout-cookie-state).
 *
 * The local puka_coupon key is now READ-ONLY and is rewritten only by
 * refreshCouponFromServer() — never manually settable.
 */
function loadCoupon(): CouponState {
  return { applied: false, code: '', discountPercent: 0, error: '' };
}

function loadCart(): CartItem[] {
  if (!isClient) return [];
  try {
    const stored = localStorage.getItem(CART_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CartItem[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    return [];
  }
  return [];
}

export const $cart = atom<CartItem[]>(loadCart());

export const $coupon = atom<CouponState>(loadCoupon());

if (isClient) {
  $cart.listen((value) => {
    localStorage.setItem(CART_KEY, JSON.stringify(value));
  });
  // NOTE: $coupon is intentionally NOT auto-persisted to localStorage anymore.
  // Its state is dictated by the server's won-session cookie.
}

export const $subtotal = computed($cart, (cart) =>
  cart.reduce((sum, item) => sum + item.price * item.qty, 0),
);

export const $totalQty = computed($cart, (cart) =>
  cart.reduce((sum, item) => sum + item.qty, 0),
);

export const $discount = computed([$subtotal, $coupon], (subtotal, coupon) =>
  subtotal * coupon.discountPercent,
);

export const $total = computed([$subtotal, $discount], (subtotal, discount) =>
  subtotal - discount,
);

export function addItemToCart(productId: number) {
  const cart = $cart.get();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    $cart.set(
      cart.map((item) =>
        item.id === productId ? { ...item, qty: item.qty + 1 } : item,
      ),
    );
    return;
  }
  const product = CATALOG[productId];
  if (!product) return;
  $cart.set([
    ...cart,
    {
      id: product.id,
      name: product.name,
      price: product.price,
      qty: 1,
      description: product.description,
      unitLabel: product.unitLabel,
    },
  ]);
}

export function decrementItemInCart(productId: number) {
  const cart = $cart.get();
  const existing = cart.find((item) => item.id === productId);
  if (!existing) return;
  if (existing.qty <= 1) {
    $cart.set(cart.filter((item) => item.id !== productId));
    return;
  }
  $cart.set(
    cart.map((item) =>
      item.id === productId ? { ...item, qty: item.qty - 1 } : item,
    ),
  );
}

export function removeFromCart(productId: number) {
  $cart.set($cart.get().filter((item) => item.id !== productId));
}

export function clearCart() {
  $cart.set([]);
  if (isClient) {
    localStorage.removeItem(CART_KEY);
  }
}

export function applyCoupon(code: string) {
  // Manual entry is now disabled — only the won-coupon path can apply the discount.
  // Kept for backward compat (some tests may call it). Always no-op.
  const normalized = code.trim().toUpperCase();
  $coupon.set({
    applied: false,
    code: normalized,
    discountPercent: 0,
    error: 'El cupón solo se aplica al ganar la campaña',
  });
}

export function clearCoupon() {
  $coupon.set({ applied: false, code: '', discountPercent: 0, error: '' });
}

/**
 * Refreshes $coupon from the server. Called by the client when the
 * game is won (after POST /api/mark-won) or when /tienda loads (in
 * case the user has a valid won-cookie from a previous session).
 *
 * The endpoint tells us "yes, this browser has a valid won cookie"
 * and we reflect that locally so the UI can show the discount badge.
 */
export async function refreshCouponFromServer(): Promise<boolean> {
  if (!isClient) return false;
  try {
    const res = await fetch('/api/checkout-cookie-state', {
      method: 'GET',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      $coupon.set({ applied: false, code: '', discountPercent: 0, error: '' });
      return false;
    }
    const data = await res.json();
    if (data && data.won === true) {
      $coupon.set({
        applied: true,
        code: VALID_COUPON.code,
        discountPercent: VALID_COUPON.discountPercent,
        error: '',
      });
      return true;
    } else {
      $coupon.set({ applied: false, code: '', discountPercent: 0, error: '' });
      return false;
    }
  } catch {
    $coupon.set({ applied: false, code: '', discountPercent: 0, error: '' });
    return false;
  }
}

/**
 * Called by the Advergame ONLY after the user wins the campaign.
 * Posts to /api/mark-won (which sets the signed HttpOnly cookie),
 * then refreshes the local coupon state from the server.
 */
export async function markGameWon(): Promise<boolean> {
  if (!isClient) return false;
  try {
    const res = await fetch('/api/mark-won', {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    return await refreshCouponFromServer();
  } catch {
    return false;
  }
}
