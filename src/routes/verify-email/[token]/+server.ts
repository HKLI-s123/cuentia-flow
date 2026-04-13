import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';

export const GET: RequestHandler = async ({ params }) => {
	const token = params.token;
	if (!token) {
		return json({ error: 'Token de verificación faltante.' }, { status: 400 });
	}

	const pool = await getConnection();
	const result = await pool.query(
		`SELECT id, nombre, correo, email_verified, verification_expires
		 FROM usuarios
		 WHERE verification_token = $1`,
		[token]
	);

	if (result.rows.length === 0) {
		return json({ error: 'Token inválido o usuario no encontrado.' }, { status: 404 });
	}

	const user = result.rows[0];
	if (user.email_verified) {
		return json({ message: 'La cuenta ya está verificada.' });
	}

	const now = new Date();
	const expires = new Date(user.verification_expires);
	if (now > expires) {
		return json({ error: 'El enlace de verificación ha expirado.' }, { status: 410 });
	}

	await pool.query(
		`UPDATE usuarios
		 SET email_verified = true, verification_token = NULL, verification_expires = NULL, activo = true
		 WHERE id = $1`,
		[user.id]
	);

	// Enviar correo de bienvenida
	if (RESEND_API_KEY) {
		const nombre = user.nombre || 'Usuario';
		const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
		const ctaUrl = `${baseUrl}/dashboard/clientes`;

		try {
			await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${RESEND_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: RESEND_FROM || 'no-reply@cuentia.mx',
					to: user.correo,
					subject: `¡Bienvenido a CuentIA Flow, ${nombre}!`,
					html: `
						<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #1f2937;">
							<div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
								<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">CuentIA Flow</h1>
							</div>
							<div style="background: #ffffff; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none;">
								<p style="font-size: 18px; font-weight: 600; margin-top: 0;">Hola ${nombre},</p>
								<p style="font-size: 15px; line-height: 1.7; color: #374151;">Tu cuenta está lista.</p>
								<p style="font-size: 15px; line-height: 1.7; color: #374151;">
									CuentIA Flow te permite facturar, registrar clientes y llevar el control de lo que te deben, todo desde un solo lugar.
								</p>
								<p style="font-size: 15px; line-height: 1.7; color: #374151; font-weight: 600;">
									Para empezar, haz solo esto:
								</p>
								<div style="text-align: center; margin: 28px 0;">
									<a href="${ctaUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
										→ Agregar mi primer cliente
									</a>
								</div>
								<p style="font-size: 15px; line-height: 1.7; color: #374151;">
									Son 2 minutos. Una vez que lo registres, ya puedes emitir su factura y, si quieres que el sistema cobre por ti automáticamente, simplemente activa el cobrador IA dentro de esa misma factura.
								</p>
								<p style="font-size: 15px; line-height: 1.7; color: #374151;">
									No es obligatorio — pero cuando lo pruebes, no vas a querer cobrar de otra forma.
								</p>
								<p style="font-size: 15px; line-height: 1.7; color: #374151;">
									Si tienes alguna duda en el camino, responde este correo y te ayudamos.
								</p>
								<p style="font-size: 15px; line-height: 1.7; color: #374151; margin-bottom: 4px;">
									<strong>El equipo de CuentIA Flow</strong>
								</p>
								<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
								<p style="font-size: 13px; line-height: 1.6; color: #6b7280; margin-bottom: 0;">
									<strong>P.D.</strong> — El cobrador IA funciona por factura. Cada vez que crees una, decides si quieres que el agente de WhatsApp se encargue de cobrarla por ti.
								</p>
							</div>
							<div style="background: #f9fafb; padding: 16px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; text-align: center;">
								<p style="font-size: 12px; color: #9ca3af; margin: 0;">© ${new Date().getFullYear()} CuentIA Flow — Cobranza inteligente con IA</p>
							</div>
						</div>
					`
				})
			});
		} catch (emailErr) {
			console.error('[VERIFY-EMAIL] Error al enviar correo de bienvenida:', emailErr);
		}
	}

	// Redirigir a página de éxito
	return redirect(302, '/verify-email/success');
};
