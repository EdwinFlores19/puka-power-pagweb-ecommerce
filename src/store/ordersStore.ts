import { atom, computed } from 'nanostores';
import type { OrderRecord, CustomerInfo, CustomerRecord } from '@/lib/types';

const isClient = typeof window !== 'undefined';
const ORDER_KEY = 'puka_orders';
const CUSTOMER_KEY = 'puka_customers';

// LocalStorage-only persistence (until Vercel KV / DB is available).
function loadOrders(): OrderRecord[] {
  if (!isClient) return [];
  try {
    const stored = localStorage.getItem(ORDER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as OrderRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* noop */ }
  return [];
}

function loadCustomers(): CustomerRecord[] {
  if (!isClient) return [];
  try {
    const stored = localStorage.getItem(CUSTOMER_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CustomerRecord[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* noop */ }
  return [];
}

export const $orders = atom<OrderRecord[]>(loadOrders());
export const $customers = atom<CustomerRecord[]>(loadCustomers());

if (isClient) {
  $orders.listen((value) => {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(value)); } catch { /* noop */ }
  });
  $customers.listen((value) => {
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify(value)); } catch { /* noop */ }
  });
}

/**
 * Persist a new order AND upsert the customer. Called by CartSidebar
 * after a successful /api/checkout response.
 */
export function saveOrder(order: OrderRecord): void {
  $orders.set([order, ...$orders.get()]);
  // Upsert customer
  const existing = $customers.get().find((c) => c.email === order.customer.email);
  if (existing) {
    $customers.set(
      $customers.get().map((c) =>
        c.email === order.customer.email
          ? {
              ...c,
              name: order.customer.name,
              phone: order.customer.phone,
              dni: order.customer.dni,
              address: order.customer.address,
              department: order.customer.department,
              province: order.customer.province,
              district: order.customer.district,
              lastOrderAt: order.createdAt,
              totalSpent: c.totalSpent + order.total,
              totalOrders: c.totalOrders + 1,
            }
          : c,
      ),
    );
  } else {
    const newCustomer: CustomerRecord = {
      id: order.customerId,
      ...order.customer,
      createdAt: order.createdAt,
      lastOrderAt: order.createdAt,
      totalSpent: order.total,
      totalOrders: 1,
    };
    $customers.set([newCustomer, ...$customers.get()]);
  }
}

/**
 * Get all orders for a given email (for the Mi Cuenta page).
 */
export function getOrdersByEmail(email: string): OrderRecord[] {
  if (!email) return [];
  const normalized = email.trim().toLowerCase();
  return $orders.get().filter((o) => o.customer.email.toLowerCase() === normalized);
}

/**
 * Find an existing customer by email.
 */
export function getCustomerByEmail(email: string): CustomerRecord | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return $customers.get().find((c) => c.email.toLowerCase() === normalized) || null;
}

/**
 * Pre-fill customer info for the checkout form (from a previous order
 * with the same email). This is a quick win before proper auth exists.
 */
export function getCustomerPrefill(email: string): CustomerInfo | null {
  const c = getCustomerByEmail(email);
  if (!c) return null;
  return {
    name: c.name,
    email: c.email,
    phone: c.phone,
    dni: c.dni,
    address: c.address,
    department: c.department,
    province: c.province,
    district: c.district,
  };
}
