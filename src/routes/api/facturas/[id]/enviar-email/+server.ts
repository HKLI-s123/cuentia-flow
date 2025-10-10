import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import nodemailer from 'nodemailer';
import axios from 'axios';
import { FACTURAPI_KEY } from '$env/static/private';
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
		// Obtener organizacionId y datos del formulario del body
		const { organizacionId, destinatario, cc, asunto, mensaje } = await request.json();

		if (!organizacionId) {
			return json({
				success: false,
				error: 'organizacionId es requerido para sistema multi-tenant'
			}, { status: 400 });
		}

		// Validar campos requeridos
		if (!destinatario || !asunto || !mensaje) {
			return json({
				success: false,
				error: 'Los campos destinatario, asunto y mensaje son requeridos'
			}, { status: 400 });
		}

		// Obtener información de la factura con el correo del cliente
		// IMPORTANTE: Filtrar por organizacionId para multi-tenant
		const facturaQuery = `
			SELECT
				f.Id,
				f.numero_factura,
				f.MontoTotal,
				f.FechaEmision,
				f.UUID,
				f.Timbrado,
				f.PDFUrl,
				f.XMLUrl,
				c.RazonSocial as ClienteRazonSocial,
				c.NombreComercial as ClienteNombreComercial,
				c.RFC as ClienteRFC,
				c.CorreoPrincipal as ClienteEmail
			FROM Facturas f
			INNER JOIN Clientes c ON f.ClienteId = c.Id
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

		// Ya no validamos el correo del cliente porque lo recibimos del formulario
		// El usuario puede personalizar el destinatario

		// Validar que existan las URLs de PDF y XML
		if (!factura.PDFUrl || !factura.XMLUrl) {
			return json({
				success: false,
				error: 'La factura no tiene PDF o XML disponibles'
			}, { status: 400 });
		}

		// Descargar PDF desde Facturapi
		const pdfResponse = await axios.get(factura.PDFUrl, {
			auth: {
				username: FACTURAPI_KEY,
				password: ''
			},
			responseType: 'arraybuffer'
		});
		const pdfBuffer = Buffer.from(pdfResponse.data);

		// Descargar XML desde Facturapi
		const xmlResponse = await axios.get(factura.XMLUrl, {
			auth: {
				username: FACTURAPI_KEY,
				password: ''
			},
			responseType: 'arraybuffer'
		});
		const xmlBuffer = Buffer.from(xmlResponse.data);

		// Configurar transporte SMTP
		const transporter = nodemailer.createTransport({
			host: SMTP_HOST,
			port: parseInt(SMTP_PORT),
			secure: false, // true para 465, false para otros puertos
			auth: {
				user: SMTP_USER,
				pass: SMTP_PASSWORD
			},
			tls: {
				// No fallar en certificados inválidos
				rejectUnauthorized: false
			}
		});

		const numeroFactura = factura.numero_factura;

		// Convertir el mensaje de texto plano a HTML con saltos de línea
		const mensajeHtml = mensaje.replace(/\n/g, '<br>');

		// Primero guardar el recordatorio en la base de datos para obtener el ID
		const insertQuery = `
			INSERT INTO Recordatorios (
				FacturaId,
				TipoMensaje,
				Destinatario,
				CC,
				Asunto,
				Mensaje,
				FechaEnvio,
				MetodoEnvio,
				Estado,
				CreadoPor
			)
			OUTPUT INSERTED.Id
			VALUES (?, ?, ?, ?, ?, ?, GETDATE(), ?, ?, ?)
		`;

		const recordatorioResult = await db.query(insertQuery, [
			facturaId,
			'CORREO',
			destinatario,
			cc || null,
			asunto,
			mensaje,
			'Manual',
			'Enviado',
			user.id || null
		]);

		const recordatorioId = recordatorioResult[0]?.Id;

		// Obtener la URL base del servidor (para el tracking pixel)
		const protocol = event.url.protocol;
		const host = event.url.host;
		const baseUrl = `${protocol}//${host}`;
		const trackingPixelUrl = `${baseUrl}/api/tracking/email/${recordatorioId}`;

		// Configurar el correo con los datos del formulario y tracking pixel
		const mailOptions = {
			from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
			to: destinatario,
			cc: cc || undefined, // Solo agregar CC si existe
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
			message: 'Correo enviado exitosamente',
			messageId: info.messageId,
			destinatario: destinatario
		});

	} catch (error) {
		console.error('Error al enviar correo:', error);
		return json({
			success: false,
			error: 'Error al enviar el correo electrónico',
			details: error instanceof Error ? error.message : 'Error desconocido'
		}, { status: 500 });
	}
};
