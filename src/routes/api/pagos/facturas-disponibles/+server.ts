import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  try {
    const organizacionId = event.url.searchParams.get('organizacionId');
    const clienteId = event.url.searchParams.get('clienteId');

    if (!organizacionId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'organizacionId es requerido'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar acceso a la organización
    const auth = await validateOrganizationAccess(event, organizacionId);
    if (!auth.valid) return auth.error!;

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
        f.id,
        f.numero_factura as "numeroFactura",
        f.montototal as "montoTotal",
        f.saldopendiente as "saldoPendiente",
        f.fechaemision as "fechaEmision",
        f.fechavencimiento as "fechaVencimiento",
        f.estado_factura_id as "estadoId",
        f.uuidfacturapi as uuid,
        EXTRACT(DAY FROM (NOW() - f.fechavencimiento))::int as "diasVencido"
      FROM facturas f
      INNER JOIN clientes cl ON f.clienteid = cl.id
      WHERE f.clienteid = $1
        AND cl.organizacionid = $2
        AND f.saldopendiente > 0
        AND COALESCE(f.estado_factura_id, 0) != 6
      ORDER BY f.fechavencimiento DESC
    `;

    const result = await pool.query(query, [parseInt(clienteId), organizacionId]);

    return new Response(
      JSON.stringify({
        success: true,
        facturas: result.rows.map((row: any) => ({
          id: row.id,
          uuid: row.uuid,
          numeroFactura: row.numeroFactura,
          montoTotal: parseFloat(row.montoTotal) || 0,
          saldoPendiente: parseFloat(row.saldoPendiente) || 0,
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
        message: 'Error al obtener facturas'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
