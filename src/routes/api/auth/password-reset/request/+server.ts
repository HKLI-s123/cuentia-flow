import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import crypto from 'crypto';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';
import { checkRateLimit, getClientIP } from '$lib/server/security';

export async function POST(event) {
	const { email } = await event.request.json();
	if (!email) return json({ error: 'Email requerido' }, { status: 400 });

	// Rate limit por IP (5/hora)
	const clientIP = getClientIP(event);
	const rateLimitIP = checkRateLimit(`pwreset-ip-${clientIP}`, 5, 60);
	if (!rateLimitIP.allowed) {
		return json({ error: 'Demasiados intentos desde tu IP. Intenta más tarde.' }, { status: 429 });
	}

	// Rate limit por correo (3/hora)
	const rateLimitEmail = checkRateLimit(`pwreset-email-${email}`, 3, 60);
	if (!rateLimitEmail.allowed) {
		return json({ error: 'Demasiados intentos para este correo. Intenta más tarde.' }, { status: 429 });
	}

	// Rate limit global (100/hora)
	const rateLimitGlobal = checkRateLimit('pwreset-global', 100, 60);
	if (!rateLimitGlobal.allowed) {
		return json({ error: 'El sistema está recibiendo muchas solicitudes. Intenta más tarde.' }, { status: 429 });
	}

	const pool = await getConnection();
	const userResult = await pool.query(
			'SELECT Id, email_verified FROM Usuarios WHERE Correo = $1',
			[email]
		);
	const user = userResult.rows[0];
	if (!user) return json({ error: 'Usuario no encontrado' }, { status: 404 });
	if (!user.email_verified) return json({ error: 'Email no verificado' }, { status: 403 });

	const token = crypto.randomBytes(32).toString('hex');
	const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

	await pool.query(
			`
			UPDATE Usuarios
			SET password_reset_token = $2, password_reset_expires = $3
			WHERE Id = $1
		`,
			[user.id, token, expires]
		);

	const resetUrl = `${process.env.PUBLIC_BASE_URL}/reset-password/${token}`;

	// Enviar email
	await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${RESEND_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: RESEND_FROM,
			to: email,
			subject: 'Recupera tu contraseña',
			html: `<p>Haz clic para recuperar tu contraseña:</p><a href="${resetUrl}">${resetUrl}</a>`
		})
	});

	return json({ success: true });
}
