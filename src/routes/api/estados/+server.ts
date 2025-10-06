import { getConnection } from '$lib/server/db';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const paisId = url.searchParams.get('paisId');
		
		if (!paisId) {
			return new Response(JSON.stringify({ error: 'ID del país es requerido' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const pool = await getConnection();
		const result = await pool.request().query(`
			SELECT ID, ClaveEstado, NombreEstado, PaisID
			FROM Estados 
			WHERE PaisID = ${paisId}
			ORDER BY NombreEstado
		`);

		const estados = result.recordset;

		return new Response(JSON.stringify(estados), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Error al obtener los estados:', error);
		return new Response(JSON.stringify({ error: 'Error al obtener los estados' }), {
			status: 500
		});
	}
};