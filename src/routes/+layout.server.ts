// routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Pasar información del usuario a todas las rutas
	return {
		user: locals.user
	};
};

