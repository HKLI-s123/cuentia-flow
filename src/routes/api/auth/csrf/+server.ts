/**
 * Endpoint CSRF Token
 * 
 * Genera y devuelve un token CSRF único para prevenir ataques CSRF
 * El cliente debe incluir este token en todos los POST/PUT/DELETE requests
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateCSRFToken, secureLog, getClientIP } from '$lib/server/security';

const CSRF_COOKIE_OPTIONS = {
	httpOnly: false, // El cliente necesita acceso para incluir en requests
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	maxAge: 60 * 60, // 1 hora
	path: '/'
};

export const GET: RequestHandler = async (event) => {
	try {
		const clientIP = getClientIP(event);

		// Generar nuevo token CSRF
		const csrfToken = generateCSRFToken();

		// Guardar en cookie httpOnly=false para que el cliente pueda acceder
		event.cookies.set('csrf_token', csrfToken, CSRF_COOKIE_OPTIONS);

		return json(
			{
				csrf_token: csrfToken,
				message: 'CSRF token generado correctamente'
			},
			{ status: 200 }
		);
	} catch (err) {
		secureLog('error', 'CSRF endpoint error', {
			error: err instanceof Error ? err.message : 'Unknown error'
		});

		return json({ error: 'Error al generar CSRF token' }, { status: 500 });
	}
};
