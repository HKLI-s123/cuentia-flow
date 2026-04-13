/**
 * Endpoint de Refresco de Tokens
 * 
 * Renueva el Access Token usando el Refresh Token
 * Ambos se transmiten en HttpOnly cookies
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyRefreshToken, generateAccessToken } from '$lib/server/tokens';
import { secureLog, getClientIP, secureErrorResponse } from '$lib/server/security';

const SECURE_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'strict' as const,
	maxAge: 60 * 60 * 24 * 7, // 7 días
	path: '/'
};

export const POST: RequestHandler = async (event) => {
	try {
		const clientIP = getClientIP(event);

		// Obtener refresh token de la cookie
		const refreshToken = event.cookies.get('refreshToken');

		if (!refreshToken) {
			secureLog('warn', 'Refresh attempt without refreshToken cookie', { ip: clientIP });
			return secureErrorResponse(401, 'Refresh token no encontrado');
		}

		// Verificar que el refresh token sea válido
		const payload = verifyRefreshToken(refreshToken);

		if (!payload) {
			secureLog('warn', 'Refresh attempt with invalid/expired refresh token', { ip: clientIP });
			// Limpiar cookies si el refresh token es inválido
			event.cookies.delete('accessToken', { path: '/' });
			event.cookies.delete('refreshToken', { path: '/' });
			return secureErrorResponse(401, 'Refresh token inválido o expirado');
		}

		// Generar nuevo access token
		const newAccessToken = generateAccessToken(payload);

		// Enviar nuevo access token en HttpOnly cookie
		event.cookies.set('accessToken', newAccessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax' as const,
			maxAge: 60 * 15, // 15 minutos
			path: '/'
		});

		secureLog('info', 'Token refreshed successfully', {
			userId: payload.id,
			ip: clientIP
		});

		return json({ message: 'Token refrescado correctamente' }, { status: 200 });
	} catch (err) {
		secureLog('error', 'Refresh endpoint error', {
			error: err instanceof Error ? err.message : 'Unknown error'
		});
		return secureErrorResponse(500, 'Error al refrescar el token');
	}
};
