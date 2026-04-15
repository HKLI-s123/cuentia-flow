import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { verifyAccessToken } from '$lib/server/tokens';

export const GET: RequestHandler = async ({ request }) => {
    try {
        // Obtener el token del header Authorization
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Token de autorización requerido' }, { status: 401 });
        }

        const token = authHeader.substring(7); // Remover 'Bearer '
        
        // Verificar firma del token (no solo decodificar)
        const decodedToken = verifyAccessToken(token);
        if (!decodedToken || !decodedToken.correo) {
            return json({ error: 'Token inválido' }, { status: 401 });
        }

        const pool = await getConnection();
        const result = await pool.query(
            `
                SELECT
                    u.id,
                    u.nombre,
                    u.apellido,
                    u.correo,
                    uo.organizacionid,
                    o.razonsocial as organizacion,
                    r.nombre as rol,
                    uo.id as usuarioorganizacionid
                FROM Usuarios u
                LEFT JOIN Usuario_Organizacion uo ON u.id = uo.usuarioid
                LEFT JOIN Organizaciones o ON uo.organizacionid = o.id
                LEFT JOIN Roles r ON uo.rolid = r.id
                WHERE u.correo = $1
                    AND u.activo = true
                ORDER BY o.razonsocial, r.nombre
            `,
            [decodedToken.correo]
        );

        if (result.rows.length === 0) {
            return json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        // Agrupar los datos del usuario con sus organizaciones
        const firstRecord = result.rows[0];
        const organizaciones = result.rows
            .filter((row: any) => row.organizacionid) // Solo filas con organización
            .map((row: any) => ({
                organizacionId: row.organizacionid,
                organizacion: row.organizacion,
                rol: row.rol,
                usuarioOrganizacionId: row.usuarioorganizacionid
            }));

        // Formatear la respuesta
        const userInfo = {
            id: firstRecord.id,
            nombre: `${firstRecord.nombre} ${firstRecord.apellido}`.trim(),
            email: firstRecord.correo,
            // Usar la primera organización como principal (para compatibilidad)
            organizacion: organizaciones[0]?.organizacion || 'Sin Organización',
            organizacionId: organizaciones[0]?.organizacionId || null,
            rol: organizaciones[0]?.rol || 'Sin Rol',
            iniciales: `${firstRecord.nombre?.charAt(0) || ''}${firstRecord.apellido?.charAt(0) || ''}`.toUpperCase(),
            // Agregar todas las organizaciones para edición
            organizaciones: organizaciones
        };

        return json(userInfo);
    } catch (error) {
        console.error('Error al obtener información del usuario:', error);
        return json({ error: 'Error interno del servidor' }, { status: 500 });
    }
};