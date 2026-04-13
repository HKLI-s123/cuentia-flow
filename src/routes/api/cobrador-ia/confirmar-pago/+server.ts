import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { validarAccesoFuncion } from '$lib/server/validar-plan';
import { hoyLocal } from '$lib/utils/date';

/**
 * POST /api/cobrador-ia/confirmar-pago
 * Confirma un pago recibido vía comprobante del cliente.
 * Registra el pago en la tabla Pagos y marca la gestión como confirmada.
 * Si la org tiene API Key de Facturapi, llama al endpoint de timbrado.
 */
export const POST: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  // Resolver organizacionId del usuario autenticado
  let organizacionId = event.url.searchParams.get('organizacionId');

  if (event.locals.user) {
    const pool = await getConnection();
    const usuarioOrgs = await pool.query(
			'SELECT uo.organizacionid FROM Usuario_Organizacion uo WHERE uo.usuarioid = $1',
			[event.locals.user.id]
		);

    if (usuarioOrgs.rows.length > 0) {
      let userOrgId = usuarioOrgs.rows[0].organizacionid;
      if (organizacionId && usuarioOrgs.rows.length > 1) {
        const parsedOrgId = parseInt(organizacionId);
        const orgEncontrada = usuarioOrgs.rows.find((org: any) => org.organizacionid === parsedOrgId);
        if (orgEncontrada) userOrgId = parsedOrgId;
      }
      organizacionId = userOrgId.toString();
    }
  }

  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar acceso Cobrador IA según plan
  const accesoIA = await validarAccesoFuncion(parseInt(organizacionId), 'agenteIA');
  if (!accesoIA.permitido) {
    return json({ success: false, error: accesoIA.mensaje }, { status: 403 });
  }

  try {
    const body = await event.request.json();
    const { facturaId, monto, metodoPago, fechaPago } = body;

    if (!facturaId || !monto || monto <= 0) {
      return json({
        success: false,
        error: 'Se requiere facturaId y monto > 0'
      }, { status: 400 });
    }

    const pool = await getConnection();

    // Verificar que la factura pertenece a la organización y tiene agente IA activo
    const facturaResult = await pool.query(
			`
        SELECT
          f.id, f.numero_factura, f.saldopendiente, f.montototal,
          f.uuidfacturapi, f.estado_factura_id,
          cl.id as ClienteId, cl.razonsocial, cl.rfc,
          cl.idclientefacturaapi
        FROM Facturas f
        INNER JOIN Clientes cl ON f.clienteid = cl.id
        WHERE f.id = $1 AND cl.organizacionid = $2
      `,
			[facturaId, parseInt(String(organizacionId))]
		);

    if (!facturaResult.rows.length) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = facturaResult.rows[0];

    if (factura.estado_factura_id === 6) {
      return json({ success: false, error: 'La factura está cancelada' }, { status: 400 });
    }

    if (factura.estado_factura_id === 3) {
      return json({ success: false, error: 'La factura ya está pagada' }, { status: 400 });
    }

    const saldo = parseFloat(factura.saldopendiente);
    const montoPago = parseFloat(monto);

    if (montoPago > saldo + 0.01) {
      return json({
        success: false,
        error: `El monto (${montoPago}) excede el saldo pendiente (${saldo})`
      }, { status: 400 });
    }

    const metodo = metodoPago || '03'; // 03 = Transferencia electrónica
    const fecha = fechaPago || hoyLocal();

    // Insertar pago
    const insertResult = await pool.query(
			`
        INSERT INTO Pagos (FacturaId, UsuarioId, Monto, FechaPago, Metodo, CreatedAt, UpdatedAt)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
				RETURNING id as id
      `,
			[facturaId, user.id, montoPago, fecha, metodo]
		);

    const pagoId = insertResult.rows[0]?.id;

    // Actualizar saldo
    const nuevoSaldo = Math.max(saldo - montoPago, 0);
    await pool.query(
			`
        UPDATE Facturas
        SET SaldoPendiente = $2,
            estado_factura_id = CASE WHEN $2::numeric <= 0 THEN 3 ELSE estado_factura_id END
        WHERE Id = $1
      `,
			[facturaId, nuevoSaldo]
		);

    // Marcar gestiones con comprobante como confirmadas
    await pool.query(
			`
        UPDATE GestionesCobranza
        SET PagoConfirmado = true
        WHERE FacturaId = $1
          AND COALESCE(ComprobantePagoRecibido, false) = true
          AND COALESCE(PagoConfirmado, false) = false
      `,
			[facturaId]
		);

    // Registrar gestión de confirmación
    await pool.query(
			`
        INSERT INTO GestionesCobranza (FacturaId, UsuarioId, TipoGestion, Resultado, Descripcion, FechaGestion)
        VALUES ($1, $2, 'whatsapp', 'confirma_pago', $3, NOW())
      `,
			[facturaId, user.id, `PAGO_CONFIRMADO: Pago de $${montoPago.toFixed(2)} confirmado manualmente por usuario. Método: ${metodo}`]
		);

    return json({
      success: true,
      message: 'Pago confirmado exitosamente',
      pagoId,
      nuevoSaldo,
      facturaEstado: nuevoSaldo <= 0 ? 'pagada' : 'pendiente'
    }, { status: 201 });

  } catch (error: any) {
    console.error('[COBRADOR-IA] Error confirmar-pago:', error);
    return json({
      success: false,
      error: 'Error al confirmar el pago'
    }, { status: 500 });
  }
};
