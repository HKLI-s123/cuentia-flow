import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Protección de ruta: Solo Administradores pueden acceder a Configuración
 * Los Agentes de Cobranza serán redirigidos al dashboard
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) {
		throw redirect(302, '/login');
	}

	// Si no tiene rolId (usuario sin organización), permitir acceso para contratar plan
	if (!user.rolId) {
		return {};
	}

	// rolId 3 = Administrador. Si tiene otro rol, redirigir
	if (user.rolId !== 3) {
		throw redirect(302, '/dashboard');
	}

	return {};
};
