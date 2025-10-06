import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { clienteId, organizacionId, usuarioId } = await request.json();

        if (!clienteId || !usuarioId) {
            return new Response(
                JSON.stringify({ error: 'clienteId y usuarioId son requeridos' }),
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // Verificar si ya existe esta combinación ClienteId + UsuarioId
        const existeRelacion = await pool.request()
            .input('clienteId', parseInt(clienteId))
            .input('usuarioId', parseInt(usuarioId))
            .query(`
                SELECT COUNT(*) as count
                FROM Agentes_Clientes
                WHERE ClienteId = @clienteId AND UsuarioId = @usuarioId
            `);

        // Si ya existe esta relación, no hacer nada
        if (existeRelacion.recordset[0].count > 0) {
            // Obtener nombre del agente para respuesta
            const agenteInfo = await pool.request()
                .input('usuarioId', parseInt(usuarioId))
                .query(`
                    SELECT CONCAT(Nombre, ' ', Apellido) as nombreCompleto
                    FROM Usuarios
                    WHERE Id = @usuarioId
                `);

            return new Response(
                JSON.stringify({
                    success: true,
                    agenteId: parseInt(usuarioId),
                    agenteNombre: agenteInfo.recordset[0]?.nombreCompleto || 'Sin nombre',
                    message: 'El agente ya estaba asignado a este cliente'
                }),
                { status: 200 }
            );
        }

        // Asignar agente al cliente
        await pool.request()
            .input('clienteId', parseInt(clienteId))
            .input('usuarioId', parseInt(usuarioId))
            .query(`
                INSERT INTO Agentes_Clientes (ClienteId, UsuarioId, RolAgente, CreatedAt, UpdatedAt)
                VALUES (@clienteId, @usuarioId, 'Agente Principal', GETDATE(), GETDATE())
            `);

        // Obtener nombre del agente para respuesta
        const agenteInfo = await pool.request()
            .input('usuarioId', parseInt(usuarioId))
            .query(`
                SELECT CONCAT(Nombre, ' ', Apellido) as nombreCompleto
                FROM Usuarios
                WHERE Id = @usuarioId
            `);

        return new Response(
            JSON.stringify({
                success: true,
                agenteId: parseInt(usuarioId),
                agenteNombre: agenteInfo.recordset[0]?.nombreCompleto || 'Sin nombre',
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