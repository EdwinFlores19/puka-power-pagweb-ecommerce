/**
 * Auth helpers — high-level wrappers around users/session/magicLink/google.
 * Used by the auth API endpoints and the Astro middleware.
 */

import type { User } from './types';
import {
  getUserById,
  getUserByEmail,
  getUserByGoogleId,
  createUser,
  updateUser,
  touchLogin,
} from './users';
import {
  verifyUserCookie,
  buildUserCookie,
  buildClearedUserCookie,
  verifyOAuthStateCookie,
} from './session';
import { verifyMagicLink, createMagicLink } from './magicLink';

export {
  getUserById,
  getUserByEmail,
  getUserByGoogleId,
  createUser,
  updateUser,
  touchLogin,
  verifyUserCookie,
  buildUserCookie,
  buildClearedUserCookie,
  verifyOAuthStateCookie,
  verifyMagicLink,
  createMagicLink,
};

/**
 * Resolve a User from a Cookie header (used by middleware).
 * Returns null if not signed in.
 */
export async function getCurrentUserFromCookies(cookieHeader: string | null): Promise<User | null> {
  const session = await verifyUserCookie(cookieHeader);
  if (!session) return null;
  return getUserById(session.userId);
}
