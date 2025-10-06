import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
    try {
        const usuarioId = parseInt(params.id || '0');

        if (!usuarioId) {
            return new Response(
                JSON.stringify({ error: 'ID de usuario inválido' }),
                { status: 400 }
            );
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('usuarioId', usuarioId)
            .query(`
                SELECT
                    uo.OrganizacionId,
                    o.RazonSocial as organizacion_nombre,
                    uo.RolId,
                    r.Nombre as rol_nombre
                FROM Usuario_Organizacion uo
                INNER JOIN Organizaciones o ON uo.OrganizacionId = o.Id
                LEFT JOIN Roles r ON uo.RolId = r.Id
                WHERE uo.UsuarioId = @usuarioId
            `);

        if (result.recordset.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Usuario sin organización asignada' }),
                { status: 404 }
            );
        }

        const orgData = result.recordset[0];

        return new Response(
            JSON.stringify({
                organizacionId: orgData.OrganizacionId,
                organizacionNombre: orgData.organizacion_nombre,
                rolId: orgData.RolId,
                rolNombre: orgData.rol_nombre || 'Usuario'
            }),
            { status: 200 }
        );

    } catch (error) {
        console.error('❌ Error obteniendo organización del usuario:', error);
        return new Response(
            JSON.stringify({ error: 'Error interno del servidor' }),
            { status: 500 }
        );
    }
};