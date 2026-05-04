import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import crypto from 'crypto';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';
import { checkRateLimit, getClientIP, secureLog } from '$lib/server/security';

/**
 * POST /api/facturas/[id]/generar-link?organizacionId=X
 * Genera un token público para que el cliente suba su comprobante de la factura.
 * El link expira en 7 días. Si ya existe un token vigente, lo renueva.
 */
export const POST: RequestHandler = async (event) => {
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

	let agregarEnNotasCliente = false;
	try {
		const body = await event.request.json();
		agregarEnNotasCliente = !!body?.agregarEnNotasCliente;
	} catch {
		agregarEnNotasCliente = false;
	}

	const clientIP = getClientIP(event);
	const rateCheck = checkRateLimit(`generar_link_cf:${user.id}:${clientIP}`, 20, 30);
	if (!rateCheck.allowed) {
		return json({ success: false, error: 'Demasiados intentos. Intenta de nuevo más tarde.' }, { status: 429 });
	}

	try {
		const pool = await getConnection();

		// Verificar que la factura existe y pertenece a la organización
		const facturaResult = await pool.query(
			`SELECT f.id, f.numero_factura, f.tokencomprobantecf, f.tokenexpiracioncf
			 FROM Facturas f
			 INNER JOIN Clientes cl ON f.clienteid = cl.id
			 WHERE f.id = $1 AND cl.organizacionid = $2`,
			[parseInt(facturaId), parseInt(organizacionId)]
		);

		if (facturaResult.rows.length === 0) {
			return json({ success: false, error: 'Factura no encontrada' }, { status: 404 });
		}

		// Generar nuevo token
		const token = crypto.randomBytes(32).toString('hex');
		const expiracion = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

		// Obtener el origin para construir la URL
		const origin = url.origin;
		const link = `${origin}/comprobante-factura/${token}`;

		if (agregarEnNotasCliente) {
			await pool.query(
				`UPDATE Facturas
				 SET tokencomprobantecf = $1,
				     tokenexpiracioncf = $2,
				     notascliente = CONCAT(COALESCE(notascliente, ''),
				       CASE WHEN COALESCE(notascliente, '') = '' THEN '' ELSE E'\n\n' END,
				       $3)
				 WHERE id = $4`,
				[token, expiracion, `Link para subir comprobante de pago: ${link}`, parseInt(facturaId)]
			);
		} else {
			await pool.query(
				`UPDATE Facturas
				 SET tokencomprobantecf = $1, tokenexpiracioncf = $2
				 WHERE id = $3`,
				[token, expiracion, parseInt(facturaId)]
			);
		}

		secureLog('info', `[LINK CF] Generado - FacturaId: ${facturaId}, Usuario: ${user.id}, IP: ${clientIP}`);

		return json({
			success: true,
			link,
			token,
			expira: expiracion.toISOString()
		});

	} catch (err) {
		secureLog('error', `[LINK CF] Error generando link - FacturaId: ${facturaId}`);
		console.error('[LINK CF] Error:', err);
		return json({ success: false, error: 'Error al generar el link' }, { status: 500 });
	}
};
