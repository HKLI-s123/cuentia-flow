import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const organizacionId = url.searchParams.get('organizacionId');

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

    const result = await pool.request()
      .input('id', parseInt(params.id))
      .input('organizacionId', organizacionId)
      .query(`
        SELECT
          p.Id as id,
          p.FacturaId as facturaId,
          p.UsuarioId as usuarioId,
          p.Monto as monto,
          p.FechaPago as fechaPago,
          p.Metodo as metodo,
          p.CreatedAt as createdAt,
          p.UpdatedAt as updatedAt,
          f.numero_factura as numero_factura,
          f.MontoTotal as montoFactura,
          f.SaldoPendiente as saldoPendiente,
          f.FechaEmision as fechaEmision,
          f.FechaVencimiento as fechaVencimiento,
          cl.Id as clienteId,
          cl.RazonSocial as razonSocial,
          cl.RFC as rfc,
          cl.CorreoPrincipal as correo,
          cl.Telefono as telefono,
          u.Nombre as usuarioNombre,
          u.Apellido as usuarioApellido,
          u.Correo as usuarioCorreo
        FROM Pagos p
        INNER JOIN Facturas f ON p.FacturaId = f.Id
        INNER JOIN Clientes cl ON f.ClienteId = cl.Id
        LEFT JOIN Usuarios u ON p.UsuarioId = u.Id
        WHERE p.Id = @id AND cl.OrganizacionId = @organizacionId
      `);

    if (result.recordset.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pago no encontrado'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const row = result.recordset[0];
    const pago = {
      id: row.id,
      facturaId: row.facturaId,
      usuarioId: row.usuarioId,
      monto: row.monto,
      fechaPago: row.fechaPago,
      metodo: row.metodo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      factura: {
        id: row.facturaId,
        numero_factura: row.numero_factura,
        montoTotal: row.montoFactura,
        saldoPendiente: row.saldoPendiente,
        fechaEmision: row.fechaEmision,
        fechaVencimiento: row.fechaVencimiento,
        cliente: {
          id: row.clienteId,
          razonSocial: row.razonSocial,
          rfc: row.rfc,
          correo: row.correo,
          telefono: row.telefono
        }
      },
      usuario: {
        id: row.usuarioId,
        nombre: row.usuarioNombre,
        apellido: row.usuarioApellido,
        correo: row.usuarioCorreo
      }
    };

    return new Response(
      JSON.stringify({
        success: true,
        pago
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al obtener pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: RequestHandler = async ({ params, request: req, url }) => {
  try {
    const body = await req.json();
    const organizacionId = url.searchParams.get('organizacionId');

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

    // Verificar que el pago existe y pertenece a la organización
    const checkResult = await pool.request()
      .input('id', parseInt(params.id))
      .input('organizacionId', organizacionId)
      .query(`
        SELECT p.Id
        FROM Pagos p
        INNER JOIN Facturas f ON p.FacturaId = f.Id
        INNER JOIN Clientes cl ON f.ClienteId = cl.Id
        WHERE p.Id = @id AND cl.OrganizacionId = @organizacionId
      `);

    if (checkResult.recordset.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pago no encontrado o no tienes permiso para actualizarlo'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const request = pool.request()
      .input('id', parseInt(params.id));

    let updateFields = [];
    if (body.monto !== undefined) {
      updateFields.push('Monto = @monto');
      request.input('monto', body.monto);
    }
    if (body.fechaPago !== undefined) {
      updateFields.push('FechaPago = @fechaPago');
      request.input('fechaPago', body.fechaPago);
    }
    if (body.metodo !== undefined) {
      updateFields.push('Metodo = @metodo');
      request.input('metodo', body.metodo);
    }

    if (updateFields.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No hay campos para actualizar'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    updateFields.push('UpdatedAt = GETDATE()');

    const result = await request.query(`
      UPDATE Pagos
      SET ${updateFields.join(', ')}
      WHERE Id = @id
    `);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pago actualizado correctamente'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error updating pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al actualizar pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: RequestHandler = async ({ params, url }) => {
  try {
    const organizacionId = url.searchParams.get('organizacionId');

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

    // Verificar que el pago existe y pertenece a la organización
    const checkResult = await pool.request()
      .input('id', parseInt(params.id))
      .input('organizacionId', organizacionId)
      .query(`
        SELECT p.Id
        FROM Pagos p
        INNER JOIN Facturas f ON p.FacturaId = f.Id
        INNER JOIN Clientes cl ON f.ClienteId = cl.Id
        WHERE p.Id = @id AND cl.OrganizacionId = @organizacionId
      `);

    if (checkResult.recordset.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pago no encontrado o no tienes permiso para eliminarlo'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await pool.request()
      .input('id', parseInt(params.id))
      .query('DELETE FROM Pagos WHERE Id = @id');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pago eliminado correctamente'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al eliminar pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
