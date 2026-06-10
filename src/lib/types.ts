export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  badge?: string;
  originalPrice?: number;
  unitLabel?: string;
}

export interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
  description: string;
  unitLabel?: string;
}

export interface CouponState {
  applied: boolean;
  code: string;
  discountPercent: number;
  error: string;
}

export interface CheckoutPayload {
  items: { id: number; qty: number }[];
  couponCode?: string;
}

export interface OrderResponse {
  orderId: string;
  items: { id: number; qty: number }[];
  subtotal: number;
  discount: number;
  total: number;
  couponApplied: string;
  shipping: number;
  createdAt: string;
}
