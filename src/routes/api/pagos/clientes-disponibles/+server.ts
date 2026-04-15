import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  try {
    const organizacionId = event.url.searchParams.get('organizacionId');
    const search = event.url.searchParams.get('search') || '';

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

    const pool = await getConnection();

    // Construir WHERE clause para búsqueda
    const params: any[] = [organizacionId];
    let paramIndex = 2;
    let whereClause = 'WHERE c.organizacionid = $1';
    if (search) {
      whereClause += `
        AND (
          c.razonsocial ILIKE $${paramIndex} OR
          c.rfc ILIKE $${paramIndex} OR
          c.nombrecomercial ILIKE $${paramIndex}
        )
      `;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const query = `
      SELECT
        c.id,
        c.razonsocial as "razonSocial",
        c.nombrecomercial as "nombreComercial",
        c.rfc,
        c.correoprincipal as correo,
        c.telefono,
        r.codigo as "regimenFiscal",
        c.codigopostal as "codigoPostal",
        COUNT(DISTINCT f.id) as "totalFacturas",
        COUNT(DISTINCT CASE WHEN f.saldopendiente > 0 AND COALESCE(f.estado_factura_id, 0) != 6 THEN f.id END) as "facturasConSaldo"
      FROM clientes c
      LEFT JOIN facturas f ON c.id = f.clienteid
      LEFT JOIN regimen r ON c.regimenfiscalid = r.id_regimen
      ${whereClause}
      GROUP BY c.id, c.razonsocial, c.nombrecomercial, c.rfc, c.correoprincipal, c.telefono, r.codigo, c.codigopostal
      ORDER BY c.razonsocial ASC
      LIMIT 20
    `;

    const result = await pool.query(query, params);

    return new Response(
      JSON.stringify({
        success: true,
        clientes: result.rows.map((row: any) => ({
          id: row.id,
          razonSocial: row.razonSocial,
          nombreComercial: row.nombreComercial,
          rfc: row.rfc,
          correo: row.correo,
          telefono: row.telefono,
          regimenFiscal: row.regimenFiscal,
          codigoPostal: row.codigoPostal,
          totalFacturas: parseInt(row.totalFacturas),
          facturasConSaldo: parseInt(row.facturasConSaldo)
        }))
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching clientes disponibles:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error al obtener clientes'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
