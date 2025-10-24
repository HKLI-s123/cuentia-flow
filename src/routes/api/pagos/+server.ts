import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const organizacionId = url.searchParams.get('organizacionId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const cliente = url.searchParams.get('cliente') || '';
    const ordenCampo = url.searchParams.get('ordenCampo') || 'fechaPago';
    const ordenDireccion = url.searchParams.get('ordenDireccion') || 'DESC';

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
    const offset = (page - 1) * limit;

    // Construir WHERE clause con filtro obligatorio de organización
    let whereClause = 'WHERE cl.OrganizacionId = @organizacionId';
    if (cliente) {
      whereClause += `
        AND (
          cl.RazonSocial LIKE @cliente OR
          f.numero_factura LIKE @cliente OR
          CAST(p.Id AS VARCHAR) LIKE @cliente
        )
      `;
    }

    // Query principal con JOINs
    const query = `
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
      ${whereClause}
      ORDER BY p.${ordenCampo} ${ordenDireccion}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    // Query para contar total de registros
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Pagos p
      INNER JOIN Facturas f ON p.FacturaId = f.Id
      INNER JOIN Clientes cl ON f.ClienteId = cl.Id
      ${whereClause}
    `;

    const request = pool.request()
      .input('organizacionId', organizacionId);

    if (cliente) {
      request.input('cliente', `%${cliente}%`);
    }

    request.input('offset', offset);
    request.input('limit', limit);

    const dataResult = await request.query(query);

    // Para contar, crear nuevo request
    const countRequest = pool.request()
      .input('organizacionId', organizacionId);

    if (cliente) {
      countRequest.input('cliente', `%${cliente}%`);
    }

    const countResult = await countRequest.query(countQuery);

    const pagos = dataResult.recordset.map((row: any) => ({
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
    }));

    const total = countResult.recordset[0].total;
    const totalPages = Math.ceil(total / limit);

    return new Response(
      JSON.stringify({
        success: true,
        pagos,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching pagos:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al cargar pagos'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: RequestHandler = async ({ request: req, url }) => {
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

    if (!body.facturaId || !body.usuarioId || !body.monto || !body.fechaPago || !body.metodo) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Faltan campos requeridos'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pool = await getConnection();

    // Verificar que la factura pertenezca a la organización del usuario
    const facturaCheck = await pool.request()
      .input('facturaId', body.facturaId)
      .input('organizacionId', organizacionId)
      .query(`
        SELECT f.Id
        FROM Facturas f
        INNER JOIN Clientes cl ON f.ClienteId = cl.Id
        WHERE f.Id = @facturaId AND cl.OrganizacionId = @organizacionId
      `);

    if (facturaCheck.recordset.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'La factura no existe o no pertenece a tu organización'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await pool.request()
      .input('facturaId', body.facturaId)
      .input('usuarioId', body.usuarioId)
      .input('monto', body.monto)
      .input('fechaPago', body.fechaPago)
      .input('metodo', body.metodo)
      .query(`
        INSERT INTO Pagos (FacturaId, UsuarioId, Monto, FechaPago, Metodo, CreatedAt, UpdatedAt)
        VALUES (@facturaId, @usuarioId, @monto, @fechaPago, @metodo, GETDATE(), GETDATE())
        SELECT SCOPE_IDENTITY() as id
      `);

    return new Response(
      JSON.stringify({
        success: true,
        id: result.recordset[0].id,
        message: 'Pago creado correctamente'
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Error al crear pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
