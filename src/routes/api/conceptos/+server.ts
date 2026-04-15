import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { url } = event;
  try {
    const organizacionId = url.searchParams.get('organizacionId') || '';
    const clienteId = url.searchParams.get('clienteId') || '';
    const searchTerm = url.searchParams.get('search') || '';
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // OBLIGATORIO: Validar organizacionId
    if (!organizacionId) {
      return json({
        success: false,
        error: 'organizacionId es requerido para sistema multi-tenant'
      }, { status: 400 });
    }

    // Buscar conceptos guardados por nombre o descripción, filtrando por organización y cliente
    // Agrupamos por campos de negocio para no traer duplicados si el mismo concepto está en varias facturas
    let conceptosQuery = `
      SELECT
        MAX(c.Id) as Id,
        c.Nombre,
        c.Descripcion,
        c.ClaveProdServ,
        c.UnidadMedida,
        c.Cantidad,
        c.PrecioUnitario,
        c.Subtotal,
        c.MonedaProducto,
        c.ObjetoImpuesto,
        c.TotalImpuestos,
        c.Total
      FROM ConceptosFactura c
      INNER JOIN Facturas f ON c.FacturaId = f.Id
      INNER JOIN Clientes cl ON f.ClienteId = cl.Id
      WHERE cl.OrganizacionId = ?
        AND (c.Nombre ILIKE ? OR c.Descripcion ILIKE ? OR c.ClaveProdServ ILIKE ?)
    `;

    const queryParams: any[] = [
      organizacionId,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      `%${searchTerm}%`
    ];

    // Si se proporciona clienteId, filtrar también por cliente
    if (clienteId) {
      conceptosQuery += ` AND f.ClienteId = ? `;
      queryParams.push(clienteId);
    }

    conceptosQuery += ` GROUP BY c.Nombre, c.Descripcion, c.ClaveProdServ, c.UnidadMedida, c.Cantidad, c.PrecioUnitario, c.Subtotal, c.MonedaProducto, c.ObjetoImpuesto, c.TotalImpuestos, c.Total `;
    conceptosQuery += ` ORDER BY c.Nombre ASC LIMIT ? `;
    queryParams.push(limit);

    const conceptos = await db.query(conceptosQuery, queryParams);

    // Para cada concepto, obtener sus impuestos
    const conceptosConImpuestos = await Promise.all(
      conceptos.map(async (concepto: any) => {
        const impuestosQuery = `
          SELECT DISTINCT
            Tipo,
            Tasa,
            Monto
          FROM ImpuestosConcepto
          WHERE ConceptoId = ?
        `;
        const impuestos = await db.query(impuestosQuery, [concepto.Id]);

        return {
          id: concepto.Id,
          nombre: concepto.Nombre,
          descripcion: concepto.Descripcion,
          claveProdServ: concepto.ClaveProdServ,
          unidadMedida: concepto.UnidadMedida,
          cantidad: parseFloat(concepto.Cantidad) || 0,
          precioUnitario: parseFloat(concepto.PrecioUnitario) || 0,
          subtotal: parseFloat(concepto.Subtotal) || 0,
          monedaProducto: concepto.MonedaProducto,
          objetoImpuesto: concepto.ObjetoImpuesto,
          totalImpuestos: parseFloat(concepto.TotalImpuestos) || 0,
          total: parseFloat(concepto.Total) || 0,
          impuestos: impuestos.map((imp: any) => ({
            tipo: imp.Tipo,
            tasa: parseFloat(imp.Tasa) || 0,
            monto: parseFloat(imp.Monto) || 0
          }))
        };
      })
    );

    return json({
      success: true,
      conceptos: conceptosConImpuestos
    });

  } catch (error) {
    return json({
      success: false,
      error: 'Error al buscar conceptos: ' + (error as Error).message
    }, { status: 500 });
  }
};
