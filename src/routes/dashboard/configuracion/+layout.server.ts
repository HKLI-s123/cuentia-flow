import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { resolveUserContext } from '$lib/server/auth';

/**
 * Protección de ruta: Solo Administradores pueden acceder a Configuración
 * Los Agentes de Cobranza serán redirigidos al dashboard
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		throw redirect(302, '/login');
	}

	const resolvedContext = await resolveUserContext(user.id, user.organizacion ?? null);

	// Si no tiene organización, permitir acceso para contratar plan
	if (!resolvedContext.organizacionId) {
		return {};
	}

	// rolId 3 = Administrador. Si tiene otro rol, redirigir
	if (resolvedContext.rolId !== 3) {
		throw redirect(302, '/dashboard');
	}

	return {};
};
