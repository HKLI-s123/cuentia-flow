import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  try {
    const user = getUserFromRequest(event);
    if (!user) return unauthorizedResponse();

    const facturaId = event.url.searchParams.get('facturaId');
    const usuarioId = event.url.searchParams.get('usuarioId');

    if (!facturaId || !usuarioId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'facturaId y organizacionId son requeridos'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pool = await getConnection();

    const query = `
      SELECT COUNT(*) AS "totalPagos"
      FROM pagos p
      INNER JOIN facturas f ON p.facturaid = f.id
      WHERE p.facturaid = $1
      AND p.usuarioid = $2
    `;

    const result = await pool.query(query, [facturaId, usuarioId]);

    const totalPagos = parseInt(result.rows[0]?.totalPagos) || 0;

    return new Response(
      JSON.stringify({
        success: true,
        totalPagos
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error en /api/pagos/contador:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error al obtener número de pagos de la factura'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
