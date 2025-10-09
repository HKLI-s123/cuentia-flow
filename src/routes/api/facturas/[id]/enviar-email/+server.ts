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
		// Obtener organizacionId del body
		const { organizacionId } = await request.json();

		if (!organizacionId) {
			return json({
				success: false,
				error: 'organizacionId es requerido para sistema multi-tenant'
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

		// Validar que el cliente tenga correo
		if (!factura.ClienteEmail) {
			return json({
				success: false,
				error: 'El cliente no tiene correo electrónico registrado en CorreoPrincipal'
			}, { status: 400 });
		}

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

		const nombreCliente = factura.ClienteNombreComercial || factura.ClienteRazonSocial;
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
								<td style="padding: 8px 0; text-align: right; font-size: 12px;">${factura.UUID}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; color: #6b7280;"><strong>Fecha de emisión:</strong></td>
								<td style="padding: 8px 0; text-align: right;">${factura.FechaEmision.split('T')[0].split('-').reverse().join('/')}</td>
							</tr>
							<tr style="border-top: 2px solid #e5e7eb;">
								<td style="padding: 12px 0; color: #6b7280; font-size: 16px;"><strong>Total:</strong></td>
								<td style="padding: 12px 0; text-align: right; font-size: 18px; color: #2563eb; font-weight: bold;">
									$${parseFloat(factura.MontoTotal).toFixed(2)} MXN
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
		const info = await transporter.sendMail(mailOptions);

		return json({
			success: true,
			message: 'Correo enviado exitosamente',
			messageId: info.messageId,
			destinatario: factura.ClienteEmail
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
