import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const facturaId = url.searchParams.get('facturaId');
    const usuarioId = url.searchParams.get('usuarioId');

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
      SELECT COUNT(*) AS totalPagos
      FROM Pagos p
      INNER JOIN Facturas f ON p.FacturaId = f.Id
      WHERE p.FacturaId = @facturaId
      AND p.UsuarioId = @usuarioId
    `;

    const result = await pool
      .request()
      .input('facturaId', facturaId)
      .input('usuarioId', usuarioId)
      .query(query);

    const totalPagos = result.recordset[0]?.totalPagos || 0;

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
