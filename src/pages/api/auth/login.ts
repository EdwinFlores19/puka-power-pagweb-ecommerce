import type { APIRoute } from 'astro';
import { getUserByCredentials, touchLogin } from '@/lib/users';
import { buildUserCookie } from '@/lib/session';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
} from '@/lib/passwords';

export const prerender = false;

/** Best-effort client IP extraction (Vercel / Cloudflare / fallback). */
function getClientIp(request: Request): string {
  const h = request.headers;
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    h.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 *
 * Verifies the credentials against the PBKDF2 hash and sets the
 * session cookie on success. Rate-limited to 5 failed attempts per
 * 15-minute window per IP.
 */
export const POST: APIRoute = async ({ request }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const ip = getClientIp(request);

  // Rate limit
  const rl = checkLoginRateLimit(ip);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.retryAfterMs || 0) / 1000);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Demasiados intentos. Intenta en ${Math.ceil(retryAfterSec / 60)} minutos.`,
      }),
      {
        status: 429,
        headers: {
          ...cc,
          'Retry-After': String(retryAfterSec),
        },
      },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String((body as any).email || '').trim().toLowerCase();
    const password = String((body as any).password || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      recordLoginFailure(ip);
      return new Response(
        JSON.stringify({ success: false, error: 'Email o contraseña inválidos' }),
        { status: 400, headers: cc },
      );
    }

    const user = await getUserByCredentials(email, password);
    if (!user) {
      recordLoginFailure(ip);
      return new Response(
        JSON.stringify({ success: false, error: 'Email o contraseña inválidos' }),
        { status: 401, headers: cc },
      );
    }

    // Success — clear the rate-limit bucket and stamp lastLoginAt
    clearLoginFailures(ip);
    await touchLogin(user.id);
    const cookie = await buildUserCookie(user.id, user.email);

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
        },
      }),
      {
        status: 200,
        headers: { ...cc, 'Set-Cookie': cookie },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error al iniciar sesión', detail: (err as Error).message }),
      { status: 500, headers: cc },
    );
  }
};

/** GET is not allowed. */
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
};
