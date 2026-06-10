import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { Resend } from 'resend';

const DEPARTMENT_MAP: Record<string, string> = {
  lima: 'Lima & Callao',
  arequipa: 'Arequipa',
  cusco: 'Cusco',
  trujillo: 'La Libertad',
  provincia: 'Otros Departamentos',
};

const PACK_MAP: Record<string, string> = {
  reto3dias: 'Pack Reto (3 latas)',
  packpro: 'Pack Pro (12 latas)',
};

export const server = {
  sendLead: defineAction({
    accept: 'json',
    input: z.object({
      nombre: z
        .string()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .transform((s) => s.trim()),
      email: z
        .string()
        .email('Correo electrónico inválido')
        .transform((s) => s.toLowerCase().trim()),
      telefono: z
        .string()
        .regex(/^9[0-9]{8}$/, 'El teléfono debe ser un número móvil peruano válido (9 dígitos)'),
      departamento: z.enum(['lima', 'arequipa', 'cusco', 'trujillo', 'provincia']),
      pack: z.enum(['reto3dias', 'packpro']),
    }),
    handler: async (input) => {
      const resendApiKey = import.meta.env.RESEND_API_KEY;
      const emailReceptor = import.meta.env.EMAIL_RECEPTOR;

      if (!resendApiKey || !emailReceptor) {
        throw new Error('Error de configuración del servidor de correo');
      }

      const resend = new Resend(resendApiKey);

      const departamentoLabel = DEPARTMENT_MAP[input.departamento] ?? input.departamento;
      const packLabel = PACK_MAP[input.pack] ?? input.pack;
      const fecha = new Date().toLocaleString('es-PE', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const { error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: emailReceptor,
        subject: `⚡ Nuevo Lead Puka Power - ${input.nombre}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="margin:0;padding:0;background-color:#FFF9F2;font-family:Montserrat,Arial,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF9F2;padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FDFBF7;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="background:linear-gradient(135deg,#7B1113 0%,#4A0507 100%);padding:32px 40px;text-align:center;">
                        <h1 style="font-family:'Playfair Display',Georgia,serif;color:#FDFBF7;font-size:28px;margin:0;letter-spacing:2px;">⚡ PUKA POWER</h1>
                        <p style="color:#B8860B;font-size:14px;margin:8px 0 0;text-transform:uppercase;letter-spacing:4px;font-weight:bold;">Nuevo Lead Registrado</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:32px 40px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:12px 0;border-bottom:1px solid #e8e0d6;">
                              <span style="font-size:12px;color:#7B1113;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Nombre</span>
                              <p style="font-size:16px;color:#2C1A14;margin:4px 0 0;font-weight:600;">${input.nombre}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:12px 0;border-bottom:1px solid #e8e0d6;">
                              <span style="font-size:12px;color:#7B1113;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Correo Electrónico</span>
                              <p style="font-size:16px;color:#2C1A14;margin:4px 0 0;">${input.email}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:12px 0;border-bottom:1px solid #e8e0d6;">
                              <span style="font-size:12px;color:#7B1113;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">WhatsApp / Celular</span>
                              <p style="font-size:16px;color:#2C1A14;margin:4px 0 0;">${input.telefono}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:12px 0;border-bottom:1px solid #e8e0d6;">
                              <span style="font-size:12px;color:#7B1113;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Departamento de Envío</span>
                              <p style="font-size:16px;color:#2C1A14;margin:4px 0 0;">${departamentoLabel}</p>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:12px 0;">
                              <span style="font-size:12px;color:#7B1113;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Pack Seleccionado</span>
                              <p style="font-size:16px;color:#D9534F;margin:4px 0 0;font-weight:bold;">${packLabel}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color:#FFF9F2;padding:20px 40px;text-align:center;border-top:1px solid #e8e0d6;">
                        <p style="font-size:12px;color:#718096;margin:0;">Registrado el ${fecha} · Puka Power Web</p>
                        <p style="font-size:11px;color:#718096;margin:8px 0 0;">Este correo fue generado automáticamente desde el formulario de leads de Puka Power.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });

      if (error) {
        throw new Error(`Error al enviar email: ${error.message}`);
      }

      return {
        success: true,
        message: `¡Gracias, ${input.nombre}! Hemos registrado tu pedido. Un asesor te contactará pronto vía WhatsApp.`,
      };
    },
  }),
};
