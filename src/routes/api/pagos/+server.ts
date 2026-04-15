import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  try {
    const organizacionId = event.url.searchParams.get('organizacionId');
    const page = parseInt(event.url.searchParams.get('page') || '1');
    const limit = parseInt(event.url.searchParams.get('limit') || '10');
    const cliente = event.url.searchParams.get('cliente') || '';
    const ordenCampo = event.url.searchParams.get('ordenCampo') || 'fechapago';
    const ordenDireccion = event.url.searchParams.get('ordenDireccion') || 'DESC';

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
    const offset = (page - 1) * limit;

    // Validar campo de orden para prevenir SQL injection
    const allowedOrderFields: Record<string, string> = {
      'fechaPago': 'p.fechapago',
      'fechapago': 'p.fechapago',
      'monto': 'p.monto',
      'createdAt': 'p.createdat',
      'createdat': 'p.createdat'
    };
    const orderField = allowedOrderFields[ordenCampo] || 'p.fechapago';
    const orderDir = ordenDireccion.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Construir WHERE clause con filtro obligatorio de organización
    const params: any[] = [organizacionId];
    let paramIndex = 2;
    let whereClause = 'WHERE cl.organizacionid = $1';
    if (cliente) {
      whereClause += `
        AND (
          cl.razonsocial ILIKE $${paramIndex} OR
          f.numero_factura ILIKE $${paramIndex} OR
          CAST(p.id AS TEXT) ILIKE $${paramIndex}
        )
      `;
      params.push(`%${cliente}%`);
      paramIndex++;
    }

    // Query principal con JOINs
    const query = `
      SELECT
        p.id,
        p.facturaid as "facturaId",
        p.usuarioid as "usuarioId",
        p.monto,
        p.fechapago as "fechaPago",
        p.metodo,
        COALESCE(p.cancelado, false) as cancelado,
        p.createdat as "createdAt",
        p.updatedat as "updatedAt",
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
      ${whereClause}
      ORDER BY COALESCE(p.cancelado, false) ASC, ${orderField} ${orderDir}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    // Query para contar total de registros
    const countParams: any[] = [organizacionId];
    let countWhereClause = 'WHERE cl.organizacionid = $1';
    if (cliente) {
      countWhereClause += `
        AND (
          cl.razonsocial ILIKE $2 OR
          f.numero_factura ILIKE $2 OR
          CAST(p.id AS TEXT) ILIKE $2
        )
      `;
      countParams.push(`%${cliente}%`);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM pagos p
      INNER JOIN facturas f ON p.facturaid = f.id
      INNER JOIN clientes cl ON f.clienteid = cl.id
      ${countWhereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    const pagos = dataResult.rows.map((row: any) => ({
      id: row.id,
      facturaId: row.facturaId,
      usuarioId: row.usuarioId,
      monto: parseFloat(row.monto) || 0,
      fechaPago: row.fechaPago,
      metodo: row.metodo,
      cancelado: row.cancelado === true || row.cancelado === 'true',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      factura: {
        id: row.facturaId,
        numero_factura: row.numero_factura,
        montoTotal: parseFloat(row.montoFactura) || 0,
        saldoPendiente: parseFloat(row.saldoPendiente) || 0,
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

    const total = parseInt(countResult.rows[0].total);
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
        message: 'Error al cargar pagos'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const body = await event.request.json();
    const organizacionId = event.url.searchParams.get('organizacionId');

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
    const facturaCheck = await pool.query(
      `SELECT f.id
       FROM facturas f
       INNER JOIN clientes cl ON f.clienteid = cl.id
       WHERE f.id = $1 AND cl.organizacionid = $2`,
      [body.facturaId, organizacionId]
    );

    if (facturaCheck.rows.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'La factura no existe o no pertenece a tu organización'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await pool.query(
      `INSERT INTO pagos (facturaid, usuarioid, monto, fechapago, metodo, createdat, updatedat)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [body.facturaId, body.usuarioId, body.monto, body.fechaPago, body.metodo]
    );

    return new Response(
      JSON.stringify({
        success: true,
        id: result.rows[0].id,
        message: 'Pago creado correctamente'
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating pago:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error al crear pago'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
