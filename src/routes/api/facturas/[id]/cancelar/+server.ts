import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params, url, request } = event;
  const facturaId = parseInt(params.id);
  const organizacionId = url.searchParams.get('organizacionId');

  if (!facturaId) {
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

  try {
    // Obtener la factura con información de Facturapi y organización
    const facturaQuery = `
      SELECT
        f.Id,
        f.numero_factura,
        f.estado_factura_id,
        f.FacturapiId,
        f.Timbrado,
        c.OrganizacionId,
        co.facturapi_key as FacturapiKey
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      LEFT JOIN configuracion_organizacion co ON c.OrganizacionId = co.organizacion_id
      WHERE f.Id = ? AND c.OrganizacionId = ?
    `;

    const facturas = await db.query(facturaQuery, [facturaId, organizacionId]);

    if (!facturas || facturas.length === 0) {
      return json({
        success: false,
        error: 'Factura no encontrada o no tienes permiso para cancelarla'
      }, { status: 404 });
    }

    const factura = facturas[0];

    // Si la factura está timbrada (tiene FacturapiId), cancelarla en Facturapi primero
    if (factura.Timbrado && factura.FacturapiId) {
      if (!factura.FacturapiKey) {
        return json({
          success: false,
          error: 'La organización no tiene configurada una API key de Facturapi. No se puede cancelar la factura timbrada.'
        }, { status: 400 });
      }

      try {
        // Obtener el cuerpo de la request para el motivo y sustituir
        let motivo = '01'; // Código por defecto: Comprobante emitido con errores
        let motivoDescripcion = 'Comprobante emitido con errores';

        const requestBody = await request.json().catch(() => ({}));

        if (requestBody.motivo) {
          motivo = requestBody.motivo; // Ej: 01, 02, 03, 04
        }

        if (requestBody.motivoDescripcion) {
          motivoDescripcion = requestBody.motivoDescripcion;
        }

        // Cancelar en Facturapi
        // DELETE https://www.facturapi.io/v2/invoices/{id}?motive=XX
        console.log('Cancelando factura en Facturapi:', {
          id: factura.FacturapiId,
          motivo,
          motivoDescripcion,
          apiKey: factura.FacturapiKey?.substring(0, 10) + '...' // Log parcial de la API key
        });

        await axios.delete(
          `https://www.facturapi.io/v2/invoices/${factura.FacturapiId}?motive=${motivo}`,
          {
            headers: {
              'Authorization': `Bearer ${factura.FacturapiKey}`
            }
          }
        );

        console.log(`Factura ${factura.numero_factura} cancelada en Facturapi exitosamente`);
      } catch (facturapiError: any) {
        console.error('Error al cancelar en Facturapi:', {
          message: facturapiError.response?.data?.message || facturapiError.message,
          status: facturapiError.response?.status,
          data: facturapiError.response?.data,
          facturaId: factura.FacturapiId
        });

        // Si Facturapi retorna error, devolver ese error
        return json({
          success: false,
          error: `Error al cancelar en Facturapi: ${facturapiError.response?.data?.message || facturapiError.message}`
        }, { status: 400 });
      }
    }

    // Actualizar estado en la BD (Estado 6 = Cancelada)
    const updateQuery = `
      UPDATE Facturas
      SET estado_factura_id = 6, UltimaGestion = GETDATE()
      WHERE Id = ?
    `;

    await db.query(updateQuery, [facturaId]);

    return json({
      success: true,
      message: 'Factura cancelada exitosamente',
      facturaId: facturaId,
      numeroFactura: factura.numero_factura,
      nuevoEstado: 6,
      canceladaEnFacturapi: factura.Timbrado && factura.FacturapiId ? true : false
    });

  } catch (error: any) {
    console.error('Error en POST /api/facturas/[id]/cancelar:', error);
    return json({
      success: false,
      error: error.message || 'Error al cancelar la factura'
    }, { status: 500 });
  }
};
