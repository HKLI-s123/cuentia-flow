import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const pagoId = params.id;
    const organizacionId = url.searchParams.get('organizacionId');

    if (!pagoId || !organizacionId) {
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
      .input('id', parseInt(pagoId))
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

export const POST: RequestHandler = async ({ request, url }) => {
  try {
    const organizacionId = url.searchParams.get('organizacionId');
    if (!organizacionId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'El parámetro organizacionId es requerido.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { facturaId, usuarioId, monto, fechaPago, metodo } = body;

    if (!facturaId || !usuarioId || !monto || !fechaPago || !metodo) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Todos los campos son requeridos: facturaId, usuarioId, monto, fechaPago, metodo.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pool = await getConnection();

    // Verificar que la factura pertenezca a la organización
    const facturaCheck = await pool.request()
      .input('facturaId', facturaId)
      .input('organizacionId', organizacionId)
      .query(`
        SELECT f.Id, f.SaldoPendiente
        FROM Facturas f
        INNER JOIN Clientes c ON f.ClienteId = c.Id
        WHERE f.Id = @facturaId AND c.OrganizacionId = @organizacionId
      `);

    if (facturaCheck.recordset.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Factura no encontrada o no pertenece a la organización.'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const saldoPendienteActual = parseFloat(facturaCheck.recordset[0].SaldoPendiente);
    const nuevoSaldoPendiente = saldoPendienteActual - parseFloat(monto);

    // Insertar el pago
    const insertResult = await pool.request()
      .input('facturaId', facturaId)
      .input('usuarioId', usuarioId)
      .input('monto', monto)
      .input('fechaPago', fechaPago)
      .input('metodo', metodo)
      .query(`
        INSERT INTO Pagos (FacturaId, UsuarioId, Monto, FechaPago, Metodo, CreatedAt, UpdatedAt)
        OUTPUT INSERTED.Id
        VALUES (@facturaId, @usuarioId, @monto, @fechaPago, @metodo, GETDATE(), GETDATE())
      `);

    const pagoId = insertResult.recordset[0].Id;

    // Actualizar el saldo pendiente de la factura
    await pool.request()
      .input('facturaId', facturaId)
      .input('nuevoSaldo', Math.max(0, nuevoSaldoPendiente))
      .query(`
        UPDATE Facturas
        SET SaldoPendiente = @nuevoSaldo
        WHERE Id = @facturaId
      `);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pago registrado correctamente',
        pagoId,
        nuevoSaldoPendiente: Math.max(0, nuevoSaldoPendiente)
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error al registrar pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al registrar pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const PUT: RequestHandler = async ({ params, request: req, url }) => {
  try {
    const body = await req.json();
    const pagoId = params.id;
    const organizacionId = url.searchParams.get('organizacionId');

    if (!pagoId || !organizacionId) {
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
      .input('id', parseInt(pagoId))
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
      .input('id', parseInt(pagoId));

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
    const pagoId = params.id;
    const organizacionId = url.searchParams.get('organizacionId');

    if (!pagoId || !organizacionId) {
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
      .input('id', parseInt(pagoId))
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
      .input('id', parseInt(pagoId))
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
