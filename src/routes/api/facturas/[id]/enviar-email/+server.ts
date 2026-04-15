import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import axios from 'axios';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { RESEND_API_KEY, RESEND_FROM } from '$lib/server/email-config';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

// Límites de seguridad
const MAX_ASUNTO_LENGTH = 200;
const MAX_MENSAJE_LENGTH = 5000;
const MAX_CC_LENGTH = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sanitizar texto para prevenir XSS en HTML
function sanitizeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

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
		let body: any;
		try {
			body = await request.json();
		} catch {
			return json({ success: false, error: 'Cuerpo de solicitud inválido' }, { status: 400 });
		}

		const { organizacionId, destinatario, cc, asunto, mensaje } = body;

		if (!organizacionId || isNaN(Number(organizacionId))) {
			return json({
				success: false,
				error: 'organizacionId es requerido y debe ser numérico'
			}, { status: 400 });
		}

		// Validar acceso a envío de email según plan
		const accesoEmail = await validarAccesoFuncion(parseInt(organizacionId), 'email');
		if (!accesoEmail.permitido) {
			return json({ success: false, error: accesoEmail.mensaje }, { status: 403 });
		}

		// Validar campos requeridos
		if (!destinatario || !asunto || !mensaje) {
			return json({
				success: false,
				error: 'Los campos destinatario, asunto y mensaje son requeridos'
			}, { status: 400 });
		}

		// Validar formato de email del destinatario
		const destinatarioTrimmed = String(destinatario).trim();
		if (!EMAIL_REGEX.test(destinatarioTrimmed)) {
			return json({
				success: false,
				error: 'El formato del correo destinatario no es válido'
			}, { status: 400 });
		}

		// Validar CC si existe
		const ccTrimmed = cc ? String(cc).trim() : '';
		if (ccTrimmed) {
			if (ccTrimmed.length > MAX_CC_LENGTH) {
				return json({
					success: false,
					error: `El campo CC no puede exceder ${MAX_CC_LENGTH} caracteres`
				}, { status: 400 });
			}
			const ccEmails = ccTrimmed.split(',').map((e: string) => e.trim()).filter(Boolean);
			for (const email of ccEmails) {
				if (!EMAIL_REGEX.test(email)) {
					return json({
						success: false,
						error: `Correo CC inválido: ${email}`
					}, { status: 400 });
				}
			}
		}

		// Validar longitudes
		const asuntoTrimmed = String(asunto).trim();
		const mensajeTrimmed = String(mensaje).trim();

		if (asuntoTrimmed.length > MAX_ASUNTO_LENGTH) {
			return json({
				success: false,
				error: `El asunto no puede exceder ${MAX_ASUNTO_LENGTH} caracteres`
			}, { status: 400 });
		}

		if (mensajeTrimmed.length > MAX_MENSAJE_LENGTH) {
			return json({
				success: false,
				error: `El mensaje no puede exceder ${MAX_MENSAJE_LENGTH} caracteres`
			}, { status: 400 });
		}

		// Verificar que el usuario pertenece a la organización
		const orgCheckQuery = `
			SELECT 1 FROM usuario_organizacion
			WHERE usuarioid = $1 AND organizacionid = $2
		`;
		const orgCheck = await db.query(orgCheckQuery, [user.id, organizacionId]);
		if (!orgCheck || orgCheck.length === 0) {
			return json({
				success: false,
				error: 'No tienes acceso a esta organización'
			}, { status: 403 });
		}

		// Límite diario: máximo 1 recordatorio por factura por día
		const limitQuery = `
			SELECT COUNT(*) as total FROM Recordatorios
			WHERE FacturaId = $1 AND Estado = 'Enviado'
			AND CAST(FechaEnvio AS DATE) = CURRENT_DATE
		`;
		const limitResult = await db.query(limitQuery, [facturaId]);
		if (limitResult && parseInt(limitResult[0]?.total) >= 1) {
			return json({
				success: false,
				error: 'Ya se envió un recordatorio para esta factura el día de hoy. Límite: 1 recordatorio por factura por día (correo o WhatsApp).'
			}, { status: 429 });
		}

		// Verificar si la factura está cancelada
		const estadoCheck = await db.query(
			'SELECT estado_factura_id FROM Facturas WHERE Id = $1',
			[facturaId]
		);
		if (estadoCheck && estadoCheck[0]?.estado_factura_id === 6) {
			return json({
				success: false,
				error: 'Esta factura está cancelada. No se pueden enviar recordatorios.'
			}, { status: 403 });
		}

		// Verificar que el Agente IA no esté activo para esta factura
		const agenteCheck = await db.query(
			'SELECT COALESCE(AgenteIAActivo, false) as AgenteIAActivo FROM Facturas WHERE Id = $1',
			[facturaId]
		);
		if (agenteCheck && agenteCheck[0]?.agenteiactivo) {
			return json({
				success: false,
				error: 'El cobrador IA está activo para esta factura. Desactívalo para enviar recordatorios manualmente.'
			}, { status: 403 });
		}

		// Obtener información de la factura con el correo del cliente y la API key
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

		// Sanitizar y convertir el mensaje de texto plano a HTML con saltos de línea
		const mensajeHtml = sanitizeHtml(mensajeTrimmed).replace(/\n/g, '<br>');
		const asuntoSanitizado = sanitizeHtml(asuntoTrimmed);

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
			VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9)
			RETURNING id
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

		const recordatorioId = recordatorioResult[0]?.id;

		// Obtener la URL base del servidor (para el tracking pixel)
		const protocol = event.url.protocol;
		const host = event.url.host;
		const baseUrl = `${protocol}//${host}`;
		const trackingPixelUrl = `${baseUrl}/api/tracking/email/${recordatorioId}`;

		// Enviar correo con Resend
		const resendPayload: any = {
			from: RESEND_FROM || 'no-reply@cuentia.mx',
			to: destinatarioTrimmed,
			subject: asuntoTrimmed,
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
					content: pdfBase64Attachment,
					type: 'application/pdf'
				},
				{
					filename: `Factura_${numeroFactura}.xml`,
					content: xmlBase64Attachment,
					type: 'application/xml'
				}
			]
		};

		if (cc) {
			resendPayload.cc = cc;
		}

		const resendResponse = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${RESEND_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(resendPayload)
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
			message: 'Correo enviado exitosamente',
			messageId: resendData.id,
			destinatario: destinatarioTrimmed
		});

	} catch (error) {
		console.error('Error al enviar correo:', error);
		return json({
			success: false,
			error: 'Error al enviar el correo electrónico'
		}, { status: 500 });
	}
};
