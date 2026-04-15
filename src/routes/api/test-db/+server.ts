import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
    // Solo permitir en desarrollo
    if (process.env.NODE_ENV === 'production') {
        return new Response(JSON.stringify({ error: 'No disponible' }), { status: 404 });
    }
    const user = getUserFromRequest(event);
    if (!user) return unauthorizedResponse();

    try {
        const pool = await getConnection();
        const result = await pool.query('SELECT NOW() AS now');
        return new Response(JSON.stringify({ now: result.rows[0].now }));
    } catch (err) {
        console.error('Error en test-db endpoint:', err);
        return new Response(JSON.stringify({ error: 'Error de conexión a base de datos' }), { status: 500 });
    }
};
