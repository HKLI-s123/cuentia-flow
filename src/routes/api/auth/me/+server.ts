import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyAccessToken } from '$lib/server/tokens';
import { getClientIP, secureLog, secureErrorResponse } from '$lib/server/security';

export const GET: RequestHandler = async (event) => {
	try {
		const clientIP = getClientIP(event);
		const accessToken = event.cookies.get('accessToken');
		if (!accessToken) {
			secureLog('warn', 'Me request without accessToken cookie', { ip: clientIP });
			return secureErrorResponse(401, 'No autenticado');
		}

		const payload = verifyAccessToken(accessToken);
		if (!payload) {
			secureLog('warn', 'Me request with invalid/expired token', { ip: clientIP });
			return secureErrorResponse(401, 'Token inválido o expirado');
		}

		return json(
			{
				id: payload.id,
				correo: payload.correo,
				organizacion: payload.organizacion,
				rolId: payload.rolId
			},
			{ status: 200 }
		);
	} catch (err) {
		secureLog('error', 'Me endpoint error', {
			error: err instanceof Error ? err.message : 'Unknown error'
		});
		return secureErrorResponse(500, 'Error al obtener datos del usuario');
	}
};
