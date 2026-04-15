import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, forbiddenResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  const { id } = event.params;

  // Verificar autenticación y que el usuario solo acceda a sus propios datos
  const user = getUserFromRequest(event);
  if (!user) return unauthorizedResponse();
  if (user.id !== parseInt(id)) return forbiddenResponse('No puedes acceder a datos de otro usuario');

  try {
    const query = `
      SELECT DISTINCT
        o.id,
        o.razonsocial,
        o.rfc,
        uo.rolid,
        r.nombre
      FROM Usuario_Organizacion uo
      INNER JOIN Organizaciones o ON uo.organizacionid = o.id
      INNER JOIN Roles r ON uo.rolid = r.id
      WHERE uo.usuarioid = $1
      ORDER BY o.razonsocial ASC
    `;

    const connection = await getConnection();
    const result = await connection.query(query, [id]);

    if (!result.rows || result.rows.length === 0) {
      return json({
        success: false,
        message: 'No se encontraron organizaciones para este usuario',
        organizaciones: []
      });
    }

    const organizaciones = result.rows.map((org: any) => ({
      id: org.id,
      razonSocial: org.razonsocial,
      rfc: org.rfc,
      rolId: org.rolid,
      rolNombre: org.nombre
    }));

    return json({
      success: true,
      organizaciones
    });

  } catch (error) {
    console.error('Error obteniendo organizaciones del usuario:', error);
    return json({
      success: false,
      message: 'Error interno del servidor'
    }, { status: 500 });
  }
};