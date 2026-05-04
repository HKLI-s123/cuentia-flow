import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import bcrypt from 'bcryptjs';
import {
	getClientIP,
	secureLog,
	secureErrorResponse,
	validateRecaptcha,
	checkRateLimit,
	validateEmail,
	validateName,
	validatePassword,
	validatePhoneNumber
} from '$lib/server/security';
import { env as privateEnv } from '$env/dynamic/private';
import { RESEND_FROM, RESEND_API_KEY } from '$lib/server/email-config';
import crypto from 'crypto';

const ALLOW_USER_REGISTRATION = process.env.ALLOW_USER_REGISTRATION === 'true';
const RECAPTCHA_ENABLED =
	(process.env.RECAPTCHA_ENABLED ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')).toLowerCase() === 'true';

export const POST: RequestHandler = async (event) => {
	try {
		const clientIP = getClientIP(event);

		if (!ALLOW_USER_REGISTRATION) {
			secureLog('warn', 'Registration attempt when disabled', { ip: clientIP });
			return secureErrorResponse(
				403,
				'El registro de usuarios está deshabilitado. Contacta al administrador.'
			);
		}

		const requestData = await event.request.json();
		const { correo, contrasena, nombre, apellido, numero_tel, recaptchaToken } = requestData;

		// Validar reCAPTCHA solo si está habilitado por entorno
		if (RECAPTCHA_ENABLED) {
			const recaptchaSecret = privateEnv.RECAPTCHA_SECRET_KEY || '';
			if (!recaptchaSecret) {
				secureLog('error', 'RECAPTCHA_SECRET_KEY is missing while captcha is enabled');
				return secureErrorResponse(500, 'Configuración de seguridad incompleta');
			}

			if (!recaptchaToken) {
				secureLog('warn', 'Registration attempt without reCAPTCHA token', { ip: clientIP });
				return secureErrorResponse(400, 'reCAPTCHA token requerido');
			}

			const recaptchaResult = await validateRecaptcha(recaptchaToken, recaptchaSecret);
			if (!recaptchaResult.valid) {
				secureLog('warn', 'Registration attempt with failed reCAPTCHA', {
					ip: clientIP,
					recaptchaScore: recaptchaResult.score
				});
				return secureErrorResponse(403, 'Verificación de seguridad fallida. Por favor intenta nuevamente.');
			}
		}

		// Rate limiting por IP
		const rateLimitIP = checkRateLimit(`register-ip-${clientIP}`, 5, 60);
		if (!rateLimitIP.allowed) {
			secureLog('warn', 'Registration rate limit exceeded (IP)', { ip: clientIP });
			return json(
				{ error: 'Demasiados intentos de registro desde tu IP. Intenta más tarde.' },
				{ status: 429 }
			);
		}

		// Rate limiting por email
		const rateLimitEmail = checkRateLimit(`register-email-${correo}`, 3, 60);
		if (!rateLimitEmail.allowed) {
			secureLog('warn', 'Registration rate limit exceeded (email)', { correo });
			return json(
				{ error: 'Demasiados intentos de registro para este correo. Intenta más tarde.' },
				{ status: 429 }
			);
		}

		// Rate limiting global
		const rateLimitGlobal = checkRateLimit('register-global', 100, 60);
		if (!rateLimitGlobal.allowed) {
			secureLog('warn', 'Registration global rate limit exceeded');
			return json(
				{ error: 'El sistema está recibiendo muchas solicitudes de registro. Intenta más tarde.' },
				{ status: 429 }
			);
		}

		// Validaciones
		const emailValidation = validateEmail(correo);
		if (!emailValidation.valid) {
			return secureErrorResponse(400, emailValidation.error || 'Email inválido');
		}

		const nameValidation = validateName(nombre);
		if (!nameValidation.valid) {
			return secureErrorResponse(400, nameValidation.error || 'Nombre inválido');
		}

		const lastNameValidation = validateName(apellido);
		if (!lastNameValidation.valid) {
			return secureErrorResponse(400, lastNameValidation.error || 'Apellido inválido');
		}

		const passwordValidation = validatePassword(contrasena);
		if (!passwordValidation.valid) {
			secureLog('info', 'Registration attempt with weak password', {
				ip: clientIP,
				email: emailValidation.value
			});
			return secureErrorResponse(400, passwordValidation.error || 'Contraseña débil');
		}

		let sanitizedPhone = null;
		if (numero_tel) {
			const phoneValidation = validatePhoneNumber(numero_tel);
			if (!phoneValidation.valid) {
				return secureErrorResponse(400, phoneValidation.error || 'Teléfono inválido');
			}
			sanitizedPhone = phoneValidation.value;
		}

		const pool = await getConnection();

		// Verificar si el email ya está registrado
		const existingUser = await pool.query(
			`SELECT id FROM usuarios WHERE correo = $1 LIMIT 1`,
			[emailValidation.value]
		);

		if (existingUser.rows.length > 0) {
			secureLog('info', 'Registration attempt with existing email', {
				ip: clientIP,
				email: emailValidation.value
			});
			return secureErrorResponse(400, 'El email ya está registrado en el sistema');
		}

		// Hash de la contraseña
		let hashedPassword;
		try {
			hashedPassword = await bcrypt.hash(passwordValidation.value!, 12);
		} catch (hashError) {
			secureLog('error', 'Password hashing failed', { ip: clientIP });
			return secureErrorResponse(500, 'Error al procesar la contraseña');
		}

		// Generar token de verificación de email
		const verificationToken = crypto.randomBytes(32).toString('hex');
		const verificationExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

		try {
			const result = await pool.query(
				`INSERT INTO usuarios (correo, contrasena, numerotel, activo, nombre, apellido, verification_token, verification_expires)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				 RETURNING id`,
				[emailValidation.value, hashedPassword, sanitizedPhone, false, nameValidation.value, lastNameValidation.value, verificationToken, verificationExpires]
			);

			const usuarioId = result.rows[0].id;

			// Enviar email de verificación
			const baseUrl = process.env.PUBLIC_BASE_URL;
			if (!baseUrl) {
				console.warn('[REGISTER] PUBLIC_BASE_URL no está definido en .env');
				throw new Error('PUBLIC_BASE_URL no está definido');
			}

			const verifyUrl = `${baseUrl}/verify-email/${verificationToken}`;

			const emailResponse = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${RESEND_API_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from: RESEND_FROM,
					to: emailValidation.value,
					subject: 'Verifica tu correo',
					html: `<p>Haz clic para verificar tu cuenta:</p><a href="${verifyUrl}">${verifyUrl}</a>`
				})
			});

			const emailResult = await emailResponse.json().catch(() => ({}));

			secureLog('info', 'User registration successful - pending email verification', {
				userId: usuarioId,
				email: emailValidation.value,
				ip: clientIP
			});

			return json(
				{
					message: 'Usuario registrado correctamente. Verifica tu email para activar la cuenta.',
					usuarioId,
					pendingVerification: true
				},
				{ status: 201 }
			);
		} catch (dbError) {
			secureLog('error', 'Database error during registration', {
				error: dbError instanceof Error ? dbError.message : 'Unknown error',
				ip: clientIP
			});
			return secureErrorResponse(500, 'Error al registrar el usuario');
		}
	} catch (err) {
		secureLog('error', 'Registration endpoint error', {
			error: err instanceof Error ? err.message : 'Unknown error'
		});
		return secureErrorResponse(500, 'Error en el servidor');
	}
};
