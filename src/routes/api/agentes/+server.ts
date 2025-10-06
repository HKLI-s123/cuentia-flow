import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const organizacionId = url.searchParams.get('organizacionId');
		
		if (!organizacionId) {
			return json({ error: 'organizacionId es requerido' }, { status: 400 });
		}

		const pool = await getConnection();
		const result = await pool.request()
			.input('organizacionId', organizacionId)
			.query(`
				SELECT DISTINCT
					u.Id as value,
					CONCAT(u.Nombre, ' ', u.Apellido) as text,
					u.Nombre,
					u.Apellido
				FROM Usuarios u
				INNER JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
				WHERE uo.OrganizacionId = @organizacionId
					AND u.Activo = 1
				ORDER BY u.Nombre, u.Apellido
			`);

		return json(result.recordset);
	} catch (error) {
		console.error('Error al obtener agentes:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};