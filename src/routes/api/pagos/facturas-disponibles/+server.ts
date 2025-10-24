import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const organizacionId = url.searchParams.get('organizacionId');
    const clienteId = url.searchParams.get('clienteId');

    if (!organizacionId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'organizacionId es requerido'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!clienteId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'clienteId es requerido'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pool = await getConnection();

    const query = `
      SELECT
        f.Id as id,
        f.numero_factura as numeroFactura,
        f.MontoTotal as montoTotal,
        f.SaldoPendiente as saldoPendiente,
        f.FechaEmision as fechaEmision,
        f.FechaVencimiento as fechaVencimiento,
        f.estado_factura_id as estadoId,
        DATEDIFF(DAY, f.FechaVencimiento, GETDATE()) as diasVencido
      FROM Facturas f
      INNER JOIN Clientes cl ON f.ClienteId = cl.Id
      WHERE f.ClienteId = @clienteId
        AND cl.OrganizacionId = @organizacionId
        AND f.SaldoPendiente > 0
        AND NOT EXISTS (
          SELECT 1 FROM Pagos p WHERE p.FacturaId = f.Id
        )
      ORDER BY f.FechaVencimiento DESC
    `;

    const result = await pool.request()
      .input('clienteId', parseInt(clienteId))
      .input('organizacionId', organizacionId)
      .query(query);

    return new Response(
      JSON.stringify({
        success: true,
        facturas: result.recordset.map((row: any) => ({
          id: row.id,
          numeroFactura: row.numeroFactura,
          montoTotal: row.montoTotal,
          saldoPendiente: row.saldoPendiente,
          fechaEmision: row.fechaEmision,
          fechaVencimiento: row.fechaVencimiento,
          estadoId: row.estadoId,
          diasVencido: row.diasVencido
        }))
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching facturas disponibles:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al obtener facturas'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
