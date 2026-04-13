import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validarAccesoFuncion } from '$lib/server/validar-plan';

/**
 * GET /api/whatsapp/status?organizacionId=X
 * Verifica si la organización tiene una sesión de WhatsApp activa en BD.
 * Endpoint ligero (solo consulta DB, no inicializa Baileys).
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const organizacionId = url.searchParams.get('organizacionId');
		if (!organizacionId) {
			return json({ error: 'organizacionId requerido' }, { status: 400 });
		}

		// Validar acceso WhatsApp según plan
		const accesoWhatsApp = await validarAccesoFuncion(parseInt(organizacionId), 'whatsapp');
		if (!accesoWhatsApp.permitido) {
			return json({ error: accesoWhatsApp.mensaje }, { status: 403 });
		}

		const pool = await getConnection();

		const result = await pool
			.query(
			`
				SELECT 
					TelefonoWhatsApp, 
					Estado, 
					Activo, 
					UltimaActividad
				FROM Organizaciones_BaileysSession
				WHERE OrganizacionId = $1
					AND Activo = true
					AND Estado = 'activo'
				LIMIT 1
			`,
			[parseInt(organizacionId)]
		);

		if (result.rows.length === 0) {
			return json({
				configurado: false,
				telefono: null,
				message: 'WhatsApp no configurado para esta organización'
			});
		}

		const session = result.rows[0];
		return json({
			configurado: true,
			telefono: session.telefonowhatsapp,
			ultimaActividad: session.ultimaactividad
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
		console.error('[WHATSAPP STATUS]', errorMsg);
		return json({ error: errorMsg }, { status: 500 });
	}
};
