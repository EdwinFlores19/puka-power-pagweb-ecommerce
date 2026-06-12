export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  badge?: string;
  originalPrice?: string;
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

export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  dni: string;
  address: string;
  department: string;
  province: string;
  district: string;
}

export interface CheckoutPayload {
  items: { id: number; qty: number }[];
  couponCode?: string;
  customer?: Partial<CustomerInfo>;
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
  customer?: CustomerInfo;
}

// Persistent customer record (Mi Cuenta)
export interface CustomerRecord extends CustomerInfo {
  id: string;
  createdAt: string;
  lastOrderAt?: string;
  totalSpent: number;
  totalOrders: number;
}

export interface OrderRecord {
  orderId: string;
  customerId: string;
  customer: CustomerInfo;
  items: { id: number; qty: number; name?: string; price?: number }[];
  subtotal: number;
  discount: number;
  total: number;
  couponApplied: string;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  paidAt?: string;
  shippedAt?: string;
  trackingNumber?: string;
}
