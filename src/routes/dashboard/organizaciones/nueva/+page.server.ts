/**
 * Server-side load function para la página de crear nueva organización
 * Cualquier usuario autenticado puede crear organizaciones.
 * No se requiere un rol específico - la lógica es que si el usuario no tiene
 * organizaciones en `usuario_organizacion`, puede crear una nueva.
 */

import type { PageServerLoad } from './$types';
import { resolveUserContext } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	// El dashboard layout ya valida autenticación
	// Esta verificación es redundante pero explícita para esta página
	if (!locals.user) {
		throw new Error('No autenticado');
	}

	const resolvedContext = await resolveUserContext(
		locals.user.id,
		locals.user.organizacion ?? null
	);

	// Pasar datos del usuario al cliente de forma segura
	return {
		user: {
			id: locals.user.id,
			correo: locals.user.correo,
			organizacion: resolvedContext.organizacionId
		}
	};
};
