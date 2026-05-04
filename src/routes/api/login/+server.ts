import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import bcrypt from 'bcryptjs';
import { generateTokenPair } from '$lib/server/tokens';
import {
	getClientIP,
	secureLog,
	secureErrorResponse,
	validateEmail,
	validateRecaptcha,
	checkRateLimit,
	clearRateLimit
} from '$lib/server/security';
import { env as privateEnv } from '$env/dynamic/private';

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
const LOGIN_LOCKOUT_MINUTES = parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15');
const RECAPTCHA_ENABLED =
	(process.env.RECAPTCHA_ENABLED ?? 'false').toLowerCase() === 'true';

export const POST: RequestHandler = async (event) => {
	try {
		const { correo, contrasena, recaptchaToken } = await event.request.json();
		const clientIP = getClientIP(event);

		if (!correo || !contrasena) {
			secureLog('warn', 'Login attempt with missing fields', { ip: clientIP });
			return secureErrorResponse(400, 'Correo y contraseña son requeridos');
		}

		const emailValidation = validateEmail(correo);
		if (!emailValidation.valid) {
			secureLog('warn', 'Login attempt with invalid email', { ip: clientIP });
			return secureErrorResponse(400, emailValidation.error || 'Email inválido');
		}

		// Validar reCAPTCHA solo si está habilitado por entorno
		if (RECAPTCHA_ENABLED) {
			const recaptchaSecret = privateEnv.RECAPTCHA_SECRET_KEY || '';
			if (!recaptchaSecret) {
				secureLog('warn', 'RECAPTCHA_ENABLED=true pero falta RECAPTCHA_SECRET_KEY. Se omite validación de captcha temporalmente.');
			} else {

				if (!recaptchaToken) {
					secureLog('warn', 'Login attempt without reCAPTCHA token', { ip: clientIP, email: emailValidation.value });
					return secureErrorResponse(400, 'reCAPTCHA token requerido');
				}

				const recaptchaResult = await validateRecaptcha(recaptchaToken, recaptchaSecret);
				if (!recaptchaResult.valid) {
					secureLog('warn', 'Login attempt with failed reCAPTCHA', {
						ip: clientIP,
						email: emailValidation.value,
						recaptchaScore: recaptchaResult.score
					});
					return secureErrorResponse(403, 'Verificación de seguridad fallida. Por favor intenta nuevamente.');
				}
			}
		}

		// Rate limiting
		const rateLimit = checkRateLimit(clientIP, MAX_LOGIN_ATTEMPTS, LOGIN_LOCKOUT_MINUTES);
		if (!rateLimit.allowed) {
			secureLog('error', 'Login rate limit exceeded', {
				ip: clientIP,
				email: emailValidation.value,
				blockedUntil: rateLimit.blockedUntil
			});
			return json(
				{
					error: `Demasiados intentos fallidos. Intenta nuevamente en ${LOGIN_LOCKOUT_MINUTES} minutos.`,
					blockedUntil: rateLimit.blockedUntil
				},
				{ status: 429 }
			);
		}

		const pool = await getConnection();

		// Buscar usuario con su organización
		const result = await pool.query(
			`SELECT 
				u.id, 
				u.correo, 
				u.contrasena, 
				u.nombre, 
				u.apellido, 
				u.activo,
				uo.organizacionid,
				uo.rolid
			FROM usuarios u
			LEFT JOIN usuario_organizacion uo ON u.id = uo.usuarioid
			WHERE u.correo = $1`,
			[emailValidation.value]
		);

		if (result.rows.length === 0) {
			secureLog('warn', 'Login attempt for non-existent user', {
				ip: clientIP,
				email: emailValidation.value
			});
			return secureErrorResponse(401, 'Credenciales inválidas');
		}

		const user = result.rows[0];

		// Validar contraseña
		const validPassword = await bcrypt.compare(contrasena, user.contrasena);
		if (!validPassword) {
			secureLog('warn', 'Failed login attempt - invalid password', {
				ip: clientIP,
				userId: user.id,
				email: emailValidation.value
			});
			return secureErrorResponse(401, 'Credenciales inválidas');
		}

		// Verificar cuenta activa
		if (user.activo !== true) {
			secureLog('warn', 'Login attempt with unverified email', {
				ip: clientIP,
				userId: user.id,
				email: emailValidation.value
			});
			return secureErrorResponse(403, 'Correo no verificado, revisa tu bandeja de entrada');
		}

		// Generar tokens
		let tokenPair;
		try {
			tokenPair = generateTokenPair({
				id: user.id,
				correo: user.correo,
				nombre: user.nombre,
				apellido: user.apellido,
				organizacion: user.organizacionid,
				rolId: user.rolid
			});
		} catch (tokenError) {
			secureLog('error', 'Token generation failed', { userId: user.id });
			return secureErrorResponse(500, 'Error al generar tokens de autenticación');
		}

		// Limpiar rate limit después de login exitoso
		clearRateLimit(clientIP);

		// Establecer cookies HttpOnly
		event.cookies.set('accessToken', tokenPair.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 15, // 15 minutos
			path: '/'
		});

		event.cookies.set('refreshToken', tokenPair.refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7, // 7 días
			path: '/'
		});

		secureLog('info', 'Successful login', {
			userId: user.id,
			email: emailValidation.value,
			ip: clientIP
		});

		return json(
			{
				message: 'Login exitoso',
				usuario: {
					id: user.id,
					correo: user.correo,
					nombre: user.nombre,
					apellido: user.apellido,
					organizacionId: user.organizacionid,
					rolId: user.rolid
				}
			},
			{ status: 200 }
		);
	} catch (error) {
		secureLog('error', 'Login endpoint error', {
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		return secureErrorResponse(500, 'Error en el servidor');
	}
};
