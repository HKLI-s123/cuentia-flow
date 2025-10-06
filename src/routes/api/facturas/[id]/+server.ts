import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const { id } = params;
    const organizacionId = url.searchParams.get('organizacionId');

    if (!organizacionId) {
      return json({
        success: false,
        error: 'organizacionId es requerido'
      }, { status: 400 });
    }

    const pool = await getConnection();

    // Query para obtener la factura individual con saldo y días vencido calculados dinámicamente
    const facturaQuery = `
      SELECT
        f.Id,
        f.ClienteId,
        f.numero_factura,
        f.MontoTotal,
        ISNULL(f.MontoTotal - ISNULL(pagos.TotalPagado, 0), f.MontoTotal) as SaldoPendiente,
        f.FechaEmision,
        f.FechaVencimiento,
        DATEDIFF(day, CAST(GETDATE() AS DATE), CAST(f.FechaVencimiento AS DATE)) as DiasVencido,
        f.estado_factura_id,
        f.prioridad_cobranza_id,
        f.MetodoPago,
        f.FormaPago,
        f.UsuarioCreadorId,
        f.UltimaGestion,
        f.CreatedAt,
        c.RazonSocial as ClienteRazonSocial,
        c.RFC as ClienteRFC,
        c.NombreComercial as ClienteNombreComercial,
        c.CorreoPrincipal as ClienteCorreo,
        c.Telefono as ClienteTelefono,
        c.CodigoPostal as ClienteCodigoPostal,
        ef.codigo as EstadoCodigo,
        pc.codigo as PrioridadCodigo,
        u.Correo as UsuarioCreadorCorreo,
        u.Nombre as UsuarioCreadorNombre,
        u.Apellido as UsuarioCreadorApellido
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
      LEFT JOIN prioridades_cobranza pc ON f.prioridad_cobranza_id = pc.id
      LEFT JOIN Usuarios u ON f.UsuarioCreadorId = u.Id
      LEFT JOIN (
        SELECT FacturaId, SUM(Monto) as TotalPagado
        FROM Pagos
        GROUP BY FacturaId
      ) pagos ON f.Id = pagos.FacturaId
      WHERE f.Id = @FacturaId AND c.OrganizacionId = @OrganizacionId
    `;

    const result = await pool.request()
      .input('FacturaId', sql.Int, parseInt(id))
      .input('OrganizacionId', sql.Int, parseInt(organizacionId))
      .query(facturaQuery);

    if (!result || !result.recordset || result.recordset.length === 0) {
      return json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 });
    }

    const row = result.recordset[0];

    // Obtener conceptos de la factura
    const conceptosQuery = `
      SELECT
        Id,
        Nombre,
        Descripcion,
        ClaveProdServ,
        UnidadMedida,
        Cantidad,
        PrecioUnitario,
        Subtotal,
        MonedaProducto,
        ObjetoImpuesto,
        TotalImpuestos,
        Total
      FROM ConceptosFactura
      WHERE FacturaId = @FacturaId
      ORDER BY Id
    `;

    const conceptosResult = await pool.request()
      .input('FacturaId', sql.Int, parseInt(id))
      .query(conceptosQuery);

    // Para cada concepto, obtener sus impuestos
    const conceptos = await Promise.all(
      conceptosResult.recordset.map(async (concepto: any) => {
        const impuestosQuery = `
          SELECT Tipo, Tasa, Monto
          FROM ImpuestosConcepto
          WHERE ConceptoId = @ConceptoId
        `;
        const impuestosResult = await pool.request()
          .input('ConceptoId', sql.Int, concepto.Id)
          .query(impuestosQuery);
        const impuestos = impuestosResult.recordset;

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

    const factura = {
      id: row.Id,
      clienteId: row.ClienteId,
      numero_factura: row.numero_factura,
      montoTotal: parseFloat(row.MontoTotal) || 0,
      saldoPendiente: parseFloat(row.SaldoPendiente) || 0,
      fechaEmision: row.FechaEmision,
      fechaVencimiento: row.FechaVencimiento,
      diasVencido: row.DiasVencido || 0,
      estado_factura_id: row.estado_factura_id,
      prioridad_cobranza_id: row.prioridad_cobranza_id,
      metodoPago: row.MetodoPago,
      formaPago: row.FormaPago,
      usuarioCreadorId: row.UsuarioCreadorId,
      usuarioCreadorCorreo: row.UsuarioCreadorCorreo,
      usuarioCreadorNombre: row.UsuarioCreadorNombre,
      usuarioCreadorApellido: row.UsuarioCreadorApellido,
      ultimaGestion: row.UltimaGestion,
      createdAt: row.CreatedAt,
      cliente: {
        id: row.ClienteId,
        razonSocial: row.ClienteRazonSocial,
        rfc: row.ClienteRFC,
        nombreComercial: row.ClienteNombreComercial,
        correo: row.ClienteCorreo,
        telefono: row.ClienteTelefono,
        codigoPostal: row.ClienteCodigoPostal
      },
      estado: {
        id: row.estado_factura_id,
        codigo: row.EstadoCodigo
      },
      prioridad: {
        id: row.prioridad_cobranza_id,
        codigo: row.PrioridadCodigo
      },
      conceptos
    };

    return json({
      success: true,
      factura
    });

  } catch (error) {
    return json({
      success: false,
      error: 'Error al obtener factura: ' + (error as Error).message
    }, { status: 500 });
  }
};
