import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
    try {
        const { clienteId, organizacionId, usuarioId } = await event.request.json();

        if (!clienteId || !usuarioId) {
            return new Response(
                JSON.stringify({ error: 'clienteId y usuarioId son requeridos' }),
                { status: 400 }
            );
        }

        // Validar acceso a la organización
        if (organizacionId) {
            const auth = await validateOrganizationAccess(event, organizacionId);
            if (!auth.valid) return auth.error!;
        } else {
            const user = getUserFromRequest(event);
            if (!user) return unauthorizedResponse();
        }

        const pool = await getConnection();

        // Verificar si ya existe esta combinación ClienteId + UsuarioId
        const existeRelacion = await pool.query(`
                SELECT COUNT(*) as count
                FROM Agentes_Clientes
                WHERE ClienteId = $1 AND UsuarioId = $2
            `, [parseInt(clienteId), parseInt(usuarioId)]);

        // Si ya existe esta relación, no hacer nada
        if (parseInt(existeRelacion.rows[0].count) > 0) {
            // Obtener nombre del agente para respuesta
            const agenteInfo = await pool.query(`
                    SELECT CONCAT(Nombre, ' ', Apellido) as nombrecompleto
                    FROM Usuarios
                    WHERE Id = $1
                `, [parseInt(usuarioId)]);

            return new Response(
                JSON.stringify({
                    success: true,
                    agenteId: parseInt(usuarioId),
                    agenteNombre: agenteInfo.rows[0]?.nombrecompleto || 'Sin nombre',
                    message: 'El agente ya estaba asignado a este cliente'
                }),
                { status: 200 }
            );
        }

        // Asignar agente al cliente
        await pool.query(`
                INSERT INTO Agentes_Clientes (ClienteId, UsuarioId, RolAgente, CreatedAt, UpdatedAt)
                VALUES ($1, $2, 'Agente Principal', NOW(), NOW())
            `, [parseInt(clienteId), parseInt(usuarioId)]);

        // Obtener nombre del agente para respuesta
        const agenteInfo = await pool.query(`
                SELECT CONCAT(Nombre, ' ', Apellido) as nombrecompleto
                FROM Usuarios
                WHERE Id = $1
            `, [parseInt(usuarioId)]);

        return new Response(
            JSON.stringify({
                success: true,
                agenteId: parseInt(usuarioId),
                agenteNombre: agenteInfo.rows[0]?.nombrecompleto || 'Sin nombre',
                message: 'Agente asignado exitosamente'
            }),
            { status: 200 }
        );

    } catch (error) {
        console.error('❌ Error asignando agente:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500 }
        );
    }
};