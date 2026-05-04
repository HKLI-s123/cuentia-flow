import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';

/**
 * POST /api/pagos/[id]/asignar-comprobante?organizacionId=X
 * Asigna un comprobante existente (subido a nivel factura) al pago especificado.
 * Body: { comprobanteFacturaId: number }
 */
export const POST: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { params, url, request } = event;
	const pagoId = params.id;
	const organizacionId = url.searchParams.get('organizacionId');

	if (!pagoId || !organizacionId) {
		return json({ success: false, error: 'pagoId y organizacionId son requeridos' }, { status: 400 });
	}

	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'JSON inválido' }, { status: 400 });
	}

	const { comprobanteFacturaId } = body;
	if (!comprobanteFacturaId) {
		return json({ success: false, error: 'comprobanteFacturaId es requerido' }, { status: 400 });
	}

	try {
		const pool = await getConnection();

		// Verificar que el pago existe y pertenece a la organización
		const pagoCheck = await pool.query(
			`SELECT p.id FROM Pagos p
			 INNER JOIN Facturas f ON p.facturaid = f.id
			 INNER JOIN Clientes cl ON f.clienteid = cl.id
			 WHERE p.id = $1 AND cl.organizacionid = $2`,
			[parseInt(pagoId), parseInt(organizacionId)]
		);

		if (pagoCheck.rows.length === 0) {
			return json({ success: false, error: 'Pago no encontrado' }, { status: 404 });
		}

		// Obtener el comprobante de factura
		const cfResult = await pool.query(
			`SELECT imagenbase64, imagenmimetype FROM comprobantes_facturas
			 WHERE id = $1 AND organizacionid = $2`,
			[parseInt(comprobanteFacturaId), parseInt(organizacionId)]
		);

		if (cfResult.rows.length === 0) {
			return json({ success: false, error: 'Comprobante no encontrado' }, { status: 404 });
		}

		const cf = cfResult.rows[0];

		// Copiar comprobante al pago e invalidar tokens de pago si los hubiera
		await pool.query(
			`UPDATE Pagos
			 SET ComprobanteBase64 = $2, ComprobanteMimetype = $3,
			     TokenComprobante = NULL, TokenExpiracion = NULL, UpdatedAt = NOW()
			 WHERE id = $1`,
			[parseInt(pagoId), cf.imagenbase64, cf.imagenmimetype]
		);

		// Marcar el comprobante de factura como visto
		await pool.query(
			`UPDATE comprobantes_facturas SET visto = TRUE WHERE id = $1`,
			[parseInt(comprobanteFacturaId)]
		);

		return json({ success: true });

	} catch (err) {
		console.error('[ASIGNAR COMPROBANTE] Error:', err);
		return json({ success: false, error: 'Error al asignar el comprobante' }, { status: 500 });
	}
};
