import type { APIRoute } from 'astro';
import { verifyMagicLink } from '@/lib/magicLink';
import { createUser, getUserByEmail, touchLogin } from '@/lib/users';
import { buildUserCookie } from '@/lib/session';
import { sendWelcomeEmail } from '@/lib/authEmails';

export const prerender = false;

/**
 * GET /api/auth/verify?token=...
 * Called by the user clicking the link in the magic-link email.
 *
 * 1. Verifies the token signature + TTL + one-time use
 * 2. If intent === 'register' and user doesn't exist → createUser
 * 3. If intent === 'login' and user doesn't exist → return 401 with
 *    instructions to register first
 * 4. Update lastLoginAt
 * 5. Build a session cookie (HttpOnly, HMAC-signed, 30-day TTL)
 * 6. Redirect to /auth/verify?ok=1 so the page can show a success
 *    state and then send the user to /tienda
 *
 * (We use a redirect rather than returning JSON so the browser
 * automatically follows and sets the cookie.)
 */
export const GET: APIRoute = async ({ url, request, cookies }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const token = url.searchParams.get('token') || '';
  const origin = url.origin;

  if (!token) {
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=missing_token`, 302);
  }

  const result = await verifyMagicLink(token);

  if (!result.valid || !result.email) {
    const reason = result.reason || 'invalid';
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=${reason}`, 302);
  }

  let user = await getUserByEmail(result.email);

  if (!user) {
    if (result.intent === 'register') {
      // Auto-create the user
      user = await createUser({
        email: result.email,
        emailVerified: true,
      });
      try {
        await sendWelcomeEmail({ to: result.email, name: result.email.split('@')[0] });
      } catch (e) {
        console.error('[verify] welcome email failed:', e);
      }
    } else {
      // intent === 'login' but no user → bounce to register
      return Response.redirect(
        `${origin}/auth/verify?ok=0&reason=user_not_found&email=${encodeURIComponent(result.email)}`,
        302,
      );
    }
  } else {
    // Existing user
    if (result.intent === 'register') {
      // They clicked a register link but already have an account → login
      // (idempotent — same outcome as login)
    }
    // Mark verified if they weren't
    if (!user.emailVerified) {
      const updated = await createUser({
        email: result.email,
        emailVerified: true,
        name: user.name,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        googleId: user.googleId,
      });
      user = updated;
    }
    await touchLogin(user.id);
  }

  // Build session cookie
  const cookieValue = await buildUserCookie(user.id, user.email);

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': cookieValue,
      'Location': `${origin}/auth/verify?ok=1&email=${encodeURIComponent(user.email)}`,
    },
  });
};
