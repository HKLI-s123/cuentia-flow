/**
 * Endpoint para iniciar flujo OAuth con Google
 * 
 * GET /api/auth/google/authorize
 * Redirige a Google para que el usuario log in
 * Después Google redirige a /api/auth/google/callback con code
 */

import { redirect } from '@sveltejs/kit';
import { GOOGLE_ID, GOOGLE_REDIRECT_URI } from '$env/static/private';

/**
 * Genera un state token para CSRF protection
 * Lo guardamos en una cookie segura y lo validamos en el callback
 */
function generateState(): string {
	return Array.from(crypto.getRandomValues(new Uint8Array(32)))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export const GET = async ({ cookies }) => {
	const redirectUri = GOOGLE_REDIRECT_URI || 'http://localhost:5173/api/auth/google/callback';

	// Validar configuración
	if (!GOOGLE_ID) {
		console.error('[GOOGLE] GOOGLE_ID no está configurado en .env');
		throw redirect(302, '/?error=google_not_configured');
	}

	// Generar state para CSRF protection
	const state = generateState();

	// Guardar state en cookie segura (httpOnly, no secure en dev)
	cookies.set('google_oauth_state', state, {
		httpOnly: true,
		secure: false, // localhost no es HTTPS
		sameSite: 'lax',
		maxAge: 60 * 10, // 10 minutos
		path: '/'
	});

	// Construir URL de autorización de Google
	const params = new URLSearchParams({
		client_id: GOOGLE_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		state: state
	});

	const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

	// Redirigir a Google
	throw redirect(302, googleAuthUrl);
};
