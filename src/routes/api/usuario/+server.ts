import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import jwt from 'jsonwebtoken';

export const GET: RequestHandler = async ({ request }) => {
    try {
        // Obtener el token del header Authorization
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Token de autorización requerido' }, { status: 401 });
        }

        const token = authHeader.substring(7); // Remover 'Bearer '
        
        // Decodificar el token (ajustar según tu implementación)
        let decodedToken;
        try {
            // Si usas un secret para firmar el JWT, úsalo aquí
            decodedToken = jwt.decode(token) as any;
            if (!decodedToken || !decodedToken.email) {
                return json({ error: 'Token inválido' }, { status: 401 });
            }
        } catch (error) {
            return json({ error: 'Token inválido' }, { status: 401 });
        }

        const pool = await getConnection();
        const result = await pool.request()
            .input('email', decodedToken.email)
            .query(`
                SELECT
                    u.Id,
                    u.Nombre,
                    u.Apellido,
                    u.Correo,
                    uo.OrganizacionId,
                    o.RazonSocial as Organizacion,
                    r.Nombre as Rol,
                    uo.Id as UsuarioOrganizacionId
                FROM Usuarios u
                LEFT JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
                LEFT JOIN Organizaciones o ON uo.OrganizacionId = o.Id
                LEFT JOIN Roles r ON uo.RolId = r.Id
                WHERE u.Correo = @email
                    AND u.Activo = 1
                ORDER BY o.RazonSocial, r.Nombre
            `);

        if (result.recordset.length === 0) {
            return json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        // Agrupar los datos del usuario con sus organizaciones
        const firstRecord = result.recordset[0];
        const organizaciones = result.recordset
            .filter(row => row.OrganizacionId) // Solo filas con organización
            .map(row => ({
                organizacionId: row.OrganizacionId,
                organizacion: row.Organizacion,
                rol: row.Rol,
                usuarioOrganizacionId: row.UsuarioOrganizacionId
            }));

        // Formatear la respuesta
        const userInfo = {
            id: firstRecord.Id,
            nombre: `${firstRecord.Nombre} ${firstRecord.Apellido}`.trim(),
            email: firstRecord.Correo,
            // Usar la primera organización como principal (para compatibilidad)
            organizacion: organizaciones[0]?.organizacion || 'Sin Organización',
            organizacionId: organizaciones[0]?.organizacionId || null,
            rol: organizaciones[0]?.rol || 'Sin Rol',
            iniciales: `${firstRecord.Nombre?.charAt(0) || ''}${firstRecord.Apellido?.charAt(0) || ''}`.toUpperCase(),
            // Agregar todas las organizaciones para edición
            organizaciones: organizaciones
        };

        return json(userInfo);
    } catch (error) {
        console.error('Error al obtener información del usuario:', error);
        return json({ error: 'Error interno del servidor' }, { status: 500 });
    }
};