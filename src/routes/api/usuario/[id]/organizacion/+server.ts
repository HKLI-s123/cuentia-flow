import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
    try {
        const usuarioId = parseInt(event.params.id || '0');

        if (!usuarioId) {
            return new Response(
                JSON.stringify({ error: 'ID de usuario inválido' }),
                { status: 400 }
            );
        }

        // Verificar autenticación y que solo acceda a sus datos
        const user = getUserFromRequest(event);
        if (!user) return unauthorizedResponse();
        if (user.id !== usuarioId) return forbiddenResponse('No puedes acceder a datos de otro usuario');

        const pool = await getConnection();
        const result = await pool.query(
            `
                SELECT
                    uo.organizacionid,
                    o.razonsocial as organizacion_nombre,
                    uo.rolid,
                    r.nombre as rol_nombre
                FROM Usuario_Organizacion uo
                INNER JOIN Organizaciones o ON uo.organizacionid = o.id
                LEFT JOIN Roles r ON uo.rolid = r.id
                WHERE uo.usuarioid = $1
            `,
            [usuarioId]
        );

        if (result.rows.length === 0) {
            return new Response(
                JSON.stringify({ error: 'Usuario sin organización asignada' }),
                { status: 404 }
            );
        }

        const orgData = result.rows[0];

        return new Response(
            JSON.stringify({
                organizacionId: orgData.organizacionid,
                organizacionNombre: orgData.organizacion_nombre,
                rolId: orgData.rolid,
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