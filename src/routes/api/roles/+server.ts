import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	try {
		const pool = await getConnection();

		// Obtener todos los roles de la base de datos (solo Id y Nombre)
		const result = await pool
			.request()
			.query(`
				SELECT Id, Nombre
				FROM Roles
				ORDER BY Nombre ASC
			`);

		return json({
			success: true,
			roles: result.recordset.map((rol: any) => ({
				id: rol.Id,
				nombre: rol.Nombre
			}))
		});

	} catch (err) {
		console.error('Error al obtener roles:', err);
		return json({
			success: false,
			error: 'Error en el servidor',
			details: err instanceof Error ? err.message : 'Error desconocido'
		}, { status: 500 });
	}
};
