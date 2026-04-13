import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { initializeBaileysSession, getSessionStatus } from '$lib/server/baileys';
import { encryptData } from '$lib/server/encryption';
import { checkRateLimit, getClientIP } from '$lib/server/security';
import { validarAccesoFuncion } from '$lib/server/validar-plan';
import qrcode from 'qrcode';

// Almacenar QRs generados temporalmente (en memoria)
const pendingQRs = new Map<string, { qrString: string; generatedAt: Date }>();

// Acciones válidas
const VALID_ACTIONS = ['start-qr', 'check-status', 'disconnect'];

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		let body: any;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
		}

		const { action } = body;

		// Validar acción
		if (!action || typeof action !== 'string' || !VALID_ACTIONS.includes(action)) {
			return json({ error: 'Acción no reconocida' }, { status: 400 });
		}

		// Obtener organizacionId del usuario
		const userId = locals.user.id;
		const pool = await getConnection();

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
		const sessionName = `org_${organizacionId}_session`;

		// Validar que el plan permita WhatsApp (solo para acciones que no sean check-status)
		if (action === 'start-qr') {
			const accesoWhatsApp = await validarAccesoFuncion(organizacionId, 'whatsapp');
			if (!accesoWhatsApp.permitido) {
				return json({ error: accesoWhatsApp.mensaje, requierePlan: true }, { status: 403 });
			}
		}

		// ========================================
		// ACCIÓN 1: Iniciar QR para nueva conexión
		// ========================================
		if (action === 'start-qr') {
			// Rate limit: máximo 6 intentos de QR por cada 15 minutos
			const rateLimitKey = `whatsapp_qr_${userId}`;
			const rateCheck = checkRateLimit(rateLimitKey, 6, 15);
			if (!rateCheck.allowed) {
				return json({
					error: 'Demasiados intentos de generación de QR. Intenta de nuevo en unos minutos.'
				}, { status: 429 });
			}

			// Variables para almacenar QR generado
			let generatedQR = '';

			// Inicializar sesión de Baileys
			const socket = await initializeBaileysSession(
				sessionName,
				async (qr: string) => {
					// Callback cuando se genera el QR
					generatedQR = qr;
					
					// Convertir a imagen PNG base64
					try {
						const qrImage = await qrcode.toDataURL(qr);
						pendingQRs.set(sessionName, {
							qrString: qrImage,
							generatedAt: new Date()
						});
					} catch (err) {
						console.error('Error generando imagen QR:', err);
					}
				},
				(error: string) => {
					console.error(`[WHATSAPP QR] Error en sesión ${sessionName}:`, error);
				}
			);

			// Esperar un poco para que se genere el QR
			await new Promise(resolve => setTimeout(resolve, 2000));

			const qrData = pendingQRs.get(sessionName);
			if (!qrData) {
				return json({
					success: true,
					status: 'esperando_qr',
					message: 'QR se generará en breve. Activa el endpoint de estado.'
				});
			}

			return json({
				success: true,
				status: 'qr_generado',
				qr: qrData.qrString,
				sessionId: sessionName
			});
		}

		// ========================================
		// ACCIÓN 2: Obtener estado de la sesión
		// ========================================
		if (action === 'check-status') {
			const status = getSessionStatus(sessionName);

			// Si está activo, guardar en BD
			if (status.status === 'activo') {
				try {
					// Sanitizar teléfono (máximo 20 chars)
					const telefonoLimpio = (status.telefono || '').substring(0, 20);

					// Verificar si ya existe registro
					const existing = await pool
						.query(
			`
							SELECT Id FROM Organizaciones_BaileysSession
							WHERE OrganizacionId = $1
						`,
			[organizacionId]
		);

					if (existing.rows.length === 0) {
						await pool
							.query(
			`
								INSERT INTO Organizaciones_BaileysSession (
									OrganizacionId, TelefonoWhatsApp, SessionName, Activo, Estado
								) VALUES (
									$1, $2, $3, true, $4
								)
							`,
			[organizacionId, telefonoLimpio, sessionName, 'activo']
		);

					} else {
						await pool
							.query(
			`
								UPDATE Organizaciones_BaileysSession
								SET TelefonoWhatsApp = $2,
									Estado = $3,
									Activo = true,
									UltimaActividad = NOW()
								WHERE OrganizacionId = $1
							`,
			[organizacionId, telefonoLimpio, 'activo']
		);
					}
				} catch (dbErr) {
					console.error('[WHATSAPP] Error guardando sesión en BD:', dbErr);
					// No fallar - la sesión sigue activa en memoria
				}
			}

			return json({
				success: true,
				status: status.status,
				telefono: status.telefono,
				ultimaActividad: status.ultimaActividad,
				error: status.error
			});
		}

		// ========================================
		// ACCIÓN 3: Desconectar teléfono
		// ========================================
		if (action === 'disconnect') {
			const { closeSession } = await import('$lib/server/baileys');
			await closeSession(sessionName);

			// Actualizar BD
			await pool
				.query(
			`
					UPDATE Organizaciones_BaileysSession
					SET Activo = false, Estado = 'desconectado'
					WHERE OrganizacionId = $1
				`,
			[organizacionId]
		);

			return json({ success: true, message: 'Sesión desconectada' });
		}

		return json({ error: 'Acción no reconocida' }, { status: 400 });

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
		console.error(`[WHATSAPP QR] Error:`, errorMsg);
		return json({ error: errorMsg }, { status: 500 });
	}
};
