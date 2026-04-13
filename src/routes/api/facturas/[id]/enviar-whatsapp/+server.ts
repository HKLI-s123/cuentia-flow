import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getOrRestoreSession, sendMessage, phoneToJid } from '$lib/server/baileys';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

export const POST: RequestHandler = async ({ request, params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const { id } = params;

		if (!id) {
			return json({ error: 'ID de factura inválido' }, { status: 400 });
		}

		const facturaId = parseInt(id);

		if (isNaN(facturaId)) {
			return json({ error: 'ID de factura inválido' }, { status: 400 });
		}

		const { incluirPDF = true } = await request.json();

		const userId = locals.user.id;
		const pool = await getConnection();

		// Obtener organización del usuario
		const org = await pool
			.query(
			`
				SELECT uo.organizacionid
				FROM Usuario_Organizacion uo
				WHERE uo.usuarioid = $1
				LIMIT 1
			`,
			[userId]
		);

		if (!org.rows.length) {
			return json({ error: 'Organización no encontrada' }, { status: 404 });
		}

		const organizacionId = org.rows[0].organizacionid;

		// Validar acceso WhatsApp según plan
		const accesoWhatsApp = await validarAccesoFuncion(organizacionId, 'whatsapp');
		if (!accesoWhatsApp.permitido) {
			return json({ error: accesoWhatsApp.mensaje }, { status: 403 });
		}

		// Obtener datos de la factura
		const facturaResult = await pool
			.query(
			`
				SELECT
					f.id,
					f.numero_factura,
					f.montototal,
					f.fechaemision,
					f.timbrado,
					f.pdfbase64,
					f.xmlbase64,
					f.uuid,
					c.id as ClienteId,
					c.telefonowhatsapp,
					c.codigopais,
					c.razonsocial,
					c.nombrecomercial,
					o.nombre as OrgNombre
				FROM Facturas f
				INNER JOIN Clientes c ON f.clienteid = c.id
				INNER JOIN Organizaciones o ON c.organizacionid = o.id
				WHERE f.id = $1 AND c.organizacionid = $2
			`,
			[facturaId, organizacionId]
		);

		if (!facturaResult.rows.length) {
			return json({ error: 'Factura no encontrada' }, { status: 404 });
		}

		const factura = facturaResult.rows[0];

		// Validaciones
		if (!factura.timbrado) {
			return json({
				success: false,
				error: 'Factura no está timbrada. No se puede enviar por WhatsApp.'
			}, { status: 422 });
		}

		if (!factura.telefonowhatsapp) {
			return json({
				success: false,
				error: 'El cliente no tiene teléfono WhatsApp configurado'
			}, { status: 422 });
		}

		// Obtener sesión de Baileys
		const sessionName = `org_${organizacionId}_session`;
		const socket = await getOrRestoreSession(sessionName);

		if (!socket) {
			return json({
				success: false,
				error: 'Teléfono WhatsApp no está conectado. Configúralo en Configuración.'
			}, { status: 503 });
		}

		if (!socket.user) {
			return json({
				success: false,
				error: 'Sesión de WhatsApp reconectándose. Intenta de nuevo en unos segundos.'
			}, { status: 503 });
		}

		// Construir mensaje
		const clienteName = factura.nombrecomercial || factura.razonsocial;
		const orgName = factura.orgnombre;
		const fechaFormateada = (() => {
			const d = new Date(factura.fechaemision);
			return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
		})();
		const montoFormateado = parseFloat(factura.montototal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

		const uuidLine = factura.uuid ? `\n🔑 *UUID:* ${factura.uuid}` : '';

		// Plantillas de mensaje (se elige una aleatoriamente)
		const templates = [
			// Versión 1 — Formal y cordial
			`Estimado(a) *${clienteName}*,

Le saludamos cordialmente de parte de *${orgName}*.

Le informamos que se ha generado la siguiente factura electrónica (CFDI) a su nombre:

📄 *Folio:* ${factura.numero_factura}
💰 *Monto Total:* $${montoFormateado} MXN
📅 *Fecha de Emisión:* ${fechaFormateada}${uuidLine}

Adjunto a este mensaje encontrará el archivo PDF de su factura para su revisión y registros.

Si tiene alguna duda o requiere información adicional, no dude en contactarnos.

¡Gracias por su preferencia! 🙏

_${orgName}_`,

			// Versión 2 — Directa y profesional
			`Hola *${clienteName}* 👋

Desde *${orgName}* le hacemos llegar su comprobante fiscal digital:

📄 Folio: *${factura.numero_factura}*
💲 Total: *$${montoFormateado} MXN*
🗓️ Emisión: *${fechaFormateada}*${uuidLine}

📎 Encontrará el PDF adjunto a este mensaje.

Quedamos a sus órdenes para cualquier aclaración.

Saludos cordiales,
_${orgName}_`,

			// Versión 3 — Amigable y cercana
			`¡Buen día, *${clienteName}*! 😊

Le compartimos su factura emitida por *${orgName}*:

🧾 *Folio:* ${factura.numero_factura}
💰 *Total:* $${montoFormateado} MXN
📅 *Fecha:* ${fechaFormateada}${uuidLine}

El archivo PDF está adjunto para su comodidad. Le pedimos revisarlo y, si todo está en orden, confirmarnos su recepción.

¡Muchas gracias por confiar en nosotros! 🤝

_${orgName}_`,

			// Versión 4 — Breve y ejecutiva
			`*${clienteName}*, buen día.

Le notificamos la emisión de su factura:

📄 *${factura.numero_factura}*
💰 *$${montoFormateado} MXN*
📅 ${fechaFormateada}${uuidLine}

Adjuntamos el PDF correspondiente. Quedo al pendiente ante cualquier duda.

Atentamente,
_${orgName}_`,

			// Versión 5 — Cálida y detallada
			`Hola *${clienteName}*, ¿cómo está? 🙂

De parte del equipo de *${orgName}*, le enviamos su factura electrónica con los siguientes datos:

📄 *Folio:* ${factura.numero_factura}
💰 *Monto:* $${montoFormateado} MXN
📅 *Fecha de emisión:* ${fechaFormateada}${uuidLine}

Le adjuntamos el PDF para sus registros contables. Si necesita el XML o tiene alguna consulta, con mucho gusto le atendemos.

¡Que tenga un excelente día! ☀️

_${orgName}_`
		];

		const messageText = templates[Math.floor(Math.random() * templates.length)];

		// Convertir número al JID de WhatsApp
		const jid = phoneToJid(factura.telefonowhatsapp, factura.codigopais);

		// Enviar mensaje con PDF si está disponible
		const result = await sendMessage(sessionName, jid, {
			text: messageText,
			caption: `Factura #${factura.numero_factura}`,
			document: incluirPDF && factura.pdfbase64
				? Buffer.from(factura.pdfbase64, 'base64')
				: undefined,
			fileName: `Factura_${factura.numero_factura}.pdf`
		});

		if (!result.success) {
			// Registrar intento fallido
			try {
				await pool
					.query(
			`
						INSERT INTO FacturaEnvios (
							FacturaId, OrganizacionId, ClienteId, Canal, EstadoEnvio, MensajeError, FechaCreacion
						) VALUES (
							$1, $2, $3, $4, $5, $6, NOW()
						)
					`,
			[facturaId, organizacionId, factura.clienteid, 'whatsapp', 'error', (result.error || 'Error desconocido').substring(0, 500)]
		);
			} catch (dbErr) {
				console.error('[WHATSAPP SEND] Error guardando log de envío fallido:', dbErr);
			}

			return json({
				success: false,
				error: result.error || 'Error al enviar mensaje'
			}, { status: 500 });
		}

		// Registrar envío exitoso
		try {
			await pool
				.query(
			`
					INSERT INTO FacturaEnvios (
						FacturaId, OrganizacionId, ClienteId, Canal, EstadoEnvio, FechaEnvio, IdMensajeWhatsApp, FechaCreacion
					) VALUES (
						$1, $2, $3, $4, $5, NOW(), $6, NOW()
					)
				`,
			[facturaId, organizacionId, factura.clienteid, 'whatsapp', 'enviado', result.messageId || '']
		);
		} catch (dbErr) {
			console.error('[WHATSAPP SEND] Error guardando log de envío exitoso:', dbErr);
		}

		return json({
			success: true,
			message: 'Factura enviada por WhatsApp',
			messageId: result.messageId,
			telefono: factura.telefonowhatsapp
		});

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
		console.error(`[WHATSAPP SEND] Error:`, errorMsg);
		return json({ error: errorMsg }, { status: 500 });
	}
};
