import { getConnection } from '$lib/server/db';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		const pool = await getConnection();
		const result = await pool.request().query(`
			SELECT ID, NombrePais 
			FROM Paises 
			ORDER BY ID
		`);

		const paises = result.recordset;

		return new Response(JSON.stringify(paises), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Error al obtener los países:', error);
		return new Response(JSON.stringify({ error: 'Error al obtener los países' }), {
			status: 500
		});
	}
};