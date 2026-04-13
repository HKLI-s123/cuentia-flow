import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getOrRestoreSession, sendMessage, phoneToJid } from '$lib/server/baileys';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

// Límites de seguridad
const MAX_MENSAJE_LENGTH = 4096; // Límite de WhatsApp

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

		let body: any;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
		}

		const { mensaje, tipoMensaje } = body;

		if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
			return json({ error: 'El mensaje es requerido' }, { status: 400 });
		}

		const mensajeTrimmed = mensaje.trim();

		// Validar longitud del mensaje
		if (mensajeTrimmed.length > MAX_MENSAJE_LENGTH) {
			return json({
				error: `El mensaje no puede exceder ${MAX_MENSAJE_LENGTH} caracteres`
			}, { status: 400 });
		}

		// Validar tipoMensaje
		const tiposValidos = ['Recordatorio de pago', 'Dia de pago', 'Pago tardio', 'Emision de factura'];
		const tipoMensajeValidado = tiposValidos.includes(tipoMensaje) ? tipoMensaje : 'Recordatorio de pago';

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

		// === LÍMITE DIARIO: Máximo 1 recordatorio por factura por día ===
		const limitCheck = await pool
			.query(
			`
				SELECT COUNT(*) as total FROM Recordatorios
				WHERE FacturaId = $1 AND Estado = 'Enviado'
				AND CAST(FechaEnvio AS DATE) = CAST(NOW() AS DATE)
			`,
			[facturaId]
		);

		if (limitCheck.rows[0]?.total >= 1) {
			return json({
				success: false,
				error: 'Ya se envió un recordatorio para esta factura el día de hoy. Límite: 1 recordatorio por factura por día (correo o WhatsApp).'
			}, { status: 429 });
		}

		// === Verificar si la factura está cancelada ===
		const estadoCheck = await pool
			.query(
			'SELECT estado_factura_id FROM Facturas WHERE Id = $1',
			[facturaId]
		);
		if (estadoCheck.rows[0]?.estado_factura_id === 6) {
			return json({
				success: false,
				error: 'Esta factura está cancelada. No se pueden enviar recordatorios.'
			}, { status: 403 });
		}

		// === Verificar que el Agente IA no esté activo para esta factura ===
		const agenteCheck = await pool
			.query(
			'SELECT COALESCE(AgenteIAActivo, false) as AgenteIAActivo FROM Facturas WHERE Id = $1',
			[facturaId]
		);
		if (agenteCheck.rows[0]?.agenteiaactivo) {
			return json({
				success: false,
				error: 'El cobrador IA está activo para esta factura. Desactívalo para enviar recordatorios manualmente.'
			}, { status: 403 });
		}

		// Obtener datos de la factura y cliente
		const facturaResult = await pool
			.query(
			`
				SELECT
					f.id,
					f.numero_factura,
					c.id as ClienteId,
					c.telefonowhatsapp,
					c.codigopais,
					c.razonsocial,
					c.nombrecomercial
				FROM Facturas f
				INNER JOIN Clientes c ON f.clienteid = c.id
				WHERE f.id = $1 AND c.organizacionid = $2
			`,
			[facturaId, organizacionId]
		);

		if (!facturaResult.rows.length) {
			return json({ error: 'Factura no encontrada' }, { status: 404 });
		}

		const factura = facturaResult.rows[0];

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
				error: 'WhatsApp no está conectado. Configúralo en Configuración.'
			}, { status: 503 });
		}

		if (!socket.user) {
			return json({
				success: false,
				error: 'Sesión de WhatsApp reconectándose. Intenta de nuevo en unos segundos.'
			}, { status: 503 });
		}

		// Convertir número al JID de WhatsApp
		const jid = phoneToJid(factura.telefonowhatsapp, factura.codigopais);

		// Enviar solo mensaje de texto (sin PDF adjunto)
		const result = await sendMessage(sessionName, jid, {
			text: mensajeTrimmed
		});

		if (!result.success) {
			// Registrar recordatorio fallido en BD
			try {
				await pool
					.query(
			`
						INSERT INTO Recordatorios (
							FacturaId, TipoMensaje, Destinatario, Mensaje, FechaEnvio, MetodoEnvio, Estado, ErrorMessage, CreadoPor
						) VALUES (
							$1, $2, $3, $4, NOW(), $5, $6, $7, $8
						)
					`,
			[facturaId, tipoMensajeValidado, factura.telefonowhatsapp, mensajeTrimmed, 'Manual', 'Fallido', (result.error || 'Error desconocido').substring(0, 500), userId]
		);
			} catch (dbErr) {
				console.error('[WHATSAPP REMINDER] Error guardando log fallido:', dbErr);
			}

			return json({
				success: false,
				error: result.error || 'Error al enviar mensaje por WhatsApp'
			}, { status: 500 });
		}

		// Registrar recordatorio exitoso en BD
		try {
			await pool
				.query(
			`
					INSERT INTO Recordatorios (
						FacturaId, TipoMensaje, Destinatario, Mensaje, FechaEnvio, MetodoEnvio, Estado, MessageId, CreadoPor
					) VALUES (
						$1, $2, $3, $4, NOW(), $5, $6, $7, $8
					)
				`,
			[facturaId, tipoMensajeValidado, factura.telefonowhatsapp, mensajeTrimmed, 'Manual', 'Enviado', result.messageId || '', userId]
		);
		} catch (dbErr) {
			console.error('[WHATSAPP REMINDER] Error guardando log exitoso:', dbErr);
		}

		return json({
			success: true,
			message: 'Recordatorio enviado por WhatsApp',
			messageId: result.messageId,
			telefono: factura.telefonowhatsapp
		});

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
		console.error(`[WHATSAPP REMINDER] Error:`, errorMsg);
		return json({ error: errorMsg }, { status: 500 });
	}
};
