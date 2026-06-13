import type { APIRoute } from 'astro';
import { createMagicLink } from '@/lib/magicLink';
import { getUserByEmail } from '@/lib/users';
import { sendMagicLinkEmail } from '@/lib/authEmails';

export const prerender = false;

/**
 * POST /api/auth/magic-link
 * Body: { email: string, intent?: 'login' | 'register' }
 *
 * Creates a one-time magic-link token (15 min TTL) and emails it to the
 * user. ALWAYS returns 200 (even if the email doesn't exist) to avoid
 * email-enumeration attacks. The user clicks the link in the email,
 * which lands on /auth/verify?token=...
 *
 * The intent is auto-detected:
 *   - If the email already has a user → 'login'
 *   - Otherwise → 'register'
 * The frontend can optionally pass an explicit intent, but it's not
 * trusted (the backend may override it).
 */
export const POST: APIRoute = async ({ request, url }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const body = await request.json().catch(() => ({}));
    const email = String((body as any).email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email inválido' }),
        { status: 400, headers: cc },
      );
    }

    // Auto-detect intent
    const existing = await getUserByEmail(email);
    const intent = existing ? 'login' : 'register';

    const { token, expiresAt } = await createMagicLink({ email, intent });

    // Build the verification URL
    const origin = url.origin;
    const verifyUrl = `${origin}/auth/verify?token=${encodeURIComponent(token)}`;

    // Fire-and-forget email
    try {
      await sendMagicLinkEmail({ to: email, verifyUrl, intent, expiresAt });
    } catch (e) {
      console.error('[magic-link] email failed:', e);
      // Still return success — the user might retry
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Te enviamos un link mágico a tu email. Revisa tu bandeja.',
        // Don't include the token in the response (security)
      }),
      { status: 200, headers: cc },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error al enviar el link', detail: (err as Error).message }),
      { status: 500, headers: cc },
    );
  }
};
