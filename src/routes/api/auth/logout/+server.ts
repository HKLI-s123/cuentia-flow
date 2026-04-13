/**
 * Endpoint de Logout
 * 
 * Limpia las HttpOnly cookies de autenticación
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { secureLog, getClientIP } from '$lib/server/security';

export const POST: RequestHandler = async (event) => {
	try {
		const clientIP = getClientIP(event);

		// Limpiar cookies
		event.cookies.delete('accessToken', { path: '/' });
		event.cookies.delete('refreshToken', { path: '/' });

		secureLog('info', 'User logged out', { ip: clientIP });

		return json({ message: 'Sesión cerrada correctamente' }, { status: 200 });
	} catch (err) {
		secureLog('error', 'Logout endpoint error', {
			error: err instanceof Error ? err.message : 'Unknown error'
		});

		return json({ error: 'Error al cerrar sesión' }, { status: 500 });
	}
};
