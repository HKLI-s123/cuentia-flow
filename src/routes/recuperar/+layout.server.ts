// routes/recuperar/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Si está autenticado, redirigir a dashboard
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}

	return {};
};
