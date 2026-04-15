import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
    try {
        const rfc = event.url.searchParams.get('rfc');
        const organizacionId = event.url.searchParams.get('organizacionId');

        if (!rfc || !organizacionId) {
            return new Response(
                JSON.stringify({ error: 'RFC y organizacionId son requeridos' }),
                { status: 400 }
            );
        }

        // Validar acceso a la organización
        const auth = await validateOrganizationAccess(event, organizacionId);
        if (!auth.valid) return auth.error!;

        const pool = await getConnection();

        // Buscar cliente por RFC en la organización específica
        const result = await pool.query(`
                SELECT Id as id
                FROM Clientes
                WHERE RFC = $1 AND OrganizacionId = $2
                ORDER BY Id DESC
                LIMIT 1
            `, [rfc, parseInt(organizacionId)]);

        if (result.rows.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Cliente no encontrado' }),
                { status: 404 }
            );
        }

        return new Response(
            JSON.stringify(result.rows[0]),
            { status: 200 }
        );

    } catch (error) {
        console.error('❌ Error buscando cliente por RFC:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500 }
        );
    }
};