import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';

export const POST: RequestHandler = async (event) => {
	// Verificar autenticación
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { params, request } = event;
	const facturaId = params.id;

	try {
		// Obtener organizacionId del body
		const { organizacionId } = await request.json();

		if (!organizacionId) {
			return json({
				success: false,
				error: 'organizacionId es requerido para sistema multi-tenant'
			}, { status: 400 });
		}

		// Obtener información de la factura con el correo del cliente y la API key
		// IMPORTANTE: Filtrar por organizacionId para multi-tenant
		const facturaQuery = `
			SELECT
				f.Id,
				f.numero_factura,
				f.MontoTotal,
				f.FechaEmision,
				f.FechaVencimiento,
				f.UUID,
				f.Timbrado,
				f.PDFUrl,
				f.XMLUrl,
				c.RazonSocial as ClienteRazonSocial,
				c.NombreComercial as ClienteNombreComercial,
				c.RFC as ClienteRFC,
				c.CorreoPrincipal as ClienteEmail,
				COALESCE(co.facturapi_key, o.apikeyfacturaapi) as FacturapiKey
			FROM Facturas f
			INNER JOIN Clientes c ON f.ClienteId = c.Id
			INNER JOIN Organizaciones o ON c.OrganizacionId = o.Id
			LEFT JOIN configuracion_organizacion co ON o.Id = co.organizacion_id
			WHERE f.Id = $1 AND c.OrganizacionId = $2
		`;

		const facturaResult = await db.query(facturaQuery, [facturaId, organizacionId]);

		if (!facturaResult || facturaResult.length === 0) {
			return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
		}

		const factura = facturaResult[0];

		// Validar que la factura esté timbrada
		if (!factura.Timbrado) {
			return json({
				success: false,
				error: 'La factura debe estar timbrada antes de enviarla por correo'
			}, { status: 400 });
		}

		// Validar que el cliente tenga correo
		if (!factura.ClienteEmail) {
			return json({
				success: false,
				error: 'El cliente no tiene un correo electrónico registrado'
			}, { status: 400 });
		}

		// Validar que la organización tenga API key configurada
		if (!factura.FacturapiKey) {
			return json({
				success: false,
				error: 'La organización no tiene configurada una API key de Facturapi'
			}, { status: 400 });
		}

		// Validar que existan las URLs de PDF y XML
		if (!factura.PDFUrl || !factura.XMLUrl) {
			return json({
				success: false,
				error: 'La factura no tiene PDF o XML disponibles'
			}, { status: 400 });
		}

		// Descargar PDF desde Facturapi usando la API key de la organización
		const pdfResponse = await axios.get(factura.PDFUrl, {
			auth: {
				username: factura.FacturapiKey,
				password: ''
			},
			responseType: 'arraybuffer'
		});
		const pdfBase64Attachment = Buffer.from(pdfResponse.data).toString('base64');

		// Descargar XML desde Facturapi usando la API key de la organización
		const xmlResponse = await axios.get(factura.XMLUrl, {
			auth: {
				username: factura.FacturapiKey,
				password: ''
			},
			responseType: 'arraybuffer'
		});
		const xmlBase64Attachment = Buffer.from(xmlResponse.data).toString('base64');

		const numeroFactura = factura.numero_factura;
		const destinatario = factura.ClienteEmail;

		// Formatear fechas
		const formatFecha = (fecha: string) => {
			if (!fecha) return '';
			const date = new Date(fecha);
			return date.toLocaleDateString('es-MX', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		};

		// Formatear moneda
		const formatMoneda = (monto: number) => {
			return new Intl.NumberFormat('es-MX', {
				style: 'currency',
				currency: 'MXN'
			}).format(monto);
		};

		const asunto = `Factura ${numeroFactura} - ${factura.ClienteRazonSocial}`;
		const mensaje = `Estimado cliente ${factura.ClienteNombreComercial || factura.ClienteRazonSocial},

Por medio del presente, le hacemos llegar su factura ${numeroFactura} con los siguientes detalles:

• Número de Factura: ${numeroFactura}
• Fecha de Emisión: ${formatFecha(factura.FechaEmision)}
• Fecha de Vencimiento: ${formatFecha(factura.FechaVencimiento)}
• Monto Total: ${formatMoneda(factura.MontoTotal)}
• UUID: ${factura.UUID || 'N/A'}

Adjunto encontrará los archivos PDF y XML correspondientes a esta factura.

Si tiene alguna pregunta o requiere información adicional, no dude en contactarnos.

Quedamos a sus órdenes.

Saludos cordiales.`;

		// Primero guardar el recordatorio en la base de datos para obtener el ID
		const insertQuery = `
			INSERT INTO Recordatorios (
				FacturaId,
				TipoMensaje,
				Destinatario,
				Asunto,
				Mensaje,
				FechaEnvio,
				MetodoEnvio,
				Estado,
				CreadoPor
			)
			VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
			RETURNING id
		`;

		const recordatorioResult = await db.query(insertQuery, [
			facturaId,
			'FACTURA',
			destinatario,
			asunto,
			mensaje,
			'Automatico',
			'Enviado',
			user.id || null
		]);

		const recordatorioId = recordatorioResult[0]?.id;

		// Obtener la URL base del servidor (para el tracking pixel)
		const protocol = event.url.protocol;
		const host = event.url.host;
		const baseUrl = `${protocol}//${host}`;
		const trackingPixelUrl = `${baseUrl}/api/tracking/email/${recordatorioId}`;

		// Convertir saltos de línea a HTML
		const mensajeHtml = mensaje.replace(/\n/g, '<br>');

		// Enviar correo con Resend
		const resendResponse = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${RESEND_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: RESEND_FROM || 'no-reply@cuentia.mx',
				to: destinatario,
				subject: asunto,
				html: `
					<!DOCTYPE html>
					<html>
					<head>
						<meta charset="UTF-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
					</head>
					<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
						<div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; margin-bottom: 20px;">
							<h2 style="color: #1f2937; margin-top: 0;">Factura ${numeroFactura}</h2>
							<div style="font-size: 14px; white-space: pre-wrap;">${mensajeHtml}</div>
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

						<!-- Tracking pixel -->
						<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
					</body>
					</html>
				`,
				attachments: [
					{
						filename: `Factura_${numeroFactura}.pdf`,
						content: pdfBase64Attachment,
						type: 'application/pdf'
					},
					{
						filename: `Factura_${numeroFactura}.xml`,
						content: xmlBase64Attachment,
						type: 'application/xml'
					}
				]
			})
		});

		if (!resendResponse.ok) {
			const resendError = await resendResponse.text();
			throw new Error(`Resend error: ${resendError}`);
		}

		const resendData = await resendResponse.json();

		// Actualizar el recordatorio con el MessageId
		const updateQuery = `
			UPDATE Recordatorios
			SET MessageId = $1
			WHERE Id = $2
		`;

		await db.query(updateQuery, [resendData.id, recordatorioId]);

		return json({
			success: true,
			message: 'Factura enviada exitosamente',
			messageId: resendData.id,
			destinatario: destinatario
		});

	} catch (error) {
		console.error('Error al enviar factura:', error);
		return json({
			success: false,
			error: 'Error al enviar la factura',
			details: error instanceof Error ? error.message : 'Error desconocido'
		}, { status: 500 });
	}
};
