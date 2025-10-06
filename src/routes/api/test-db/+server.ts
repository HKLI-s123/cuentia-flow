import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async () => {
    try {
        const pool = await getConnection();
        const result = await pool.request().query('SELECT GETDATE() AS now');
        return new Response(JSON.stringify({ now: result.recordset[0].now }));
    } catch (err) {
        console.error('Error en test-db endpoint:', err);
        let message = 'Error desconocido';
        if (err instanceof Error) message = err.message;
        return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
};
