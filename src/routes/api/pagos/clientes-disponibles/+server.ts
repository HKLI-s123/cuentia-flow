import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const organizacionId = url.searchParams.get('organizacionId');
    const search = url.searchParams.get('search') || '';

    if (!organizacionId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'organizacionId es requerido'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pool = await getConnection();

    // Construir WHERE clause para búsqueda
    let whereClause = 'WHERE c.OrganizacionId = @organizacionId';
    if (search) {
      whereClause += `
        AND (
          c.RazonSocial LIKE @search OR
          c.RFC LIKE @search OR
          c.NombreComercial LIKE @search
        )
      `;
    }

    const query = `
      SELECT TOP 20
        c.Id as id,
        c.RazonSocial as razonSocial,
        c.NombreComercial as nombreComercial,
        c.RFC as rfc,
        c.CorreoPrincipal as correo,
        c.Telefono as telefono,
        r.Codigo as regimenFiscal,
        c.CodigoPostal as codigoPostal, 
        COUNT(DISTINCT f.Id) as totalFacturas,
        COUNT(DISTINCT CASE WHEN f.SaldoPendiente > 0 THEN f.Id END) as facturasConSaldo
      FROM Clientes c
      LEFT JOIN Facturas f ON c.Id = f.ClienteId
      LEFT JOIN Regimen r ON c.RegimenFiscalId = r.ID_Regimen
      ${whereClause}
      GROUP BY c.Id, c.RazonSocial, c.NombreComercial, c.RFC, c.CorreoPrincipal, c.Telefono, r.Codigo, c.CodigoPostal
      ORDER BY c.RazonSocial ASC
    `;

    const request = pool.request()
      .input('organizacionId', organizacionId);

    if (search) {
      request.input('search', `%${search}%`);
    }

    const result = await request.query(query);

    return new Response(
      JSON.stringify({
        success: true,
        clientes: result.recordset.map((row: any) => ({
          id: row.id,
          razonSocial: row.razonSocial,
          nombreComercial: row.nombreComercial,
          rfc: row.rfc,
          correo: row.correo,
          telefono: row.telefono,
          regimenFiscal: row.regimenFiscal,
          codigoPostal: row.codigoPostal,
          totalFacturas: row.totalFacturas,
          facturasConSaldo: row.facturasConSaldo
        }))
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching clientes disponibles:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al obtener clientes'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
