import { atom, computed } from 'nanostores';
import type { CartItem, CouponState } from '@/lib/types';
import { CATALOG, VALID_COUPON } from '@/lib/constants';

const isClient = typeof window !== 'undefined';
const CART_KEY = 'puka_cart';
const COUPON_KEY = 'puka_coupon';

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

function loadCoupon(): CouponState {
  if (!isClient) {
    return { applied: false, code: '', discountPercent: 0, error: '' };
  }
  try {
    const stored = localStorage.getItem(COUPON_KEY);
    if (stored) {
      return JSON.parse(stored) as CouponState;
    }
  } catch {
    return { applied: false, code: '', discountPercent: 0, error: '' };
  }
  return { applied: false, code: '', discountPercent: 0, error: '' };
}

export const $cart = atom<CartItem[]>(loadCart());

export const $coupon = atom<CouponState>(loadCoupon());

if (isClient) {
  $cart.listen((value) => {
    localStorage.setItem(CART_KEY, JSON.stringify(value));
  });
  $coupon.listen((value) => {
    localStorage.setItem(COUPON_KEY, JSON.stringify(value));
  });
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
  const normalized = code.trim().toUpperCase();
  if (normalized === VALID_COUPON.code) {
    $coupon.set({
      applied: true,
      code: normalized,
      discountPercent: VALID_COUPON.discountPercent,
      error: '',
    });
  } else {
    $coupon.set({
      applied: false,
      code: normalized,
      discountPercent: 0,
      error: `Código inválido. Intenta con "${VALID_COUPON.code}"`,
    });
  }
}

export function clearCoupon() {
  $coupon.set({ applied: false, code: '', discountPercent: 0, error: '' });
  if (isClient) {
    localStorage.removeItem(COUPON_KEY);
  }
}

export function applyGameCoupon() {
  const state = {
    applied: true,
    code: VALID_COUPON.code,
    discountPercent: VALID_COUPON.discountPercent,
    error: '',
  };
  $coupon.set(state);
  if (isClient) {
    localStorage.setItem(COUPON_KEY, JSON.stringify(state));
  }
}
