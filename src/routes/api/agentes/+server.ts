import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	try {
		const organizacionId = event.url.searchParams.get('organizacionId');
		
		if (!organizacionId) {
			return json({ error: 'organizacionId es requerido' }, { status: 400 });
		}

		// Validar acceso a la organización
		const auth = await validateOrganizationAccess(event, organizacionId);
		if (!auth.valid) return auth.error!;

		const pool = await getConnection();
		const result = await pool.query(`
				SELECT DISTINCT
					u.Id as value,
					CONCAT(u.Nombre, ' ', u.Apellido) as text,
					u.Nombre,
					u.Apellido
				FROM Usuarios u
				INNER JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
				WHERE uo.OrganizacionId = $1
					AND u.Activo = true
				ORDER BY u.Nombre, u.Apellido
			`, [organizacionId]);

		return json(result.rows);
	} catch (error) {
		console.error('Error al obtener agentes:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};