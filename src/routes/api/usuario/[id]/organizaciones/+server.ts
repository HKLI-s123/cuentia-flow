import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';

interface Organizacion {
  Id: number;
  RazonSocial: string;
  RFC: string;
  RolId: number;
  Nombre: string;
}

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;

  try {
    // Consulta para obtener las organizaciones del usuario
    const query = `
      SELECT DISTINCT
        o.Id,
        o.RazonSocial,
        o.RFC,
        uo.RolId,
        r.Nombre
      FROM Usuario_Organizacion uo
      INNER JOIN Organizaciones o ON uo.OrganizacionId = o.Id
      INNER JOIN Roles r ON uo.RolId = r.Id
      WHERE uo.UsuarioId = @userId
      ORDER BY o.RazonSocial ASC
    `;

    const connection = await getConnection();
    const result = await connection.request()
      .input('userId', parseInt(id))
      .query(query);

    if (!result.recordset || result.recordset.length === 0) {
      return json({
        success: false,
        message: 'No se encontraron organizaciones para este usuario',
        organizaciones: []
      });
    }

    const organizaciones = result.recordset.map((org: Organizacion) => ({
      id: org.Id,
      razonSocial: org.RazonSocial,
      rfc: org.RFC,
      rolId: org.RolId,
      rolNombre: org.Nombre
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