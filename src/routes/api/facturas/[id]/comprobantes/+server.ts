import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';

/**
 * GET /api/facturas/[id]/comprobantes?organizacionId=X
 * Obtiene los comprobantes subidos a nivel factura (para asignar a complemento de pago)
 */
export const GET: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { params, url } = event;
	const facturaId = params.id;
	const organizacionId = url.searchParams.get('organizacionId');

	if (!facturaId || !organizacionId) {
		return json({ success: false, error: 'facturaId y organizacionId son requeridos' }, { status: 400 });
	}

	if (isNaN(parseInt(facturaId)) || isNaN(parseInt(organizacionId))) {
		return json({ success: false, error: 'IDs inválidos' }, { status: 400 });
	}

	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	try {
		const pool = await getConnection();

		// Verificar que la factura pertenece a la organización
		const facturaCheck = await pool.query(
			`SELECT f.id FROM Facturas f
			 INNER JOIN Clientes cl ON f.clienteid = cl.id
			 WHERE f.id = $1 AND cl.organizacionid = $2`,
			[parseInt(facturaId), parseInt(organizacionId)]
		);

		if (facturaCheck.rows.length === 0) {
			return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
		}

		const result = await pool.query(
			`SELECT id, fechasubida, imagenmimetype, visto
			 FROM comprobantes_facturas
			 WHERE facturaid = $1
			 ORDER BY fechasubida DESC`,
			[parseInt(facturaId)]
		);

		return json({ success: true, comprobantes: result.rows });

	} catch (err) {
		console.error('[COMPROBANTES FACTURA] Error GET:', err);
		return json({ success: false, error: 'Error al obtener comprobantes' }, { status: 500 });
	}
};

/**
 * PATCH /api/facturas/[id]/comprobantes?organizacionId=X
 * Marca todos los comprobantes de la factura como vistos (para notificaciones)
 */
export const PATCH: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { params, url } = event;
	const facturaId = params.id;
	const organizacionId = url.searchParams.get('organizacionId');

	if (!facturaId || !organizacionId) {
		return json({ success: false, error: 'Parámetros requeridos' }, { status: 400 });
	}

	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	try {
		const pool = await getConnection();
		await pool.query(
			`UPDATE comprobantes_facturas SET visto = TRUE WHERE facturaid = $1 AND organizacionid = $2`,
			[parseInt(facturaId), parseInt(organizacionId)]
		);
		return json({ success: true });
	} catch (err) {
		console.error('[COMPROBANTES FACTURA] Error PATCH:', err);
		return json({ success: false, error: 'Error al actualizar' }, { status: 500 });
	}
};
