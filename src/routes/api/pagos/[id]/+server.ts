import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  try {
    const pagoId = event.params.id;
    const organizacionId = event.url.searchParams.get('organizacionId');

    if (!pagoId || !organizacionId) {
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

    const result = await pool.query(
      `SELECT
        p.id,
        p.facturaid as "facturaId",
        p.usuarioid as "usuarioId",
        p.monto,
        p.fechapago as "fechaPago",
        p.metodo,
        COALESCE(p.cancelado, false) as cancelado,
        p.fechacancelacion as "fechaCancelacion",
        p.motivocancelacion as "motivoCancelacion",
        p.createdat as "createdAt",
        p.updatedat as "updatedAt",
        CASE WHEN p.comprobantebase64 IS NOT NULL THEN true ELSE false END as "tieneComprobante",
        CASE WHEN p.tokencomprobante IS NOT NULL AND p.comprobantebase64 IS NULL THEN true ELSE false END as "tieneTokenPendiente",
        f.numero_factura,
        f.montototal as "montoFactura",
        f.saldopendiente as "saldoPendiente",
        f.fechaemision as "fechaEmision",
        f.fechavencimiento as "fechaVencimiento",
        cl.id as "clienteId",
        cl.razonsocial as "razonSocial",
        cl.rfc,
        cl.correoprincipal as correo,
        cl.telefono,
        u.nombre as "usuarioNombre",
        u.apellido as "usuarioApellido",
        u.correo as "usuarioCorreo"
      FROM pagos p
      INNER JOIN facturas f ON p.facturaid = f.id
      INNER JOIN clientes cl ON f.clienteid = cl.id
      LEFT JOIN usuarios u ON p.usuarioid = u.id
      WHERE p.id = $1 AND cl.organizacionid = $2`,
      [parseInt(pagoId), organizacionId]
    );

    if (result.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pago no encontrado'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const row = result.rows[0];
    const pago = {
      id: row.id,
      facturaId: row.facturaId,
      usuarioId: row.usuarioId,
      monto: row.monto,
      fechaPago: row.fechaPago,
      metodo: row.metodo,
      cancelado: row.cancelado === true || row.cancelado === 'true',
      fechaCancelacion: row.fechaCancelacion || null,
      motivoCancelacion: row.motivoCancelacion || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      tieneComprobante: row.tieneComprobante,
      tieneTokenPendiente: row.tieneTokenPendiente,
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
        message: 'Error al obtener pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const organizacionId = event.url.searchParams.get('organizacionId');
    if (!organizacionId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'El parámetro organizacionId es requerido.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar acceso a la organización
    const auth = await validateOrganizationAccess(event, organizacionId);
    if (!auth.valid) return auth.error!;

    const body = await event.request.json();
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
    const facturaCheck = await pool.query(
      `SELECT f.id, f.saldopendiente as "saldoPendiente"
       FROM facturas f
       INNER JOIN clientes c ON f.clienteid = c.id
       WHERE f.id = $1 AND c.organizacionid = $2`,
      [facturaId, organizacionId]
    );

    if (facturaCheck.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Factura no encontrada o no pertenece a la organización.'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const saldoPendienteActual = parseFloat(facturaCheck.rows[0].saldoPendiente);
    const nuevoSaldoPendiente = saldoPendienteActual - parseFloat(monto);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar el pago
      const insertResult = await client.query(
        `INSERT INTO pagos (facturaid, usuarioid, monto, fechapago, metodo, createdat, updatedat)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [facturaId, usuarioId, monto, fechaPago, metodo]
      );

      const pagoId = insertResult.rows[0].id;

      // Actualizar el saldo pendiente de la factura
      await client.query(
        `UPDATE facturas
         SET saldopendiente = $1
         WHERE id = $2`,
        [Math.max(0, nuevoSaldoPendiente), facturaId]
      );

      await client.query('COMMIT');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pago registrado correctamente',
          pagoId,
          nuevoSaldoPendiente: Math.max(0, nuevoSaldoPendiente)
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error al registrar pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error al registrar pago'
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
    const checkResult = await pool.query(
      `SELECT p.id
       FROM pagos p
       INNER JOIN facturas f ON p.facturaid = f.id
       INNER JOIN clientes cl ON f.clienteid = cl.id
       WHERE p.id = $1 AND cl.organizacionid = $2`,
      [parseInt(pagoId), organizacionId]
    );

    if (checkResult.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pago no encontrado o no tienes permiso para actualizarlo'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updateFields: string[] = [];
    const params_arr: any[] = [];
    let paramIdx = 1;

    if (body.monto !== undefined) {
      updateFields.push(`monto = $${paramIdx++}`);
      params_arr.push(body.monto);
    }
    if (body.fechaPago !== undefined) {
      updateFields.push(`fechapago = $${paramIdx++}`);
      params_arr.push(body.fechaPago);
    }
    if (body.metodo !== undefined) {
      updateFields.push(`metodo = $${paramIdx++}`);
      params_arr.push(body.metodo);
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

    updateFields.push(`updatedat = NOW()`);
    params_arr.push(parseInt(pagoId));

    await pool.query(
      `UPDATE pagos
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIdx}`,
      params_arr
    );

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
        message: 'Error al actualizar pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: RequestHandler = async () => {
  // Los pagos no se eliminan, se cancelan para mantener trazabilidad fiscal
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Los pagos no se pueden eliminar. Utiliza el endpoint /api/pagos/[id]/cancelar para cancelar un pago.'
    }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
};
