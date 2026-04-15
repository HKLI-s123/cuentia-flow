import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';
import { checkRateLimit, getClientIP } from '$lib/server/security';

export const POST: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params, url, request } = event;
  const facturaId = parseInt(params.id);
  const organizacionId = url.searchParams.get('organizacionId');

  if (!facturaId || isNaN(facturaId)) {
    return json({
      success: false,
      error: 'ID de factura inválido'
    }, { status: 400 });
  }

  if (!organizacionId) {
    return json({
      success: false,
      error: 'organizacionId es requerido'
    }, { status: 400 });
  }

  // Validar acceso a la organización
  const orgValidation = await validateOrganizationAccess(event, organizacionId);
  if (!orgValidation.valid) {
    return orgValidation.error!;
  }

  // Rate limit: máximo 5 cancelaciones por usuario por hora, bloqueo de 30 minutos
  const clientIP = getClientIP(event);
  const rateLimitKey = `cancel_factura:${user.id}:${clientIP}`;
  const rateCheck = checkRateLimit(rateLimitKey, 5, 30);
  if (!rateCheck.allowed) {
    return json({
      success: false,
      error: 'Demasiados intentos de cancelación. Intente de nuevo más tarde.'
    }, { status: 429 });
  }

  try {
    // Parsear body
    const requestBody = await request.json().catch(() => ({}));
    const motivo: string = requestBody.motivo || '02';
    const motivoDescripcion: string = requestBody.motivoDescripcion || '';
    const sustitucion: string = requestBody.sustitucion || '';

    // Validar motivo
    const motivosValidos = ['01', '02', '03', '04'];
    if (!motivosValidos.includes(motivo)) {
      return json({
        success: false,
        error: 'Motivo de cancelación inválido. Use 01, 02, 03 o 04.'
      }, { status: 400 });
    }

    // Si motivo es 01, se requiere la factura de sustitución
    if (motivo === '01' && !sustitucion) {
      return json({
        success: false,
        error: 'Para el motivo 01 (Comprobante emitido con errores con relación) se requiere el ID o UUID de la factura que sustituye.'
      }, { status: 400 });
    }

    // Obtener la factura con información de Facturapi y organización
    const facturaQuery = `
      SELECT
        f.Id,
        f.numero_factura,
        f.estado_factura_id,
        f.FacturapiId,
        f.Timbrado,
        f.EstadoCancelacion,
        c.OrganizacionId,
        COALESCE(co.facturapi_key, o.apikeyfacturaapi) as FacturapiKey
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      INNER JOIN Organizaciones o ON c.OrganizacionId = o.Id
      LEFT JOIN configuracion_organizacion co ON o.Id = co.organizacion_id
      WHERE f.Id = $1 AND c.OrganizacionId = $2
    `;

    const facturas = await db.query(facturaQuery, [facturaId, organizacionId]);

    if (!facturas || facturas.length === 0) {
      return json({
        success: false,
        error: 'Factura no encontrada o no tienes permiso para cancelarla'
      }, { status: 404 });
    }

    const factura = facturas[0];

    // Validar que no esté ya cancelada
    if (factura.estado_factura_id === 6) {
      return json({
        success: false,
        error: 'Esta factura ya se encuentra cancelada.'
      }, { status: 400 });
    }

    // Validar que no tenga una cancelación pendiente
    if (factura.EstadoCancelacion === 'pending') {
      return json({
        success: false,
        error: 'Esta factura ya tiene una solicitud de cancelación pendiente de aceptación por el receptor.'
      }, { status: 400 });
    }

    let canceladaEnFacturapi = false;
    let cancellationStatus: string | null = null;
    let facturapiResponse: any = null;

    // Si la factura está timbrada (tiene FacturapiId), cancelarla en Facturapi primero
    if (factura.Timbrado && factura.FacturapiId) {
      if (!factura.FacturapiKey) {
        return json({
          success: false,
          error: 'La organización no tiene configurada una API key de Facturapi. No se puede cancelar la factura timbrada.'
        }, { status: 400 });
      }

      try {
        // Construir URL con query params según doc de Facturapi
        let cancelUrl = `https://www.facturapi.io/v2/invoices/${factura.FacturapiId}?motive=${motivo}`;
        if (motivo === '01' && sustitucion) {
          cancelUrl += `&substitution=${encodeURIComponent(sustitucion)}`;
        }

        console.log('Cancelando factura en Facturapi:', {
          id: factura.FacturapiId,
          motivo,
          motivoDescripcion,
          apiKey: factura.FacturapiKey?.substring(0, 10) + '...'
        });

        // DELETE request a Facturapi (Basic Auth con API key como username)
        const response = await axios.delete(cancelUrl, {
          auth: {
            username: factura.FacturapiKey,
            password: ''
          }
        });

        facturapiResponse = response.data;

        // Facturapi regresa el objeto invoice actualizado
        // Escenario 1: status = "canceled" → cancelación exitosa inmediata
        // Escenario 2: status = "valid" y cancellation_status = "pending" → requiere aceptación del receptor
        if (facturapiResponse.status === 'canceled') {
          canceladaEnFacturapi = true;
          cancellationStatus = 'accepted';
        } else if (facturapiResponse.cancellation_status === 'pending') {
          canceladaEnFacturapi = false;
          cancellationStatus = 'pending';
        } else {
          canceladaEnFacturapi = true;
          cancellationStatus = facturapiResponse.cancellation_status || 'accepted';
        }

        console.log(`Factura ${factura.numero_factura} cancelada en Facturapi exitosamente, status: ${cancellationStatus}`);
      } catch (facturapiError: any) {
        const errorMsg = facturapiError.response?.data?.message || facturapiError.message;
        const errorStatus = facturapiError.response?.status;

        console.error('Error al cancelar en Facturapi:', {
          message: errorMsg,
          status: errorStatus,
          data: facturapiError.response?.data,
          facturapiId: factura.FacturapiId
        });

        return json({
          success: false,
          error: 'Error al cancelar en Facturapi'
        }, { status: errorStatus === 400 || errorStatus === 404 || errorStatus === 422 ? errorStatus : 500 });
      }
    } else {
      // Sin timbrado: cancelación directa solo en BD
      canceladaEnFacturapi = false;
      cancellationStatus = 'accepted';
    }

    // Actualizar BD según el resultado
    if (cancellationStatus === 'pending') {
      // La cancelación requiere aceptación del receptor — NO cambiar el estado a cancelada todavía
      const updateQuery = `
        UPDATE Facturas
        SET EstadoCancelacion = 'pending',
            MotivoCancelacion = $1,
            MotivoCancelacionDescripcion = $2,
            FacturaSustitucionId = $3,
            FechaCancelacion = NOW(),
            UltimaGestion = NOW()
        WHERE Id = $4
      `;
      await db.query(updateQuery, [motivo, motivoDescripcion, sustitucion || null, facturaId]);

      return json({
        success: true,
        message: 'Solicitud de cancelación enviada. Se requiere aceptación del receptor.',
        facturaId: facturaId,
        numeroFactura: factura.numero_factura,
        canceladaEnFacturapi: false,
        cancellationStatus: 'pending',
        requiereAceptacion: true
      });
    } else {
      // Cancelación directa — marcar como cancelada (Estado 6)
      const updateQuery = `
        UPDATE Facturas
        SET estado_factura_id = 6,
            EstadoCancelacion = $1,
            MotivoCancelacion = $2,
            MotivoCancelacionDescripcion = $3,
            FacturaSustitucionId = $4,
            FechaCancelacion = NOW(),
            UltimaGestion = NOW()
        WHERE Id = $5
      `;
      await db.query(updateQuery, [
        cancellationStatus || 'accepted',
        motivo,
        motivoDescripcion,
        sustitucion || null,
        facturaId
      ]);

      return json({
        success: true,
        message: 'Factura cancelada exitosamente',
        facturaId: facturaId,
        numeroFactura: factura.numero_factura,
        nuevoEstado: 6,
        canceladaEnFacturapi: canceladaEnFacturapi,
        cancellationStatus: cancellationStatus || 'accepted',
        requiereAceptacion: false
      });
    }

  } catch (error: any) {
    console.error('Error en POST /api/facturas/[id]/cancelar:', error);
    return json({
      success: false,
      error: 'Error al cancelar la factura'
    }, { status: 500 });
  }
};
