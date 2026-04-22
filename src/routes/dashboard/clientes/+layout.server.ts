import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { resolveUserContext } from '$lib/server/auth';

/**
 * Protección de ruta: Solo Administradores pueden acceder a Clientes
 * Los Agentes de Cobranza serán redirigidos al dashboard
 */
export const load: LayoutServerLoad = async (event) => {
	const user = event.locals.user;

	// Validar que el usuario esté autenticado
	if (!user) {
		throw redirect(302, '/login');
	}

	const resolvedContext = await resolveUserContext(user.id, user.organizacion ?? null);

	if (!resolvedContext.organizacionId || resolvedContext.rolNombre !== 'Administrador') {
		throw redirect(302, '/dashboard');
	}

	return {};
};

