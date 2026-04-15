import { getConnection } from '$lib/server/db'; // Ajusta la ruta si es diferente
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		const pool = await getConnection();
		const result = await pool.query(`
			SELECT id_regimen as "ID_Regimen", codigo as "Codigo", descripcion as "Descripcion" FROM Regimen ORDER BY id_regimen
		`);

		const regimenes = result.rows;

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
