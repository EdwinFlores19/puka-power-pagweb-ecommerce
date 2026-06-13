import { defineMiddleware } from 'astro:middleware';
import { getCurrentUserFromCookies } from './lib/auth';

/**
 * Astro middleware — runs on every request before the page renders.
 * We attach the authenticated user (or null) to context.locals so that
 * .astro pages can read it server-side (no flash of unauthenticated UI).
 *
 * Protected routes are checked here as well:
 *   - /mi-cuenta             → requires sign-in (redirects to /auth/login)
 *   - /admin/pedidos         → requires ADMIN_KEY or Basic Auth (TODO)
 */
export const onRequest = defineMiddleware(async (context, next) => {
  // Attach user
  const user = await getCurrentUserFromCookies(context.request.headers.get('cookie'));
  context.locals.user = user;

  // Protect /mi-cuenta
  const path = context.url.pathname;
  if (path === '/mi-cuenta' && !user) {
    const next = encodeURIComponent(path);
    return Response.redirect(
      `${context.url.origin}/auth/login?next=${next}`,
      302,
    );
  }

  return next();
});
