import type { APIRoute } from 'astro';
import { createUser, getUserByEmail } from '@/lib/users';
import { buildUserCookie } from '@/lib/session';

export const prerender = false;

/**
 * POST /api/auth/register
 * Body: {
 *   email: string,
 *   password: string,
 *   name: string,
 *   surname: string,
 *   address: string,
 *   department: string,
 *   province: string,
 *   district: string,
 *   phone?: string
 * }
 *
 * Creates a new user with PBKDF2-hashed password, sets the session
 * cookie, and returns the basic user info.
 */
export const POST: APIRoute = async ({ request, url }) => {
  const cc = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  try {
    const body = await request.json().catch(() => ({}));
    const email = String((body as any).email || '').trim().toLowerCase();
    const password = String((body as any).password || '');
    const name = String((body as any).name || '').trim();
    const surname = String((body as any).surname || '').trim();
    const address = String((body as any).address || '').trim();
    const department = String((body as any).department || '').trim();
    const province = String((body as any).province || '').trim();
    const district = String((body as any).district || '').trim();
    const phone = String((body as any).phone || '').trim();

    // Validate
    const errors: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email inválido';
    if (password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres';
    if (name.length < 2) errors.name = 'Ingresa tu nombre';
    if (surname.length < 2) errors.surname = 'Ingresa tus apellidos';
    if (address.length < 5) errors.address = 'Ingresa tu dirección completa';
    if (!department) errors.department = 'Selecciona un departamento';
    if (!province) errors.province = 'Selecciona una provincia';
    if (!district) errors.district = 'Selecciona un distrito';
    if (Object.keys(errors).length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Datos incompletos', fields: errors }),
        { status: 400, headers: cc },
      );
    }

    // Reject duplicate emails
    const existing = await getUserByEmail(email);
    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ya existe una cuenta con este email',
          fields: { email: 'Este email ya está registrado' },
        }),
        { status: 409, headers: cc },
      );
    }

    const user = await createUser({
      email,
      password,
      name,
      surname,
      address,
      department,
      province,
      district,
      phone: phone || undefined,
      emailVerified: true, // email + password registration is self-attested; admin can review if needed
    });

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
        headers: {
          ...cc,
          'Set-Cookie': cookie,
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Error al registrar la cuenta', detail: (err as Error).message }),
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
