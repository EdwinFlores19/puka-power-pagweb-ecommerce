import { atom, computed } from 'nanostores';
import type { CartItem, CouponState } from '../lib/types';
import { CATALOG } from '../lib/constants';

const CART_STORAGE_KEY = 'puka-power-cart';
const COUPON_STORAGE_KEY = 'puka-power-coupon';

function loadCartFromStorage(): CartItem[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const stored = sessionStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CartItem[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    return [];
  }
  return [];
}

function loadCouponFromStorage(): CouponState {
  if (typeof sessionStorage === 'undefined') {
    return { applied: false, code: '', discountPercent: 0, error: '' };
  }
  try {
    const stored = sessionStorage.getItem(COUPON_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as CouponState;
    }
  } catch {
    return { applied: false, code: '', discountPercent: 0, error: '' };
  }
  return { applied: false, code: '', discountPercent: 0, error: '' };
}

export const $cartReady = atom(false);

export const $cart = atom<CartItem[]>(loadCartFromStorage());

export const $coupon = atom<CouponState>(loadCouponFromStorage());

$cartReady.set(true);

$cart.listen((cart) => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }
});

$coupon.listen((coupon) => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
  }
});

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
    $cart.set(cart.map((item) =>
      item.id === productId ? { ...item, qty: item.qty + 1 } : item,
    ));
    return;
  }
  const product = CATALOG[productId];
  if (!product) return;
  $cart.set([...cart, { id: product.id, name: product.name, price: product.price, qty: 1, description: product.description, unitLabel: product.unitLabel }]);
}

export function decrementItemInCart(productId: number) {
  const cart = $cart.get();
  const existing = cart.find((item) => item.id === productId);
  if (!existing) return;
  if (existing.qty <= 1) {
    $cart.set(cart.filter((item) => item.id !== productId));
    return;
  }
  $cart.set(cart.map((item) =>
    item.id === productId ? { ...item, qty: item.qty - 1 } : item,
  ));
}

export function removeFromCart(productId: number) {
  $cart.set($cart.get().filter((item) => item.id !== productId));
}

export function clearCart() {
  $cart.set([]);
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(CART_STORAGE_KEY);
  }
}

export function applyCoupon(code: string) {
  const normalized = code.trim().toUpperCase();
  if (normalized === 'BOLT15') {
    $coupon.set({ applied: true, code: normalized, discountPercent: 0.15, error: '' });
  } else {
    $coupon.set({ applied: false, code: normalized, discountPercent: 0, error: 'Código inválido. Intenta con "BOLT15"' });
  }
}

export function clearCoupon() {
  $coupon.set({ applied: false, code: '', discountPercent: 0, error: '' });
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(COUPON_STORAGE_KEY);
  }
}
