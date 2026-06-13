/**
 * Auth-related emails (magic link sign-in, welcome, etc.).
 * Uses Resend if RESEND_API_KEY is set, otherwise console.logs the link
 * (useful for dev).
 */

interface MagicLinkParams {
  to: string;
  verifyUrl: string;
  intent: 'login' | 'register';
  expiresAt: string;
}

const BRAND = {
  wine: '#7B1113',
  wineDark: '#4A0507',
  cream: '#FFF9F0',
  gold: '#FFD700',
};

function magicLinkHtml({ verifyUrl, intent, expiresAt }: MagicLinkParams): string {
  const minutes = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  const headline = intent === 'register' ? '¡Bienvenido a Puka Power!' : '¡Hola de vuelta!';
  const subline = intent === 'register'
    ? 'Mio el gato guardián te ha enviado un link mágico. Sin contraseñas, sin complicaciones.'
    : 'Toca el botón para entrar al santuario del rayo. Tu próxima recarga te espera.';
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${headline}</title></head>
<body style="margin:0;font-family:Montserrat,Arial,sans-serif;background:#f5ede1;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:${BRAND.cream};border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${BRAND.wine} 0%,${BRAND.wineDark} 100%);padding:32px 28px;text-align:center;color:${BRAND.cream};">
      <div style="font-size:48px;line-height:1;margin-bottom:8px;">🐱</div>
      <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:0.5px;">${headline}</h1>
    </div>
    <div style="padding:28px 32px 8px;">
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#333;">${subline}</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%);color:#1a1a1a;font-weight:900;font-size:15px;padding:16px 36px;border-radius:12px;text-decoration:none;letter-spacing:1px;text-transform:uppercase;box-shadow:0 6px 16px rgba(255,215,0,0.4);">
          ⚡ ENTRAR AL SANTUARIO DEL RAYO
        </a>
      </div>
      <p style="margin:8px 0;font-size:11px;color:#888;text-align:center;">Este link caduca en ${minutes} minutos. Si no funciona, cópialo y pégalo en tu navegador:</p>
      <p style="word-break:break-all;background:#f5ede1;padding:10px;border-radius:8px;font-size:10px;color:#666;font-family:monospace;">${verifyUrl}</p>
    </div>
    <div style="padding:18px 32px 28px;border-top:1px solid #e5d8c0;margin-top:12px;">
      <p style="margin:0;font-size:11px;color:#888;line-height:1.5;">Si no solicitaste este link, ignora este mensaje. Nadie más tiene acceso a tu cuenta.</p>
    </div>
    <div style="background:${BRAND.wine};color:${BRAND.cream};padding:14px;text-align:center;font-size:11px;letter-spacing:1px;">
      PUKA POWER · ENERGÍA ANCESTRAL PERUANA
    </div>
  </div>
</body></html>`.trim();
}

export async function sendMagicLinkEmail(params: MagicLinkParams): Promise<void> {
  const { to, verifyUrl, intent, expiresAt } = params;
  const subject = intent === 'register'
    ? '🐱 ¡Bienvenido a Puka Power! Activa tu cuenta'
    : '🐱 Tu link de acceso a Puka Power';
  const html = magicLinkHtml({ to, verifyUrl, intent, expiresAt });

  const env = (import.meta as any).env || process.env;
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_RECEPTOR || 'no-reply@pukapower.pe';

  if (!apiKey) {
    console.log('[auth-email/skip] RESEND_API_KEY not set.');
    console.log(`[auth-email/skip] Would send to=${to} subject=${subject}`);
    console.log(`[auth-email/skip] Verify URL: ${verifyUrl}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }
}

interface WelcomeEmailParams {
  to: string;
  name: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const { to, name } = params;
  const subject = '🎉 ¡Bienvenido a Puka Power!';
  const html = `<!doctype html><html><body style="font-family:Montserrat,Arial,sans-serif;background:#f5ede1;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#FFF9F0;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#7B1113 0%,#4A0507 100%);padding:32px;text-align:center;color:#FFF9F0;">
        <div style="font-size:48px;line-height:1;">🐱</div>
        <h1 style="margin:8px 0 0;font-size:24px;">¡Bienvenido, ${name}!</h1>
      </div>
      <div style="padding:28px 32px;">
        <p>Tu cuenta en Puka Power está activa. Ya puedes ver tu historial de pedidos, obtener descuentos exclusivos y ser el primero en probar nuevos productos.</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${process.env.PUBLIC_SITE_URL || 'https://pukapower.pe'}/mi-cuenta" style="display:inline-block;background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%);color:#1a1a1a;font-weight:900;padding:14px 32px;border-radius:12px;text-decoration:none;text-transform:uppercase;">Ver mi cuenta</a>
        </p>
        <p>Si tienes alguna duda, responde este email. Mio, el gato guardián, está pendiente 🐱</p>
      </div>
    </div>
  </body></html>`.trim();
  const env = (import.meta as any).env || process.env;
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_RECEPTOR || 'no-reply@pukapower.pe';
  if (!apiKey) { console.log('[welcome-email/skip]', to); return; }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  });
}
