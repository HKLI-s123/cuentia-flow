import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import crypto from 'crypto';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';
import { checkRateLimit, getClientIP, secureLog } from '$lib/server/security';

/**
 * POST /api/pagos/[id]/generar-link?organizacionId=X
 * Genera un token público para que el cliente suba su comprobante de pago
 * El link expira en 7 días y es de un solo uso
 */
export const POST: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);
	if (!user) {
		return unauthorizedResponse('Token de autenticación requerido');
	}

	const { params, url } = event;
	const pagoId = params.id;
	const organizacionId = url.searchParams.get('organizacionId');

	if (!pagoId || !organizacionId) {
		return json({ success: false, error: 'pagoId y organizacionId son requeridos' }, { status: 400 });
	}

	// Validar acceso a la organización
	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	// Rate limit: máximo 20 generaciones de link por usuario cada 30 minutos
	const clientIP = getClientIP(event);
	const rateCheck = checkRateLimit(`generar_link_comprobante:${user.id}:${clientIP}`, 20, 30);
	if (!rateCheck.allowed) {
		return json({ success: false, error: 'Demasiados intentos. Intenta de nuevo más tarde.' }, { status: 429 });
	}

	try {
		const pool = await getConnection();

		// Verificar que el pago existe y pertenece a la organización
		const pagoResult = await pool.query(
			`
				SELECT p.id, p.comprobantebase64, p.tokencomprobante, p.tokenexpiracion,
					   COALESCE(p.cancelado, false) as cancelado
				FROM Pagos p
				INNER JOIN Facturas f ON p.facturaid = f.id
				INNER JOIN Clientes cl ON f.clienteid = cl.id
				WHERE p.id = $1 AND cl.organizacionid = $2
			`,
			[parseInt(pagoId), parseInt(organizacionId)]
		);

		if (pagoResult.rows.length === 0) {
			return json({ success: false, error: 'Pago no encontrado' }, { status: 404 });
		}

		const pago = pagoResult.rows[0];

		// No generar link para pagos cancelados
		if (pago.cancelado) {
			return json({ success: false, error: 'No se puede generar link para un pago cancelado' }, { status: 400 });
		}

		// Si ya tiene comprobante, no generar link
		if (pago.comprobantebase64) {
			return json({
				success: false,
				error: 'Este pago ya tiene un comprobante subido'
			}, { status: 400 });
		}

		// Si ya tiene un token vigente, retornarlo
		if (pago.tokencomprobante && pago.tokenexpiracion && new Date(pago.tokenexpiracion) > new Date()) {
			const linkPublico = `${event.url.origin}/comprobante/${pago.tokencomprobante}`;
			return json({
				success: true,
				link: linkPublico,
				token: pago.tokencomprobante,
				expira: pago.tokenexpiracion
			});
		}

		// Generar token seguro
		const token = crypto.randomBytes(32).toString('hex');
		const expiracion = new Date();
		expiracion.setDate(expiracion.getDate() + 7); // 7 días

		await pool.query(
			`
				UPDATE Pagos
				SET TokenComprobante = $2,
					TokenExpiracion = $3,
					UpdatedAt = NOW()
				WHERE Id = $1
			`,
			[parseInt(pagoId), token, expiracion]
		);

		const linkPublico = `${event.url.origin}/comprobante/${token}`;

		secureLog('info', `[GENERAR LINK] Link generado - PagoId: ${pagoId}, User: ${user.id}, IP: ${clientIP}, Expira: ${expiracion.toISOString()}`);

		return json({
			success: true,
			link: linkPublico,
			token,
			expira: expiracion.toISOString()
		});

	} catch (error) {
		console.error('[GENERAR LINK COMPROBANTE] Error:', error);
		return json({ success: false, error: 'Error al generar el link' }, { status: 500 });
	}
};
