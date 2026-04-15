import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

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

	// Validar rol del usuario en BD
	// Por seguridad, validar en la BD
	try {
		const { getConnection } = await import('$lib/server/db');
		const pool = await getConnection();

		const roleCheck = await pool
			.query(
			`
				SELECT r.nombre as rolname
				FROM Usuario_Organizacion uo
				INNER JOIN Roles r ON uo.rolid = r.id
				WHERE uo.usuarioid = $1 AND uo.organizacionid = $2
				LIMIT 1
			`,
			[user.id, user.organizacion]
		);

		if (roleCheck.rows.length === 0 || roleCheck.rows[0].rolname !== 'Administrador') {
			throw redirect(302, '/dashboard');
		}
	} catch (error) {
		// Si hay error o no es administrador, redirigir
		if (error instanceof Error && error.message.includes('SvelteKitError')) {
			throw error;
		}
		throw redirect(302, '/dashboard');
	}

	return {};
};

