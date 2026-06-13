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

// --- Auth types ---

/** Authenticated user record (persisted server-side in KV). */
export interface User {
  id: string;                // ULID
  email: string;             // primary key (lowercased)
  name?: string;
  surname?: string;          // apellidos
  phone?: string;
  avatarUrl?: string;        // Google profile picture (if Google OAuth)
  googleId?: string;         // if signed up via Google
  passwordHash?: string;     // PBKDF2 salt+hash, set when registered with password
  /** Shipping address captured at registration (prefills checkout). */
  address?: string;
  department?: string;
  province?: string;
  district?: string;
  emailVerified: boolean;    // true after a magic link click OR Google OAuth
  createdAt: string;
  lastLoginAt: string;
  totalOrders: number;
  totalSpent: number;
}

/** Server-side session record. The cookie value is signed (HMAC). */
export interface UserSession {
  token: string;
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;         // 30 days
}

/** Single-use, short-lived token sent via email. */
export interface MagicLinkToken {
  token: string;
  email: string;
  intent: 'login' | 'register';
  createdAt: string;
  expiresAt: string;         // 15 minutes
}
