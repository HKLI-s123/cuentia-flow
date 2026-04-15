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
		const result = await pool.query(`
			SELECT id as "ID", claveestado as "ClaveEstado", nombreestado as "NombreEstado", paisid as "PaisID"
			FROM Estados 
			WHERE paisid = $1
			ORDER BY nombreestado
		`, [paisId]);

		const estados = result.rows;

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