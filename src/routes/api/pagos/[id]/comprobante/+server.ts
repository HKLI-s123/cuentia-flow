import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest, unauthorizedResponse, validateOrganizationAccess } from '$lib/server/auth';
import { checkRateLimit, getClientIP, validateImageMagicNumber, secureLog } from '$lib/server/security';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/pagos/[id]/comprobante?organizacionId=X
 * Sube un comprobante de pago (imagen base64) asociado a un pago existente
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

	// Validar acceso a la organización
	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	// Rate limit: máximo 15 subidas de comprobante por usuario cada 30 minutos
	const clientIP = getClientIP(event);
	const rateCheck = checkRateLimit(`comprobante_pago:${user.id}:${clientIP}`, 15, 30);
	if (!rateCheck.allowed) {
		return json({ success: false, error: 'Demasiados intentos. Intenta de nuevo más tarde.' }, { status: 429 });
	}

	try {
		const body = await request.json();
		const { imagenBase64, mimetype } = body;

		// Validar campos requeridos
		if (!imagenBase64 || !mimetype) {
			return json({ success: false, error: 'imagenBase64 y mimetype son requeridos' }, { status: 400 });
		}

		// Validar mimetype
		if (!ALLOWED_MIMETYPES.includes(mimetype)) {
			return json({
				success: false,
				error: `Tipo de archivo no permitido. Formatos aceptados: JPEG, PNG, WebP, GIF`
			}, { status: 400 });
		}

		// Validar tamaño (la cadena base64 es ~33% más grande que el archivo original)
		const base64Data = imagenBase64.includes(',') ? imagenBase64.split(',')[1] : imagenBase64;
		const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
		if (sizeBytes > MAX_IMAGE_SIZE) {
			return json({
				success: false,
				error: `La imagen excede el tamaño máximo de 5 MB`
			}, { status: 400 });
		}

		// Validar que es base64 válido
		const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
		if (!base64Regex.test(base64Data)) {
			return json({ success: false, error: 'Imagen con formato inválido' }, { status: 400 });
		}

		// Validar magic number (firma real del archivo vs mimetype declarado)
		const magicCheck = validateImageMagicNumber(base64Data, mimetype);
		if (!magicCheck.valid) {
			secureLog('warn', `[COMPROBANTE] Magic number inválido - IP: ${clientIP}, User: ${user.id}, Mime declarado: ${mimetype}`);
			return json({
				success: false,
				error: 'El archivo no es una imagen válida del tipo declarado'
			}, { status: 400 });
		}

		const pool = await getConnection();

		// Verificar que el pago existe, pertenece a la organización y no está cancelado
		const pagoResult = await pool.query(
			`
				SELECT p.id, COALESCE(p.cancelado, false) as cancelado
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

		if (pagoResult.rows[0].cancelado) {
			return json({ success: false, error: 'No se puede subir comprobante a un pago cancelado' }, { status: 400 });
		}

		// Guardar comprobante
		const dataToStore = imagenBase64.includes(',') ? imagenBase64 : `data:${mimetype};base64,${imagenBase64}`;

		await pool.query(
			`
				UPDATE Pagos
				SET ComprobanteBase64 = $2,
					ComprobanteMimetype = $3,
					UpdatedAt = NOW()
				WHERE Id = $1
			`,
			[parseInt(pagoId), dataToStore, mimetype]
		);

		secureLog('info', `[COMPROBANTE] Subido exitosamente - PagoId: ${pagoId}, User: ${user.id}, IP: ${clientIP}, Mime: ${mimetype}, Size: ${sizeBytes}`);

		return json({ success: true, message: 'Comprobante guardado correctamente' }, { status: 200 });

	} catch (error) {
		secureLog('error', `[COMPROBANTE] Error al guardar - PagoId: ${pagoId}, User: ${user.id}, IP: ${clientIP}`);
		console.error('[COMPROBANTE PAGO] Error:', error);
		return json({
			success: false,
			error: 'Error al guardar el comprobante'
		}, { status: 500 });
	}
};

/**
 * GET /api/pagos/[id]/comprobante?organizacionId=X
 * Obtiene el comprobante (imagen base64) de un pago
 */
export const GET: RequestHandler = async (event) => {
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

	try {
		const pool = await getConnection();

		const result = await pool.query(
			`
				SELECT p.comprobantebase64, p.comprobantemimetype
				FROM Pagos p
				INNER JOIN Facturas f ON p.facturaid = f.id
				INNER JOIN Clientes cl ON f.clienteid = cl.id
				WHERE p.id = $1 AND cl.organizacionid = $2
			`,
			[parseInt(pagoId), parseInt(organizacionId)]
		);

		if (result.rows.length === 0) {
			return json({ success: false, error: 'Pago no encontrado' }, { status: 404 });
		}

		const row = result.rows[0];
		if (!row.comprobantebase64) {
			return json({ success: false, error: 'Este pago no tiene comprobante' }, { status: 404 });
		}

		return json({
			success: true,
			imageBase64: row.comprobantebase64,
			mimetype: row.comprobantemimetype
		});

	} catch (error) {
		console.error('[COMPROBANTE PAGO] Error al obtener:', error);
		return json({
			success: false,
			error: 'Error al obtener el comprobante'
		}, { status: 500 });
	}
};

/**
 * DELETE /api/pagos/[id]/comprobante?organizacionId=X
 * Elimina el comprobante de un pago
 */
export const DELETE: RequestHandler = async (event) => {
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

	const orgValidation = await validateOrganizationAccess(event, organizacionId);
	if (!orgValidation.valid) {
		return orgValidation.error!;
	}

	try {
		const pool = await getConnection();

		// Verificar que el pago pertenece a la organización
		const result = await pool.query(
			`
				SELECT p.id
				FROM Pagos p
				INNER JOIN Facturas f ON p.facturaid = f.id
				INNER JOIN Clientes cl ON f.clienteid = cl.id
				WHERE p.id = $1 AND cl.organizacionid = $2
			`,
			[parseInt(pagoId), parseInt(organizacionId)]
		);

		if (result.rows.length === 0) {
			return json({ success: false, error: 'Pago no encontrado' }, { status: 404 });
		}

		await pool.query(
			`
				UPDATE Pagos
				SET ComprobanteBase64 = NULL,
					ComprobanteMimetype = NULL,
					UpdatedAt = NOW()
				WHERE Id = $1
			`,
			[parseInt(pagoId)]
		);

		return json({ success: true, message: 'Comprobante eliminado' });

	} catch (error) {
		console.error('[COMPROBANTE PAGO] Error al eliminar:', error);
		return json({ success: false, error: 'Error al eliminar el comprobante' }, { status: 500 });
	}
};
