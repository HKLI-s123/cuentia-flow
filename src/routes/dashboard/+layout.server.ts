import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { resolveUserContext } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }

	const resolvedContext = await resolveUserContext(
		locals.user.id,
		locals.user.organizacion ?? null
	);

	const user = {
		...locals.user,
		organizacion: resolvedContext.organizacionId,
		rolId: resolvedContext.rolId ?? locals.user.rolId ?? null,
		rolNombre: resolvedContext.rolNombre
	};

  return {
    user,
    organizacionId: user.organizacion || null,
    rolId: user.rolId || null
  };
};