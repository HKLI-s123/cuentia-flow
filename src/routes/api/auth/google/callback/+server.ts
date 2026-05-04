/**
 * Endpoint para callback de Google OAuth
 * 
 * GET /api/auth/google/callback?code=...&state=...
 * Intercambia el code por access_token
 * Obtiene información del usuario
 * Crea/actualiza usuario en BD
 * Genera JWT y set HttpOnly cookies
 */

import { redirect, type RequestEvent } from '@sveltejs/kit';
import { GOOGLE_ID, GOOGLE_SECRET, GOOGLE_REDIRECT_URI } from '$env/static/private';
import { getConnection } from '$lib/server/db';
import { generateAccessToken, generateRefreshToken } from '$lib/server/tokens';
import { secureLog, getClientIP } from '$lib/server/security';

function resolveGoogleRedirectUri(requestUrl: URL): string {
	const configured = (GOOGLE_REDIRECT_URI || '').trim();
	let redirectUri = configured || `${requestUrl.origin}/api/auth/google/callback`;

	if (
		process.env.NODE_ENV === 'production' &&
		redirectUri.startsWith('http://') &&
		!redirectUri.startsWith('http://localhost')
	) {
		redirectUri = redirectUri.replace('http://', 'https://');
	}

	return redirectUri;
}

/**
 * Interfaz para respuesta de Google
 */
interface GoogleTokenResponse {
	access_token: string;
	expires_in: number;
	refresh_token?: string;
	scope: string;
	token_type: string;
	id_token?: string;
}

/**
 * Interfaz para perfil de Google
 */
interface GoogleProfile {
	id: string;
	email: string;
	name: string;
	picture?: string;
	given_name?: string;
	family_name?: string;
}

export const GET = async ({ url, cookies }: RequestEvent): Promise<void> => {
	// Validar configuración
	if (!GOOGLE_ID || !GOOGLE_SECRET) {
		console.error('[GOOGLE] Credenciales de Google no configuradas en .env');
		throw redirect(302, '/?error=google_not_configured');
	}

	const redirectUri = resolveGoogleRedirectUri(url);

	try {
		const code = url.searchParams.get('code');
		const state = url.searchParams.get('state');
		const error = url.searchParams.get('error');

		// Validar que no hay error de Google
		if (error) {
			console.error('[GOOGLE CALLBACK] Error de Google:', error);
			secureLog('warn', 'Google OAuth error', { error });
			throw redirect(302, '/?error=google_denied');
		}

		// Validar que tenemos code y state
		if (!code || !state) {
			console.error('[GOOGLE CALLBACK] Missing code or state');
			throw redirect(302, '/?error=google_invalid_response');
		}

		// Validar state (CSRF protection)
		const storedState = cookies.get('google_oauth_state');
		if (!storedState || storedState !== state) {
			console.error('[GOOGLE CALLBACK] State mismatch!');
			console.error('[GOOGLE CALLBACK] Stored:', storedState);
			console.error('[GOOGLE CALLBACK] From URL:', state);
			secureLog('warn', 'Google OAuth state mismatch', {});
			throw redirect(302, '/?error=csrf_token_invalid');
		}

		// Limpiar cookie de state
		cookies.delete('google_oauth_state', { path: '/' });

		// ========================================
		// 1. INTERCAMBIAR CODE POR TOKEN
		// ========================================

		const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				client_id: GOOGLE_ID,
				client_secret: GOOGLE_SECRET,
				code: code,
				grant_type: 'authorization_code',
				redirect_uri: redirectUri
			}).toString()
		});

		if (!tokenResponse.ok) {
			console.error('[GOOGLE CALLBACK] Token exchange failed:', tokenResponse.status);
			throw new Error('Token exchange failed');
		}

		const tokenData: GoogleTokenResponse = await tokenResponse.json();
		// ========================================
		// 2. OBTENER PERFIL DEL USUARIO
		// ========================================

		const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
				'Content-Type': 'application/json'
			}
		});

		if (!profileResponse.ok) {
			console.error('[GOOGLE CALLBACK] Profile fetch failed:', profileResponse.status);
			throw new Error('Profile fetch failed');
		}

		const profile: GoogleProfile = await profileResponse.json();
		// ========================================
		// 3. ACTUALIZAR/CREAR USUARIO EN BD
		// ========================================

		const pool = await getConnection();

		// Buscar por google_id
		const existingByGoogle = await pool.query(
			'SELECT id as id, correo, nombre FROM usuarios WHERE google_id = $1',
			[profile.id]
		);

		if (existingByGoogle.rows.length > 0) {
			const user = existingByGoogle.rows[0];
			await createSession(cookies, user.id, user.correo);
			return;
		}

		// Buscar por email (vinculación)
		const existingByEmail = await pool.query(
			'SELECT id as id FROM usuarios WHERE correo = $1',
			[profile.email.toLowerCase()]
		);

		if (existingByEmail.rows.length > 0) {
			const user = existingByEmail.rows[0];
			await pool.query(
				`UPDATE usuarios 
				 SET google_id = $1, foto_url = $2, provider = $3
				 WHERE id = $4`,
				[profile.id, profile.picture || null, 'both', user.id]
			);

			await createSession(cookies, user.id, profile.email);
			return;
		}

		// ========================================
		// 4. CREAR NUEVO USUARIO
		// ========================================

		const nombres = profile.name.split(' ');
		const nombre = profile.given_name || nombres[0] || 'Usuario';
		const apellido = profile.family_name || nombres[1] || profile.email.split('@')[0];

		const insertResult = await pool.query(
			`INSERT INTO usuarios (correo, nombre, apellido, google_id, foto_url, provider, activo)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING id as id`,
			[profile.email.toLowerCase(), nombre, apellido, profile.id, profile.picture || null, 'google', true]
		);

		const newUserIdResult = insertResult.rows[0];
		await createSession(cookies, newUserIdResult.id, profile.email);
		return;
	} catch (error) {
		// El redirect() lanza un objeto especial, no un Error - re-lanzarlo
		if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
			throw error;
		}
		console.error('[GOOGLE CALLBACK] Error:', error);
		secureLog('error', 'Google OAuth callback error', {
			error: error instanceof Error ? error.message : 'Unknown error'
		});
		throw redirect(302, '/?error=google_callback_failed');
	}
};

/**
 * Función auxiliar para crear sesión
 * Genera JWT tokens y set HttpOnly cookies
 * Consulta la BD para incluir organización y rol en el token
 */
async function createSession(cookies: any, usuarioId: number, correo: string) {
	try {
		// Obtener datos completos del usuario (nombre, apellido, org, rol)
		const pool = await getConnection();
		const userResult = await pool.query(
			`SELECT u.nombre, u.apellido, uo.organizacionid, uo.rolid
			 FROM usuarios u
			 LEFT JOIN usuario_organizacion uo ON u.id = uo.usuarioid
			 WHERE u.id = $1`,
			[usuarioId]
		);

		const userData = userResult.rows[0] || {};

		// Generar tokens con datos completos
		const tokenPayload = {
			id: usuarioId,
			correo: correo,
			nombre: userData.nombre || undefined,
			apellido: userData.apellido || undefined,
			organizacion: userData.organizacionid || undefined,
			rolId: userData.rolid || undefined
		};

		const accessToken = generateAccessToken(tokenPayload);
		const refreshToken = generateRefreshToken(tokenPayload);

		// Set HttpOnly cookies
		cookies.set('accessToken', accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 15, // 15 minutos
			path: '/'
		});

		cookies.set('refreshToken', refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7, // 7 días
			path: '/'
		});

		secureLog('info', 'Google OAuth successful login', {
			usuarioId: usuarioId,
			correo: correo
		});

		// Redirigir a dashboard
		throw redirect(302, '/dashboard');
	} catch (error) {
		// El redirect() lanza un objeto especial, no un Error
		if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
			throw error; // Re-throw redirect
		}
		console.error('[GOOGLE CALLBACK] Error creando sesión:', error);
		throw redirect(302, '/?error=session_creation_failed');
	}
}
