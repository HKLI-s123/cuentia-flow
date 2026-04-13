import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

/**
 * Resuelve organizacionId del usuario autenticado (mismo patrón que /api/clientes)
 */
async function resolverOrganizacionId(locals: any, url: URL): Promise<string | null> {
  let organizacionId = url.searchParams.get('organizacionId');

  if (locals.user) {
    const pool = await getConnection();
    const usuarioOrgs = await pool.query(
			'SELECT uo.organizacionid FROM Usuario_Organizacion uo WHERE uo.usuarioid = $1',
			[locals.user.id]
		);

    if (usuarioOrgs.rows.length > 0) {
      let userOrgId = usuarioOrgs.rows[0].organizacionid;

      if (organizacionId && usuarioOrgs.rows.length > 1) {
        const parsedOrgId = parseInt(organizacionId);
        const orgEncontrada = usuarioOrgs.rows.find(
          (org: any) => org.organizacionid === parsedOrgId
        );
        if (orgEncontrada) {
          userOrgId = parsedOrgId;
        }
      }
      organizacionId = userOrgId.toString();
    }
  }

  return organizacionId;
}

/**
 * GET /api/cobrador-ia
 * Obtiene el reporte del Cobrador IA: clientes con cobranza activa,
 * su status de contacto, promesas de pago, atención humana, etc.
 */
export const GET: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const organizacionId = await resolverOrganizacionId(event.locals, event.url);

  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar que el plan permita Cobrador IA
  const accesoIA = await validarAccesoFuncion(parseInt(String(organizacionId)), 'agenteIA');
  if (!accesoIA.permitido) {
    return json({ success: false, error: accesoIA.mensaje, requierePlan: true }, { status: 403 });
  }

  try {
    const pool = await getConnection();

    // Query principal: clientes con facturas donde AgenteIAActivo = 1
    // Agrupa por cliente y trae el resumen de cobranza IA
    const result = await pool.query(
			`
        WITH UltimaGestion AS (
          SELECT
            gc.facturaid,
            gc.resultado,
            gc.descripcion,
            gc.fechagestion,
            gc.fechaproximagestion,
            COALESCE(gc.comprobantepagorecibido, false) as ComprobantePagoRecibido,
            COALESCE(gc.pagoconfirmado, false) as PagoConfirmado,
            ROW_NUMBER() OVER (PARTITION BY gc.facturaid ORDER BY gc.fechagestion DESC) as rn
          FROM GestionesCobranza gc
        ),
        UltimaPromesa AS (
          SELECT
            gc.facturaid,
            gc.promesapagofecha,
            gc.promesapagomonto,
            ROW_NUMBER() OVER (PARTITION BY gc.facturaid ORDER BY gc.fechagestion DESC) as rn
          FROM GestionesCobranza gc
          WHERE gc.promesapagofecha IS NOT NULL
        ),
        GestionHoy AS (
          SELECT
            gc.facturaid,
            COUNT(*) as mensajesHoy
          FROM GestionesCobranza gc
          WHERE gc.fechagestion::date = CURRENT_DATE
          GROUP BY gc.facturaid
        ),
        RequiereHumano AS (
          SELECT
            gc.facturaid,
            1 as requiereAtencionHumana,
            gc.motivoescalamiento as motivoEscalamiento,
            gc.resultado as resultadoEscalamiento,
            gc.fechagestion as fechaEscalamiento,
            ROW_NUMBER() OVER (PARTITION BY gc.facturaid ORDER BY gc.fechagestion DESC) as rn
          FROM GestionesCobranza gc
          WHERE COALESCE(gc.requiereseguimiento, false) = true
            AND gc.fechagestion >= NOW() - INTERVAL '7 days'
        ),
        ComprobanteRecibido AS (
          SELECT
            gc.facturaid,
            MAX(CASE WHEN COALESCE(gc.comprobantepagorecibido, false) = true AND COALESCE(gc.pagoconfirmado, false) = false THEN 1 ELSE 0 END) as pendienteConfirmacion,
            MAX(gc.promesapagomonto) as montoComprobante
          FROM GestionesCobranza gc
          WHERE COALESCE(gc.comprobantepagorecibido, false) = true
          GROUP BY gc.facturaid
        )
        SELECT
          cl.id as clienteId,
          cl.razonsocial as clienteNombre,
          cl.rfc as clienteRFC,
          cl.telefonowhatsapp as clienteTelefono,
          COALESCE(cl.autocomplementopago, false) as autoComplementoPago,
          f.id as facturaId,
          f.numero_factura as numeroFactura,
          f.montototal as montoTotal,
          f.saldopendiente as saldoPendiente,
          f.fechaemision as fechaEmision,
          f.fechavencimiento as fechaVencimiento,
          (NOW()::date - f.fechavencimiento::date) as diasVencido,
          COALESCE(f.agenteiaactivo, false) as agenteIAActivo,
          ug.resultado as ultimoResultado,
          ug.fechagestion as ultimaGestion,
          ug.fechaproximagestion as proximaGestion,
          up.promesapagofecha as promesaPagoFecha,
          up.promesapagomonto as promesaPagoMonto,
          ug.comprobantepagorecibido as comprobanteRecibido,
          ug.pagoconfirmado as pagoConfirmado,
          COALESCE(gh.mensajesHoy, 0) as mensajesHoy,
          COALESCE(rh.requiereAtencionHumana, 0) as requiereAtencionHumana,
          rh.motivoEscalamiento as motivoEscalamiento,
          rh.resultadoEscalamiento as resultadoEscalamiento,
          rh.fechaEscalamiento as fechaEscalamiento,
          COALESCE(cr.pendienteConfirmacion, 0) as pendienteConfirmacion,
          cr.montoComprobante as montoComprobante,
          ef.codigo as estadoFactura
        FROM Facturas f
        INNER JOIN Clientes cl ON f.clienteid = cl.id
        LEFT JOIN estados_factura ef ON f.estado_factura_id = ef.id
        LEFT JOIN UltimaGestion ug ON ug.facturaid = f.id AND ug.rn = 1
        LEFT JOIN UltimaPromesa up ON up.facturaid = f.id AND up.rn = 1
        LEFT JOIN GestionHoy gh ON gh.facturaid = f.id
        LEFT JOIN RequiereHumano rh ON rh.facturaid = f.id AND rh.rn = 1
        LEFT JOIN ComprobanteRecibido cr ON cr.facturaid = f.id
        WHERE cl.organizacionid = $1
          AND COALESCE(f.agenteiaactivo, false) = true
          AND f.estado_factura_id NOT IN (3, 6)  -- excluir pagadas y canceladas
        ORDER BY
          COALESCE(rh.requiereAtencionHumana, 0) DESC,
          COALESCE(cr.pendienteConfirmacion, 0) DESC,
          (NOW()::date - f.fechavencimiento::date) DESC
      `,
			[parseInt(String(organizacionId))]
		);

    // Agrupar por cliente
    const clientesMap = new Map<number, any>();

    for (const row of result.rows) {
      if (!clientesMap.has(row.clienteid)) {
        clientesMap.set(row.clienteid, {
          clienteId: row.clienteid,
          clienteNombre: row.clientenombre,
          clienteRFC: row.clienterfc,
          clienteTelefono: row.clientetelefono,
          autoComplementoPago: !!row.autocomplementopago,
          facturas: []
        });
      }

      clientesMap.get(row.clienteid).facturas.push({
        facturaId: row.facturaid,
        numeroFactura: row.numerofactura,
        montoTotal: parseFloat(row.montototal) || 0,
        saldoPendiente: parseFloat(row.saldopendiente) || 0,
        fechaEmision: row.fechaemision,
        fechaVencimiento: row.fechavencimiento,
        diasVencido: row.diasvencido,
        estadoFactura: row.estadofactura,
        agenteIAActivo: !!row.agenteiaactivo,
        ultimoResultado: row.ultimoresultado,
        ultimaGestion: row.ultimagestion,
        proximaGestion: row.proximagestion,
        promesaPagoFecha: row.promesapagofecha,
        promesaPagoMonto: row.promesapagomonto,
        comprobanteRecibido: !!row.comprobanterecibido,
        pagoConfirmado: !!row.pagoconfirmado,
        mensajesHoy: row.mensajeshoy,
        requiereAtencionHumana: !!row.requiereatencionhumana,
        motivoEscalamiento: row.motivoescalamiento || null,
        resultadoEscalamiento: row.resultadoescalamiento || null,
        fechaEscalamiento: row.fechaescalamiento || null,
        pendienteConfirmacion: !!row.pendienteconfirmacion,
        montoComprobante: row.montocomprobante
      });
    }

    const clientes = Array.from(clientesMap.values());

    // Métricas globales
    const totalClientes = clientes.length;
    const todasFacturas = clientes.flatMap((c: any) => c.facturas);
    const totalFacturas = todasFacturas.length;
    const facturasContactadasHoy = todasFacturas.filter((f: any) => f.mensajesHoy > 0).length;
    const facturasConPromesa = todasFacturas.filter((f: any) => f.promesaPagoFecha).length;
    const facturasRequierenHumano = todasFacturas.filter((f: any) => f.requiereAtencionHumana).length;
    const facturasPendienteConfirmacion = todasFacturas.filter((f: any) => f.pendienteConfirmacion).length;
    const montoTotalPendiente = todasFacturas.reduce((s: number, f: any) => s + (parseFloat(f.saldoPendiente) || 0), 0);

    return json({
      success: true,
      metricas: {
        totalClientes,
        totalFacturas,
        facturasContactadasHoy,
        facturasConPromesa,
        facturasRequierenHumano,
        facturasPendienteConfirmacion,
        montoTotalPendiente
      },
      clientes
    });

  } catch (error: any) {
    console.error('[COBRADOR-IA] Error:', error);
    return json({
      success: false,
      error: 'Error al obtener datos del cobrador IA'
    }, { status: 500 });
  }
};

/**
 * PATCH /api/cobrador-ia
 * Actualiza configuración del cobrador IA por cliente:
 * - autoComplementoPago: toggle de complemento automático
 */
export const PATCH: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const organizacionId = await resolverOrganizacionId(event.locals, event.url);

  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  try {
    const body = await event.request.json();
    const { clienteId, autoComplementoPago } = body;

    if (!clienteId || typeof autoComplementoPago !== 'boolean') {
      return json({
        success: false,
        error: 'Se requiere clienteId y autoComplementoPago (boolean)'
      }, { status: 400 });
    }

    const pool = await getConnection();

    // Verificar que el cliente pertenece a la organización
    const clienteCheck = await pool.query(
			'SELECT Id FROM Clientes WHERE Id = $1 AND OrganizacionId = $2',
			[clienteId, parseInt(String(organizacionId))]
		);

    if (!clienteCheck.rows.length) {
      return json({ success: false, error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Actualizar flag
    await pool.query(
			'UPDATE Clientes SET AutoComplementoPago = $2 WHERE Id = $1',
			[clienteId, autoComplementoPago]
		);

    return json({
      success: true,
      message: `Complemento automático ${autoComplementoPago ? 'activado' : 'desactivado'} para el cliente`
    });

  } catch (error: any) {
    console.error('[COBRADOR-IA] Error PATCH:', error);
    return json({
      success: false,
      error: 'Error al actualizar configuración'
    }, { status: 500 });
  }
};
