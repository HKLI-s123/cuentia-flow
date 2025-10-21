import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import nodemailer from 'nodemailer';
import {
	SMTP_HOST,
	SMTP_PORT,
	SMTP_USER,
	SMTP_PASSWORD,
	SMTP_FROM_EMAIL,
	SMTP_FROM_NAME
} from '$env/static/private';

export const POST: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { request } = event;
  try {
    const { facturaId } = await request.json();

    if (!facturaId) {
      return json({ success: false, error: 'facturaId es requerido' }, { status: 400 });
    }

    // Obtener información completa de la factura y la API key de la organización
    const facturaQuery = `
      SELECT
        f.Id,
        f.numero_factura,
        f.MontoTotal,
        f.FechaEmision,
        f.FechaVencimiento,
        f.MetodoPago,
        f.FormaPago,
        f.UsoCFDI,
        f.CondicionesPago,
        f.Moneda,
        f.TipoCambio,
        c.RazonSocial as ClienteRazonSocial,
        c.RFC as ClienteRFC,
        c.CorreoPrincipal as ClienteEmail,
        c.CodigoPostal as ClienteCP,
        c.Calle as ClienteCalle,
        c.NumeroExterior as ClienteNumeroExterior,
        c.NumeroInterior as ClienteNumeroInterior,
        c.Colonia as ClienteColonia,
        c.Ciudad as ClienteCiudad,
        e.NombreEstado as ClienteEstado,
        p.NombrePais as ClientePais,
        c.RegimenFiscalId as ClienteRegimenFiscalId,
        r.Codigo as ClienteRegimenFiscalCodigo,
        o.RazonSocial as OrganizacionRazonSocial,
        o.RFC as OrganizacionRFC,
        co.nombre_comercial as OrganizacionNombreComercial,
        co.facturapi_key as FacturapiKey,
        rOrg.Codigo as OrganizacionRegimenFiscalCodigo
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      INNER JOIN Organizaciones o ON c.OrganizacionId = o.Id
      LEFT JOIN Regimen r ON c.RegimenFiscalId = r.ID_Regimen
      LEFT JOIN configuracion_organizacion co ON o.Id = co.organizacion_id
      LEFT JOIN Regimen rOrg ON co.regimen_fiscal = rOrg.ID_Regimen
      LEFT JOIN Estados e ON c.EstadoId = e.ID
      LEFT JOIN Paises p ON c.PaisId = p.ID
      WHERE f.Id = ?
    `;

    const facturaResult = await db.query(facturaQuery, [facturaId]);

    if (!facturaResult || facturaResult.length === 0) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = facturaResult[0];

    // Validaciones de datos requeridos
    if (!factura.FacturapiKey) {
      return json({
        success: false,
        error: 'La organización no tiene configurada una API key de Facturapi'
      }, { status: 400 });
    }

    if (!factura.ClienteEmail) {
      return json({
        success: false,
        error: 'El cliente no tiene correo electrónico configurado en CorreoPrincipal'
      }, { status: 400 });
    }

    if (!factura.MetodoPago) {
      return json({
        success: false,
        error: 'La factura no tiene método de pago (MetodoPago) configurado'
      }, { status: 400 });
    }

    if (!factura.FormaPago) {
      return json({
        success: false,
        error: 'La factura no tiene forma de pago (FormaPago) configurada'
      }, { status: 400 });
    }

    if (!factura.UsoCFDI) {
      return json({
        success: false,
        error: 'La factura no tiene uso de CFDI (UsoCFDI) configurado'
      }, { status: 400 });
    }

    // Obtener conceptos de la factura
    const conceptosQuery = `
      SELECT
        cf.Nombre,
        cf.Descripcion,
        cf.ClaveProdServ,
        cf.UnidadMedida,
        cf.Cantidad,
        cf.PrecioUnitario,
        cf.Subtotal,
        cf.Total,
        cf.ObjetoImpuesto,
        cf.Id as ConceptoId
      FROM ConceptosFactura cf
      WHERE cf.FacturaId = ?
    `;

    const conceptosResult = await db.query(conceptosQuery, [facturaId]);

    if (!conceptosResult || conceptosResult.length === 0) {
      return json({
        success: false,
        error: 'La factura no tiene conceptos asociados'
      }, { status: 400 });
    }

    // RFC genérico (público en general) SIEMPRE debe usar régimen 616
    const esRFCGenerico = factura.ClienteRFC === 'XAXX010101000';

    let regimenFiscal: string;

    if (esRFCGenerico) {
      // RFC genérico SIEMPRE usa régimen 616, sin importar lo que tenga el cliente
      regimenFiscal = '616';
    } else {
      // Usar el código del régimen fiscal directamente de la base de datos
      regimenFiscal = factura.ClienteRegimenFiscalCodigo;

      // Validar que el régimen fiscal exista
      if (!regimenFiscal) {
        return json({
          success: false,
          error: 'El cliente no tiene régimen fiscal configurado'
        }, { status: 400 });
      }
    }

    // Limpiar razón social para el SAT (CFDI 4.0)
    // - Convertir a mayúsculas
    // - Eliminar acentos
    // - Eliminar regímenes societarios SOLO para personas morales
    const limpiarRazonSocial = (razonSocial: string, rfc: string): string => {
      // Detectar si es persona física (RFC de 13 caracteres)
      const esPersonaFisica = rfc && rfc.length === 13;

      let resultado = razonSocial
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Eliminar acentos

      // Solo eliminar regímenes societarios si es persona moral
      if (!esPersonaFisica) {
        resultado = resultado
          .replace(/\s+S\.?\s?A\.?\s+(DE\s+)?C\.?\s?V\.?$/i, '') // S.A. DE C.V., SA DE CV, S.A. de C.V.
          .replace(/\s+S\.?\s?DE\s+R\.?\s?L\.?(\s+DE\s+C\.?\s?V\.?)?$/i, '') // S. DE R.L., S DE RL DE CV
          .replace(/\s+S\.?\s?C\.?$/i, '') // S.C.
          .replace(/\s+A\.?\s?C\.?$/i, ''); // A.C.
      }

      return resultado.trim();
    };

    // Extraer serie y folio del número de factura
    // Formato esperado: CAM-2373 -> Serie: CAM, Folio: 2373
    let serie = '';
    let folio = '';

    if (factura.numero_factura) {
      const partes = factura.numero_factura.split('-');
      if (partes.length === 2) {
        serie = partes[0]; // Primeras 3 letras del RFC (CAM)
        folio = partes[1]; // Número consecutivo (2373)
      }
    }

    // Si no se pudo extraer la serie del número de factura, usar las primeras 3 letras del RFC de la organización
    if (!serie && factura.OrganizacionRFC) {
      serie = factura.OrganizacionRFC.substring(0, 3).toUpperCase();
    }

    // Construir payload para Facturapi según documentación
    const facturapiPayload: any = {
      currency: factura.Moneda || 'MXN', // Usar moneda de la factura, default MXN
      exchange: factura.Moneda && factura.Moneda !== 'MXN' ? parseFloat(factura.TipoCambio) : 1, // Tipo de cambio respecto a MXN
      customer: {
        legal_name: limpiarRazonSocial(factura.ClienteRazonSocial, factura.ClienteRFC),
        tax_id: factura.ClienteRFC,
        tax_system: String(regimenFiscal), // Convertir a string
        email: factura.ClienteEmail,
        address: {
          street: factura.ClienteCalle || '',
          exterior: factura.ClienteNumeroExterior || '',
          interior: factura.ClienteNumeroInterior || '',
          neighborhood: factura.ClienteColonia || '',
          city: factura.ClienteCiudad || '',
          municipality: factura.ClienteCiudad || '',
          state: factura.ClienteEstado || '',
          country: factura.ClientePais === 'México' || factura.ClientePais === 'Mexico' ? 'MEX' : (factura.ClientePais || 'MEX'),
          zip: factura.ClienteCP || '00000' // Código postal requerido, usar '00000' si no está disponible
        }
      },
      items: await Promise.all(conceptosResult.map(async (concepto: any) => {
        // Obtener impuestos del concepto desde la base de datos
        const impuestosQuery = `
          SELECT Tipo, Tasa
          FROM ImpuestosConcepto
          WHERE ConceptoId = ?
        `;
        const impuestosResult = await db.query(impuestosQuery, [concepto.ConceptoId]);

        // Convertir impuestos al formato de Facturapi
        const taxes = impuestosResult.map((imp: any) => {
          // Facturapi usa los nombres, no códigos: IVA, ISR, IEPS
          let tipoImpuesto: string;
          if (imp.Tipo.includes('IVA')) {
            tipoImpuesto = 'IVA';
          } else if (imp.Tipo.includes('ISR')) {
            tipoImpuesto = 'ISR';
          } else if (imp.Tipo.includes('IEPS')) {
            tipoImpuesto = 'IEPS';
          } else {
            tipoImpuesto = 'IVA'; // Default IVA
          }

          const isWithholding = imp.Tipo.includes('Retenido');

          return {
            type: tipoImpuesto,
            rate: parseFloat(imp.Tasa),
            withholding: isWithholding,
            factor: 'Tasa'
          };
        });

        // El PrecioUnitario en la base de datos ya está SIN IVA (es el subtotal / cantidad)
        // Facturapi necesita saber que el precio NO incluye impuestos con tax_included: false
        const cantidad = parseFloat(concepto.Cantidad);
        const subtotal = parseFloat(concepto.Subtotal); // Ya está sin IVA
        const precioUnitarioSinIVA = subtotal / cantidad;

        return {
          product: {
            description: concepto.Descripcion || concepto.Nombre,
            product_key: concepto.ClaveProdServ,
            unit_key: concepto.UnidadMedida,
            price: precioUnitarioSinIVA,
            tax_included: false, // IMPORTANTE: El precio NO incluye impuestos
            taxes: taxes.length > 0 ? taxes : undefined,
            taxability: concepto.ObjetoImpuesto || '02'
          },
          quantity: cantidad
        };
      })),
      payment_form: factura.FormaPago,
      payment_method: factura.MetodoPago,
      use: factura.UsoCFDI,
      series: serie,
      folio_number: folio ? parseInt(folio) : undefined
    };

    // Si es RFC genérico, agregar nodo global (Factura Global)
    if (esRFCGenerico) {
      facturapiPayload.global = {
        periodicity: 'day', // day, week, fortnight, month, two_months
        months: new Date(factura.FechaEmision).getMonth() + 1, // Mes actual (1-12)
        year: new Date(factura.FechaEmision).getFullYear()
      };
    }

    // Crear factura en Facturapi usando la API key de la organización
    const { data: invoice } = await axios.post(
      'https://www.facturapi.io/v2/invoices',
      facturapiPayload,
      {
        auth: {
          username: factura.FacturapiKey,
          password: ''
        }
      }
    );

    console.log('Respuesta de Facturapi al crear factura:', {
      id: invoice.id,
      uuid: invoice.uuid,
      allKeys: Object.keys(invoice)
    });

    // Descargar PDF y XML desde Facturapi con autenticación
    const pdfUrl = `https://www.facturapi.io/v2/invoices/${invoice.id}/pdf`;
    const xmlUrl = `https://www.facturapi.io/v2/invoices/${invoice.id}/xml`;

    // Descargar PDF en base64 usando la API key de la organización
    const pdfResponse = await axios.get(pdfUrl, {
      auth: {
        username: factura.FacturapiKey,
        password: ''
      },
      responseType: 'arraybuffer'
    });
    const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');

    // Descargar XML en base64 usando la API key de la organización
    const xmlResponse = await axios.get(xmlUrl, {
      auth: {
        username: factura.FacturapiKey,
        password: ''
      },
      responseType: 'arraybuffer'
    });
    const xmlBase64 = Buffer.from(xmlResponse.data).toString('base64');

    // Guardar toda la información del timbrado en la base de datos
    await db.query(
      `UPDATE Facturas
       SET UUID = ?,
           UUIDFacturapi = ?,
           Timbrado = 1,
           FechaTimbrado = GETDATE(),
           FacturapiId = ?,
           PDFUrl = ?,
           XMLUrl = ?,
           PDFBase64 = ?,
           XMLBase64 = ?
       WHERE Id = ?`,
      [invoice.uuid, invoice.uuid, invoice.id, pdfUrl, xmlUrl, pdfBase64, xmlBase64, facturaId]
    );

    // Enviar correo automáticamente al cliente después de timbrar
    let emailEnviado = false;
    let emailError = null;

    if (factura.ClienteEmail) {
      try {
        // Convertir buffers de PDF y XML
        const pdfBuffer = Buffer.from(pdfResponse.data);
        const xmlBuffer = Buffer.from(xmlResponse.data);

        // Configurar transporte SMTP
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: parseInt(SMTP_PORT),
          secure: false,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASSWORD
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        const nombreCliente = factura.ClienteRazonSocial;
        const numeroFactura = factura.numero_factura;

        // Configurar el correo
        const mailOptions = {
          from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
          to: factura.ClienteEmail,
          subject: `Factura ${numeroFactura} - ${nombreCliente}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; margin-bottom: 20px;">
                <h2 style="color: #2563eb; margin-top: 0;">Factura Electrónica</h2>
                <p style="font-size: 16px; margin-bottom: 20px;">Estimado(a) <strong>${nombreCliente}</strong>,</p>
                <p style="font-size: 14px; color: #555;">
                  Le enviamos su factura electrónica correspondiente al servicio prestado.
                </p>
              </div>

              <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 20px;">
                <h3 style="color: #374151; margin-top: 0; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                  Detalles de la Factura
                </h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Folio:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${numeroFactura}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>UUID:</strong></td>
                    <td style="padding: 8px 0; text-align: right; font-size: 12px;">${invoice.uuid}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280;"><strong>Fecha de emisión:</strong></td>
                    <td style="padding: 8px 0; text-align: right;">${new Date(factura.FechaEmision).toLocaleDateString('es-MX')}</td>
                  </tr>
                  <tr style="border-top: 2px solid #e5e7eb;">
                    <td style="padding: 12px 0; color: #6b7280; font-size: 16px;"><strong>Total:</strong></td>
                    <td style="padding: 12px 0; text-align: right; font-size: 18px; color: #2563eb; font-weight: bold;">
                      $${parseFloat(factura.MontoTotal).toFixed(2)} ${factura.Moneda || 'MXN'}
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  📎 <strong>Archivos adjuntos:</strong> Esta factura incluye los archivos PDF y XML.
                </p>
              </div>

              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #9ca3af; margin: 5px 0;">
                  Este es un correo automático, por favor no responder.
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin: 5px 0;">
                  Si tiene alguna duda, póngase en contacto con nosotros.
                </p>
              </div>
            </body>
            </html>
          `,
          attachments: [
            {
              filename: `Factura_${numeroFactura}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf'
            },
            {
              filename: `Factura_${numeroFactura}.xml`,
              content: xmlBuffer,
              contentType: 'application/xml'
            }
          ]
        };

        // Enviar el correo
        await transporter.sendMail(mailOptions);
        emailEnviado = true;

      } catch (emailErr) {
        console.error('Error al enviar correo automático:', emailErr);
        emailError = emailErr instanceof Error ? emailErr.message : 'Error desconocido';
        // No fallar el timbrado si falla el email
      }
    }

    return json({
      success: true,
      message: 'Factura timbrada Correctamente',
      uuid: invoice.uuid,
      facturapiId: invoice.id,
      numeroFactura: factura.numero_factura,
      pdfUrl: pdfUrl,
      xmlUrl: xmlUrl,
      emailEnviado,
      emailDestinatario: factura.ClienteEmail || null,
      emailError
    });

  } catch (error: any) {
    console.error('Error al timbrar factura:', error);
    return json({
      success: false,
      error: 'Error al timbrar y enviar la factura',
      details: error.response?.data || error.message || 'Error desconocido'
    }, { status: 500 });
  }
};
