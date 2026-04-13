import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import crypto from 'crypto';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';
import { validateCSRFToken, checkRateLimit, getClientIP } from '$lib/server/security';

export async function POST(event) {
   const { email, csrfToken } = await event.request.json();
   if (!email) return json({ error: 'Por favor ingresa tu correo electrónico.' }, { status: 400 });

   // Rate limit por IP (5/hora)
   const clientIP = getClientIP(event);
   const rateLimitIP = checkRateLimit(`verifyemailresend-ip-${clientIP}`, 5, 60);
   if (!rateLimitIP.allowed) {
	   return json({ error: 'Demasiados intentos desde tu IP. Intenta más tarde.' }, { status: 429 });
   }

   // Rate limit por correo (3/hora)
   const rateLimitEmail = checkRateLimit(`verifyemailresend-email-${email}`, 3, 60);
   if (!rateLimitEmail.allowed) {
	   return json({ error: 'Demasiados intentos para este correo. Intenta más tarde.' }, { status: 429 });
   }

   // Rate limit global (100/hora)
   const rateLimitGlobal = checkRateLimit('verifyemailresend-global', 100, 60);
   if (!rateLimitGlobal.allowed) {
	   return json({ error: 'El sistema está recibiendo muchas solicitudes. Intenta más tarde.' }, { status: 429 });
   }
   // CSRF token validation with logging
   const headerToken = event.request.headers.get('x-csrf-token');
   const cookieToken = event.cookies.get('csrf_token');
   const sessionToken = headerToken || cookieToken;
   const valid = validateCSRFToken(headerToken, cookieToken);
   if (!valid) {
	   return json({ error: 'Por seguridad, tu sesión ha expirado. Por favor recarga la página e inténtalo de nuevo.' }, { status: 403 });
   }

   const pool = await getConnection();
   const userResult = await pool.query(
			'SELECT Id, email_verified FROM Usuarios WHERE Correo = $1',
			[email]
		);
   const user = userResult.rows[0];
	if (!user) return json({ error: 'No encontramos una cuenta con ese correo. ¿Escribiste bien tu dirección?' }, { status: 404 });
	if (user.email_verified) return json({ error: 'Ese correo ya fue verificado. Inicia sesión o recupera tu contraseña si la olvidaste.' }, { status: 400 });

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

	   return json({ success: true, message: 'Te enviamos un nuevo correo de verificación. Revisa tu bandeja de entrada y la carpeta de spam.' });
}
