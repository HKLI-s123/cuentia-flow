import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';

export const POST: RequestHandler = async (event) => {
  // Verificar autenticación
  const user = getUserFromRequest(event);
  if (!user) {
    return unauthorizedResponse('Token de autenticación requerido');
  }

  const { params } = event;
  const facturaId = parseInt(params.id);

  if (!facturaId) {
    return json({ success: false, error: 'facturaId es requerido' }, { status: 400 });
  }

  try {
    // Obtener información completa de la factura
    const facturaQuery = `
      SELECT
        f.id,
        f.numero_factura,
        f.montototal,
        f.fechaemision,
        f.uuid,
        f.pdfbase64,
        f.xmlbase64,
        c.razonsocial as ClienteRazonSocial,
        c.correoprincipal as ClienteEmail,
        o.razonsocial as OrganizacionRazonSocial
      FROM Facturas f
      INNER JOIN Clientes c ON f.clienteid = c.id
      INNER JOIN Organizaciones o ON c.organizacionid = o.id
      WHERE f.id = $1
    `;

    const facturaResult = await db.query(facturaQuery, [facturaId]);

    if (!facturaResult || facturaResult.length === 0) {
      return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
    }

    const factura = facturaResult[0];

    if (!factura.clienteemail) {
      return json({
        success: false,
        error: 'El cliente no tiene correo electrónico configurado'
      }, { status: 422 });
    }

    if (!factura.pdfbase64 || !factura.xmlbase64) {
      return json({
        success: false,
        error: 'La factura no ha sido timbrada. No se pueden descargar PDF y XML.'
      }, { status: 422 });
    }

    // Convertir base64 a Buffer para los adjuntos
    const pdfBuffer = Buffer.from(factura.pdfbase64, 'base64');
    const xmlBuffer = Buffer.from(factura.xmlbase64, 'base64');

    // Preparar adjuntos en formato base64 para Resend
    const pdfBase64 = pdfBuffer.toString('base64');
    const xmlBase64 = xmlBuffer.toString('base64');

    // Preparar payload para Resend
    const emailPayload = {
      from: RESEND_FROM,
      to: factura.clienteemail,
      subject: `Factura ${factura.numero_factura} - ${factura.organizacionrazonsocial}`,
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
            <p style="font-size: 16px; margin-bottom: 20px;">Estimado(a) <strong>${factura.clienterazonsocial}</strong>,</p>
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
                <td style="padding: 8px 0; text-align: right;">${factura.numero_factura}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;"><strong>UUID:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-size: 12px;">${factura.uuid}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;"><strong>Fecha de emisión:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${(() => { const d = new Date(factura.fechaemision); return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`; })()}</td>
              </tr>
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0; color: #6b7280; font-size: 16px;"><strong>Total:</strong></td>
                <td style="padding: 12px 0; text-align: right; font-size: 18px; color: #2563eb; font-weight: bold;">
                  $${parseFloat(factura.montototal).toFixed(2)} MXN
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
          filename: `Factura_${factura.numero_factura}.pdf`,
          content: pdfBase64,
          contentType: 'application/pdf'
        },
        {
          filename: `Factura_${factura.numero_factura}.xml`,
          content: xmlBase64,
          contentType: 'application/xml'
        }
      ]
    };

    // Enviar con Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.json();
      console.error('Error de Resend:', resendError);
      return json({
        success: false,
        error: 'Error al enviar el correo',
        details: resendError
      }, { status: 500 });
    }

    const resendData = await resendResponse.json();

    return json({
      success: true,
      message: 'Correo enviado exitosamente',
      destinatario: factura.clienteemail,
      numeroFactura: factura.numero_factura,
      resendId: resendData.id
    });

  } catch (error) {
    console.error('Error al enviar correo de factura:', error);
    return json({
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};
