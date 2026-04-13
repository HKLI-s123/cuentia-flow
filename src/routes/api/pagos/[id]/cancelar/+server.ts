import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';
import { checkRateLimit, getClientIP } from '$lib/server/security';

export const POST: RequestHandler = async (event) => {
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params, url, request } = event;
  const pagoId = parseInt(params.id);
  const organizacionId = url.searchParams.get('organizacionId');

  if (!pagoId || isNaN(pagoId)) {
    return json({ success: false, error: 'ID de pago inválido' }, { status: 400 });
  }

  if (!organizacionId) {
    return json({ success: false, error: 'organizacionId es requerido' }, { status: 400 });
  }

  // Validar acceso a la organización
  const orgValidation = await validateOrganizationAccess(event, organizacionId);
  if (!orgValidation.valid) {
    return orgValidation.error!;
  }

  // Rate limit: máximo 5 cancelaciones por usuario por 30 minutos
  const clientIP = getClientIP(event);
  const rateLimitKey = `cancel_pago:${user.id}:${clientIP}`;
  const rateCheck = checkRateLimit(rateLimitKey, 5, 30);
  if (!rateCheck.allowed) {
    return json({
      success: false,
      error: 'Demasiados intentos de cancelación. Intente de nuevo más tarde.'
    }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const motivo: string = body.motivo || '02';

    // Validar motivo SAT
    const motivosValidos = ['01', '02', '03', '04'];
    if (!motivosValidos.includes(motivo)) {
      return json({
        success: false,
        error: 'Motivo de cancelación inválido. Use 01, 02, 03 o 04.'
      }, { status: 400 });
    }

    const pool = await getConnection();

    // Obtener el pago con información necesaria para cancelar
    const pagoResult = await pool.query(
			`
        SELECT 
          p.id, p.facturaid, p.monto, p.facturapipagoid, p.uuidpago, p.cancelado,
          f.numero_factura, f.saldopendiente, f.estado_factura_id,
          c.organizacionid,
          o.apikeyfacturaapi
        FROM Pagos p
        INNER JOIN Facturas f ON p.facturaid = f.id
        INNER JOIN Clientes c ON f.clienteid = c.id
        INNER JOIN Organizaciones o ON c.organizacionid = o.id
        WHERE p.id = $1 AND c.organizacionid = $2
      `,
			[pagoId, parseInt(organizacionId)]
		);

    if (!pagoResult.rows.length) {
      return json({
        success: false,
        error: 'Pago no encontrado o no pertenece a tu organización'
      }, { status: 404 });
    }

    const pago = pagoResult.rows[0];

    // Validar que no esté ya cancelado
    if (pago.cancelado) {
      return json({
        success: false,
        error: 'Este pago ya se encuentra cancelado.'
      }, { status: 400 });
    }

    const facturapiPagoId = pago.facturapipagoid;
    const apiKey = pago.apikeyfacturaapi;

    // Cancelar en Facturapi si tenemos el ID del complemento
    let canceladoEnFacturapi = false;
    if (facturapiPagoId && apiKey) {
      try {
        const cancelUrl = `https://www.facturapi.io/v2/invoices/${facturapiPagoId}?motive=${motivo}`;

        const response = await axios.delete(cancelUrl, {
          auth: { username: apiKey, password: '' }
        });

        const facturapiResponse = response.data;
        
        if (facturapiResponse.status === 'canceled') {
          canceladoEnFacturapi = true;
        } else if (facturapiResponse.cancellation_status === 'pending') {
          // Cancelación pendiente de aceptación del receptor
          canceladoEnFacturapi = true;
        } else {
          canceladoEnFacturapi = true;
        }

      } catch (err: any) {
        const errorMsg = err.response?.data?.message || err.message;
        const errorStatus = err.response?.status;

        // Si es 404, el invoice ya no existe en Facturapi — continuar con cancelación local
        if (errorStatus !== 404) {
          console.error('[CANCELAR PAGO] Error Facturapi:', errorMsg);
          return json({
            success: false,
            error: `Error al cancelar en Facturapi: ${errorMsg}`
          }, { status: errorStatus === 400 || errorStatus === 422 ? errorStatus : 500 });
        }
        canceladoEnFacturapi = true;
      }
    } else {
    }

    // Encontrar TODOS los pagos del mismo complemento (mismo FacturapiPagoId)
    // Un timbrado tipo P puede cubrir múltiples pagos a diferentes facturas
    let pagosAfectados: any[] = [];
    if (facturapiPagoId) {
      const asociados = await pool.query(
			`
          SELECT p.id, p.facturaid, p.monto, f.saldopendiente, f.estado_factura_id
          FROM Pagos p
          INNER JOIN Facturas f ON p.facturaid = f.id
          INNER JOIN Clientes c ON f.clienteid = c.id
          WHERE p.facturapipagoid = $1 
            AND c.organizacionid = $2 
            AND p.cancelado = false
        `,
			[facturapiPagoId, parseInt(organizacionId)]
		);
      pagosAfectados = asociados.rows;
    } else {
      // Sin FacturapiPagoId: solo cancelar este pago individual
      pagosAfectados = [{
        Id: pago.id,
        FacturaId: pago.facturaid,
        Monto: pago.monto,
        SaldoPendiente: pago.saldopendiente,
        estado_factura_id: pago.estado_factura_id
      }];
    }

    // Marcar como cancelados y restaurar saldos — dentro de una transacción
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const p of pagosAfectados) {
        // Marcar pago como cancelado
        await client.query(
			`
            UPDATE Pagos 
            SET Cancelado = true, 
                FechaCancelacion = NOW(), 
                MotivoCancelacion = $2,
                UpdatedAt = NOW()
            WHERE Id = $1
          `,
			[p.id, motivo]
		);

        // Restaurar saldo pendiente en la factura
        // Determinar el estado correcto según si quedan otros pagos activos
        await client.query(
			`
            UPDATE Facturas 
            SET SaldoPendiente = SaldoPendiente + $2,
                estado_factura_id = CASE
                  WHEN estado_factura_id = 6 THEN 6
                  WHEN (SaldoPendiente + $2) >= MontoTotal THEN
                    CASE WHEN FechaVencimiento < NOW() THEN 4 ELSE 1 END
                  ELSE 2
                END
            WHERE Id = $1 AND estado_factura_id != 6
          `,
			[p.facturaid, p.monto]
		);
      }

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    const mensaje = pagosAfectados.length > 1
      ? `Complemento de pago cancelado exitosamente (${pagosAfectados.length} pagos afectados)`
      : 'Pago cancelado exitosamente';

    return json({
      success: true,
      message: mensaje,
      pagosAfectados: pagosAfectados.length,
      canceladoEnFacturapi
    });

  } catch (error: any) {
    console.error('[CANCELAR PAGO] Error general:', error);
    return json({
      success: false,
      error: error.message || 'Error al cancelar el pago'
    }, { status: 500 });
  }
};
