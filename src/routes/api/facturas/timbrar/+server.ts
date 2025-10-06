import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import axios from 'axios';
import formData from 'form-data';
import Mailgun from 'mailgun.js';

// Configuración de Facturapi
const FACTURAPI_KEY = 'REDACTED_FACTURAPI_TEST_KEY';

// Configuración de Mailgun
const MAILGUN_DOMAIN = 'sandboxd365386a7aae481ab007685bc5b9847b.mailgun.org';
const MAILGUN_API_KEY = 'REDACTED_MAILGUN_API_KEY';
const MAILGUN_FROM = 'mmendozacobranza@sandboxd365386a7aae481ab007685bc5b9847b.mailgun.org';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { facturaId } = await request.json();

    if (!facturaId) {
      return json({ success: false, error: 'facturaId es requerido' }, { status: 400 });
    }

    // Obtener información completa de la factura
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
        c.RazonSocial as ClienteRazonSocial,
        c.RFC as ClienteRFC,
        c.CorreoPrincipal as ClienteEmail,
        c.CodigoPostal as ClienteCP,
        c.RegimenFiscalId as ClienteRegimenFiscalId,
        r.Codigo as ClienteRegimenFiscalCodigo,
        o.RazonSocial as OrganizacionRazonSocial,
        o.RFC as OrganizacionRFC
      FROM Facturas f
      INNER JOIN Clientes c ON f.ClienteId = c.Id
      INNER JOIN Organizaciones o ON c.OrganizacionId = o.Id
      LEFT JOIN Regimen r ON c.RegimenFiscalId = r.ID_Regimen
      WHERE f.Id = ?
    `;

    const facturaResult = await db.query(facturaQuery, [facturaId]);

    if (!facturaResult || facturaResult.length === 0) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = facturaResult[0];

    if (!factura.ClienteEmail) {
      return json({
        success: false,
        error: 'El cliente no tiene correo electrónico configurado en CorreoPrincipal'
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
      // Detectar si es persona física o moral basándose en el RFC
      // RFC Persona Física: 13 caracteres (AAAA######XXX)
      // RFC Persona Moral: 12 caracteres (AAA######XXX)
      const esPersonaFisica = factura.ClienteRFC && factura.ClienteRFC.length === 13;

      // Regímenes fiscales válidos según tipo de persona
      const regimenesPersonasFisicas = ['605', '606', '608', '610', '611', '612', '614', '615', '616', '621', '625', '626'];
      const regimenesPersonasMorales = ['601', '603', '607', '609', '620', '622', '623', '624'];

      // Usar el código del régimen fiscal de la tabla Regimen
      regimenFiscal = factura.ClienteRegimenFiscalCodigo;

      if (regimenFiscal) {
        // Validar que el régimen fiscal coincida con el tipo de persona
        if (esPersonaFisica && !regimenesPersonasFisicas.includes(regimenFiscal)) {
          // Régimen inválido para persona física, usar default
          regimenFiscal = '612'; // 612 = Personas Físicas con Actividades Empresariales y Profesionales
        } else if (!esPersonaFisica && !regimenesPersonasMorales.includes(regimenFiscal)) {
          // Régimen inválido para persona moral, usar default
          regimenFiscal = '601'; // 601 = General de Ley Personas Morales
        }
      } else {
        // Si no hay régimen fiscal, usar default según tipo de persona
        regimenFiscal = esPersonaFisica ? '612' : '601';
      }
    }

    // Construir payload para Facturapi según documentación
    const facturapiPayload: any = {
      customer: {
        legal_name: factura.ClienteRazonSocial,
        tax_id: factura.ClienteRFC,
        tax_system: regimenFiscal,
        email: factura.ClienteEmail,
        address: {
          zip: factura.ClienteCP || '00000' // Código postal requerido, usar '00000' si no está disponible
        }
      },
      items: conceptosResult.map((concepto: any) => ({
        product: {
          description: concepto.Descripcion || concepto.Nombre,
          product_key: concepto.ClaveProdServ || '01010101',
          price: parseFloat(concepto.PrecioUnitario)
        },
        quantity: parseFloat(concepto.Cantidad)
      })),
      payment_form: factura.FormaPago || '99',
      use: factura.UsoCFDI || 'G03'
    };

    // Si es RFC genérico, agregar nodo global (Factura Global)
    if (esRFCGenerico) {
      facturapiPayload.global = {
        periodicity: 'day', // day, week, fortnight, month, two_months
        months: new Date(factura.FechaEmision).getMonth() + 1, // Mes actual (1-12)
        year: new Date(factura.FechaEmision).getFullYear()
      };
    }

    // Crear factura en Facturapi
    const { data: invoice } = await axios.post(
      'https://www.facturapi.io/v2/invoices',
      facturapiPayload,
      {
        auth: {
          username: FACTURAPI_KEY,
          password: ''
        }
      }
    );

    // Obtener PDF y XML usando los endpoints correctos
    const [pdfRes, xmlRes] = await Promise.all([
      axios.get(`https://www.facturapi.io/v2/invoices/${invoice.id}/pdf`, {
        responseType: 'arraybuffer',
        auth: { username: FACTURAPI_KEY, password: '' }
      }),
      axios.get(`https://www.facturapi.io/v2/invoices/${invoice.id}/xml`, {
        responseType: 'arraybuffer',
        auth: { username: FACTURAPI_KEY, password: '' }
      })
    ]);

    // Convertir a base64
    const pdfBase64 = Buffer.from(pdfRes.data).toString('base64');
    const xmlBase64 = Buffer.from(xmlRes.data).toString('base64');

    // Guardar UUID del timbrado en la base de datos
    await db.query(
      `UPDATE Facturas
       SET UUID = ?,
           Timbrado = 1,
           FechaTimbrado = GETDATE(),
           FacturapiId = ?
       WHERE Id = ?`,
      [invoice.uuid, invoice.id, facturaId]
    );

    // Enviar correo con Mailgun
    const mailgun = new Mailgun(formData);
    const mg = mailgun.client({
      username: 'api',
      key: MAILGUN_API_KEY
    });

    const emailData = {
      from: MAILGUN_FROM,
      to: factura.ClienteEmail,
      subject: `Factura ${factura.numero_factura} - ${factura.OrganizacionRazonSocial}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #666; }
            .detail-value { color: #333; }
            .total-row { background: #667eea; color: white; padding: 15px; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📄 Nueva Factura Electrónica</h1>
              <p>Se ha generado una nueva factura</p>
            </div>
            <div class="content">
              <p>Estimado/a <strong>${factura.ClienteRazonSocial}</strong>,</p>
              <p>Le informamos que se ha generado y timbrado exitosamente la siguiente factura:</p>

              <div class="invoice-details">
                <div class="detail-row">
                  <span class="detail-label">Número de Factura:</span>
                  <span class="detail-value">${factura.numero_factura}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">UUID:</span>
                  <span class="detail-value">${invoice.uuid}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Fecha de Emisión:</span>
                  <span class="detail-value">${new Date(factura.FechaEmision).toLocaleDateString('es-MX')}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Fecha de Vencimiento:</span>
                  <span class="detail-value">${new Date(factura.FechaVencimiento).toLocaleDateString('es-MX')}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">RFC Emisor:</span>
                  <span class="detail-value">${factura.OrganizacionRFC}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">RFC Receptor:</span>
                  <span class="detail-value">${factura.ClienteRFC}</span>
                </div>
                <div class="total-row">
                  <div class="detail-row" style="border: none; padding: 0;">
                    <span class="detail-label" style="color: white;">Total:</span>
                    <span class="detail-value" style="color: white; font-size: 24px; font-weight: bold;">$${Number(factura.MontoTotal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</span>
                  </div>
                </div>
              </div>

              <p style="margin-top: 30px;">El XML y PDF de la factura están adjuntos a este correo.</p>

              <div class="footer">
                <p><strong>${factura.OrganizacionRazonSocial}</strong></p>
                <p>Este es un correo automático, por favor no responder.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      attachment: [
        {
          data: Buffer.from(pdfBase64, 'base64'),
          filename: `${factura.numero_factura}.pdf`,
          contentType: 'application/pdf'
        },
        {
          data: Buffer.from(xmlBase64, 'base64'),
          filename: `${factura.numero_factura}.xml`,
          contentType: 'application/xml'
        }
      ]
    };

    await mg.messages.create(MAILGUN_DOMAIN, emailData);

    return json({
      success: true,
      message: 'Factura timbrada y enviada exitosamente',
      uuid: invoice.uuid,
      facturapiId: invoice.id,
      emailEnviado: factura.ClienteEmail
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
