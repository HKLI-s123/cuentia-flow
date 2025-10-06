import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { clienteId } = await request.json();

        if (!clienteId) {
            return new Response(
                JSON.stringify({ error: 'clienteId es requerido' }),
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // Eliminar todas las asignaciones existentes para este cliente
        await pool.request()
            .input('clienteId', parseInt(clienteId))
            .query(`
                DELETE FROM Agentes_Clientes
                WHERE ClienteId = @clienteId
            `);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Asignaciones de agente removidas exitosamente'
            }),
            { status: 200 }
        );

    } catch (error) {
        console.error('❌ Error removiendo asignación de agente:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500 }
        );
    }
};