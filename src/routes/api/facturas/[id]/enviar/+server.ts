import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import nodemailer from 'nodemailer';
import axios from 'axios';
import {
	SMTP_HOST,
	SMTP_PORT,
	SMTP_USER,
	SMTP_PASSWORD,
	SMTP_FROM_EMAIL,
	SMTP_FROM_NAME
} from '$env/static/private';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

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
				co.facturapi_key as FacturapiKey
			FROM Facturas f
			INNER JOIN Clientes c ON f.ClienteId = c.Id
			INNER JOIN configuracion_organizacion co ON c.OrganizacionId = co.organizacion_id
			WHERE f.Id = ? AND c.OrganizacionId = ?
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
		const pdfBuffer = Buffer.from(pdfResponse.data);

		// Descargar XML desde Facturapi usando la API key de la organización
		const xmlResponse = await axios.get(factura.XMLUrl, {
			auth: {
				username: factura.FacturapiKey,
				password: ''
			},
			responseType: 'arraybuffer'
		});
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
			OUTPUT INSERTED.Id
			VALUES (?, ?, ?, ?, ?, GETDATE(), ?, ?, ?)
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

		const recordatorioId = recordatorioResult[0]?.Id;

		// Obtener la URL base del servidor (para el tracking pixel)
		const protocol = event.url.protocol;
		const host = event.url.host;
		const baseUrl = `${protocol}//${host}`;
		const trackingPixelUrl = `${baseUrl}/api/tracking/email/${recordatorioId}`;

		// Convertir saltos de línea a HTML
		const mensajeHtml = mensaje.replace(/\n/g, '<br>');

		// Configurar el correo
		const mailOptions = {
			from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
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
		const info = await transporter.sendMail(mailOptions);

		// Actualizar el recordatorio con el MessageId
		const updateQuery = `
			UPDATE Recordatorios
			SET MessageId = ?
			WHERE Id = ?
		`;

		await db.query(updateQuery, [info.messageId, recordatorioId]);

		return json({
			success: true,
			message: 'Factura enviada exitosamente',
			messageId: info.messageId,
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
