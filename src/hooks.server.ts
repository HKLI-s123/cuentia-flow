import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/auth';

// Lista de rutas públicas que NO requieren autenticación
const PUBLIC_ROUTES = [
	'/api/login',
	// '/api/auth/register',
	// '/api/test-db', // Solo para desarrollo, remover en producción
	// '/api/analyze-db', // Solo para desarrollo, remover en producción
	'/api/analyze-db', // Solo para desarrollo, remover en producción
];

export const handle: Handle = async ({ event, resolve }) => {
	// Solo proteger rutas API
	if (event.url.pathname.startsWith('/api')) {
		// Verificar si es una ruta pública
		const isPublicRoute = PUBLIC_ROUTES.some(route => event.url.pathname.startsWith(route));

		if (!isPublicRoute) {
			// Obtener token del header
			const authHeader = event.request.headers.get('authorization');

			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return new Response(
					JSON.stringify({
						error: 'No autorizado - Token requerido'
					}),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			const token = authHeader.substring(7);
			const user = verifyToken(token);

			if (!user) {
				return new Response(
					JSON.stringify({
						error: 'No autorizado - Token inválido o expirado'
					}),
					{
						status: 401,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}

			// Adjuntar usuario al evento para usarlo en los endpoints
			event.locals.user = user;
		}
	}

	return resolve(event);
};
