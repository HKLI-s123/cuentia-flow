import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import crypto from 'crypto';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';
import { validateCSRFToken } from '$lib/server/security';

export async function POST(event) {
   const { email, csrfToken } = await event.request.json();
   if (!email) return json({ error: 'Email requerido' }, { status: 400 });
   // CSRF token validation with logging
   const headerToken = event.request.headers.get('x-csrf-token');
   const cookieHeader = event.request.headers.get('cookie');
   let cookieToken = '';
   if (cookieHeader) {
	   cookieToken = cookieHeader.split(';').find(c => c.trim().startsWith('csrfToken='))?.split('=')[1] || '';
   }
   const sessionToken = headerToken || cookieToken;
   const valid = validateCSRFToken(csrfToken, sessionToken);
   if (!valid) {
		return json({ error: 'CSRF token inválido o expirado' }, { status: 403 });
   }

   const pool = await getConnection();
   const userResult = await pool.query(
			'SELECT Id, email_verified FROM Usuarios WHERE Correo = $1',
			[email]
		);
   const user = userResult.rows[0];
   if (!user) return json({ error: 'Usuario no encontrado' }, { status: 404 });
	if (user.email_verified) return json({ error: 'El correo ya está verificado.' }, { status: 400 });

	const token = crypto.randomBytes(32).toString('hex');
	const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

	await pool.query(
			`
			UPDATE Usuarios
			SET verification_token = $2, verification_expires = $3
			WHERE Id = $1
		`,
			[user.id, token, expires]
		);

	const verifyUrl = `${process.env.PUBLIC_BASE_URL}/verify-email/${token}`;

	await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${RESEND_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: RESEND_FROM,
			to: email,
			subject: 'Verifica tu correo',
			html: `<p>Haz clic para verificar tu cuenta:</p><a href="${verifyUrl}">${verifyUrl}</a>`
		})
	});

	return json({ success: true });
}
