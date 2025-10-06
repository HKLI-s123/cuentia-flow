import { getConnection } from '$lib/server/db'; // Ajusta la ruta si es diferente
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		const pool = await getConnection();
		const result = await pool.request().query(`
			SELECT ID_Regimen, Codigo, Descripcion FROM Regimen ORDER BY ID_Regimen
		`);

		const regimenes = result.recordset;

		return new Response(JSON.stringify(regimenes), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Error al obtener los regímenes fiscales:', error);
		return new Response(JSON.stringify({ error: 'Error al obtener los regímenes fiscales' }), {
			status: 500
		});
	}
};
