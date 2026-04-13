// routes/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Si está autenticado, redirigir a dashboard
	if (locals.user) {
		throw redirect(302, '/dashboard');
	}

	return {};
};
