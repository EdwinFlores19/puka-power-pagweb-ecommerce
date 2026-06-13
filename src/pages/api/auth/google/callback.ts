import type { APIRoute } from 'astro';
import { exchangeCodeForToken, fetchGoogleUserInfo } from '@/lib/google';
import { buildOAuthStateCookie, OAUTH_STATE_COOKIE_NAME, buildClearedOAuthStateCookie, buildUserCookie } from '@/lib/session';
import { getUserByGoogleId, getUserByEmail, createUser, touchLogin } from '@/lib/users';
import { sendWelcomeEmail } from '@/lib/authEmails';

export const prerender = false;

/**
 * GET /api/auth/google/callback?code=...&state=...
 * Handles Google's redirect. Validates the state, exchanges the code
 * for an access token, fetches the user's profile, then creates or
 * updates the user in KV, sets the session cookie, and redirects.
 */
export const GET: APIRoute = async ({ url, request }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const origin = url.origin;
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const cookieHeader = request.headers.get('cookie') || '';

  // 1. Verify state matches the cookie (CSRF protection)
  const parts = cookieHeader.split(';').map((p) => p.trim());
  const stateCookie = parts.find((p) => p.startsWith(`${OAUTH_STATE_COOKIE_NAME}=`));
  if (!stateCookie) {
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=missing_state`, 302);
  }
  const cookieState = stateCookie.slice(OAUTH_STATE_COOKIE_NAME.length + 1);
  if (cookieState !== state) {
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=state_mismatch`, 302);
  }
  if (!code) {
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=missing_code`, 302);
  }

  // 2. Exchange code for token
  let tokenResp;
  try {
    tokenResp = await exchangeCodeForToken(code);
  } catch (e) {
    console.error('[google-callback] token exchange failed:', e);
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=token_exchange_failed`, 302);
  }

  // 3. Fetch user info
  let userInfo;
  try {
    userInfo = await fetchGoogleUserInfo(tokenResp.access_token);
  } catch (e) {
    console.error('[google-callback] userinfo failed:', e);
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=userinfo_failed`, 302);
  }
  if (!userInfo.email) {
    return Response.redirect(`${origin}/auth/verify?ok=0&reason=no_email`, 302);
  }

  // 4. Find or create the user
  // First try by googleId, then by email (for users who registered
  // previously without Google).
  let user = await getUserByGoogleId(userInfo.id);
  if (!user) {
    user = await getUserByEmail(userInfo.email);
  }
  const isNew = !user;
  user = await createUser({
    email: userInfo.email,
    name: userInfo.name || userInfo.given_name,
    avatarUrl: userInfo.picture,
    googleId: userInfo.id,
    emailVerified: !!userInfo.verified_email,
  });
  await touchLogin(user.id);

  // 5. Set the user session cookie
  const userCookie = await buildUserCookie(user.id, user.email);

  // 6. Send welcome email if first time
  if (isNew) {
    try {
      await sendWelcomeEmail({ to: user.email, name: user.name || user.email.split('@')[0] });
    } catch (e) {
      console.error('[google-callback] welcome email failed:', e);
    }
  }

  // 7. Redirect: clear the oauth state cookie, set the user cookie, send to verify page
  return new Response(null, {
    status: 302,
    headers: [
      ['Set-Cookie', userCookie],
      ['Set-Cookie', buildClearedOAuthStateCookie()],
      ['Location', `${origin}/auth/verify?ok=1&email=${encodeURIComponent(user.email)}&via=google`],
    ] as any,
  });
};
