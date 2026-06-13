import type { User, OrderRecord } from './types';
import { kvGet, kvSet, kvKeys, kvListByPrefix } from './kv';

// All user records are stored under the `user:` prefix in KV.
const USER_PREFIX = 'user:';
const USER_BY_EMAIL = (email: string) => `user-email:${email.toLowerCase()}`;
// User's orders index: `user-orders:{userId}` -> array of orderIds
const USER_ORDERS = (userId: string) => `user-orders:${userId}`;

/**
 * Generate a URL-safe ULID-like ID. Not cryptographically strong but
 * unique enough for our purposes (timestamp + random).
 */
function newId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${ts}${rnd}`;
}

export async function getUserById(id: string): Promise<User | null> {
  return kvGet<User>(USER_PREFIX + id);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  // Look up the userId by email
  const id = await kvGet<string>(USER_BY_EMAIL(normalized));
  if (!id) return null;
  return getUserById(id);
}

export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  if (!googleId) return null;
  const allIds = await kvKeys(USER_PREFIX + '*');
  for (const key of allIds) {
    const u = await kvGet<User>(key);
    if (u && u.googleId === googleId) return u;
  }
  return null;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  googleId?: string;
  emailVerified?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const normalized = input.email.trim().toLowerCase();
  // Check for existing
  const existing = await getUserByEmail(normalized);
  if (existing) {
    // Merge: update missing fields
    const merged: User = {
      ...existing,
      name: input.name ?? existing.name,
      phone: input.phone ?? existing.phone,
      avatarUrl: input.avatarUrl ?? existing.avatarUrl,
      googleId: input.googleId ?? existing.googleId,
      emailVerified: existing.emailVerified || !!input.emailVerified,
      lastLoginAt: new Date().toISOString(),
    };
    await kvSet(USER_PREFIX + existing.id, merged);
    return merged;
  }
  const user: User = {
    id: newId(),
    email: normalized,
    name: input.name,
    phone: input.phone,
    avatarUrl: input.avatarUrl,
    googleId: input.googleId,
    emailVerified: !!input.emailVerified,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    totalOrders: 0,
    totalSpent: 0,
  };
  await kvSet(USER_PREFIX + user.id, user);
  // Index by email
  await kvSet(USER_BY_EMAIL(normalized), user.id);
  return user;
}

export async function updateUser(id: string, patch: Partial<User>): Promise<User | null> {
  const u = await getUserById(id);
  if (!u) return null;
  const updated = { ...u, ...patch, lastLoginAt: new Date().toISOString() };
  await kvSet(USER_PREFIX + id, updated);
  return updated;
}

export async function touchLogin(id: string): Promise<void> {
  const u = await getUserById(id);
  if (!u) return;
  await kvSet(USER_PREFIX + id, { ...u, lastLoginAt: new Date().toISOString() });
}

/** Update order totals for a user (called after a successful checkout). */
export async function recordUserOrder(userId: string, order: OrderRecord): Promise<void> {
  const u = await getUserById(userId);
  if (!u) return;
  const updated: User = {
    ...u,
    totalOrders: u.totalOrders + 1,
    totalSpent: u.totalSpent + order.total,
    lastOrderAt: order.createdAt,
    name: order.customer.name || u.name,
    phone: order.customer.phone || u.phone,
  };
  await kvSet(USER_PREFIX + userId, updated);
  // Append to user-orders index
  const list = (await kvGet<string[]>(USER_ORDERS(userId))) || [];
  await kvSet(USER_ORDERS(userId), [order.orderId, ...list]);
}

/** Get a user's order history (returns full OrderRecord objects). */
export async function getUserOrders(userId: string): Promise<OrderRecord[]> {
  const ids = (await kvGet<string[]>(USER_ORDERS(userId))) || [];
  if (ids.length === 0) return [];
  const orders = await Promise.all(ids.map((oid) => kvGet<OrderRecord>('order:' + oid)));
  return orders.filter((o): o is OrderRecord => o !== null);
}

/** Migrate localStorage orders into a user's account. */
export async function migrateLocalOrdersToUser(
  userId: string,
  localOrders: { orderId: string; total: number; createdAt: string; customer: any; items: any[]; subtotal: number; discount: number; couponApplied: string }[],
): Promise<number> {
  let count = 0;
  for (const lo of localOrders) {
    const order: OrderRecord = {
      orderId: lo.orderId,
      customerId: userId,
      customer: lo.customer,
      items: lo.items,
      subtotal: lo.subtotal,
      discount: lo.discount,
      total: lo.total,
      couponApplied: lo.couponApplied,
      status: 'pending',
      createdAt: lo.createdAt,
    };
    // Persist the order server-side under `order:{orderId}` so we can
    // look it up later.
    await kvSet('order:' + lo.orderId, order);
    await recordUserOrder(userId, order);
    count++;
  }
  return count;
}
