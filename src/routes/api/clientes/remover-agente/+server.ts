import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
    try {
        const user = getUserFromRequest(event);
        if (!user) return unauthorizedResponse();

        const { clienteId } = await event.request.json();

        if (!clienteId) {
            return new Response(
                JSON.stringify({ error: 'clienteId es requerido' }),
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // Eliminar todas las asignaciones existentes para este cliente
        await pool.query(`
                DELETE FROM Agentes_Clientes
                WHERE ClienteId = $1
            `, [parseInt(clienteId)]);

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