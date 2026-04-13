import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { checkRateLimit, getClientIP, validateImageMagicNumber, secureLog } from '$lib/server/security';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * POST /api/comprobante-publico/[token]
 * Endpoint PÚBLICO (sin autenticación) para que el cliente suba su comprobante
 * Seguridad: token único, expiración, rate limit por IP, validación de imagen
 */
export const POST: RequestHandler = async (event) => {
	const { params, request } = event;
	const token = params.token;

	if (!token || token.length !== 64) {
		return json({ success: false, error: 'Link inválido' }, { status: 400 });
	}

	// Validar que el token solo contiene hex
	if (!/^[a-f0-9]{64}$/.test(token)) {
		return json({ success: false, error: 'Link inválido' }, { status: 400 });
	}

	// Rate limit por IP: máximo 10 intentos cada 15 minutos
	const clientIP = getClientIP(event);
	const rateCheck = checkRateLimit(`comprobante_publico:${clientIP}`, 10, 15);
	if (!rateCheck.allowed) {
		return json({
			success: false,
			error: 'Demasiados intentos. Por favor espera unos minutos e intenta de nuevo.'
		}, { status: 429 });
	}

	try {
		const body = await request.json();
		const { imagenBase64, mimetype } = body;

		// Validar campos requeridos
		if (!imagenBase64 || !mimetype) {
			return json({ success: false, error: 'Debes seleccionar una imagen' }, { status: 400 });
		}

		// Validar mimetype
		if (!ALLOWED_MIMETYPES.includes(mimetype)) {
			return json({
				success: false,
				error: 'Formato no permitido. Usa JPEG, PNG, WebP o GIF.'
			}, { status: 400 });
		}

		// Validar tamaño
		const base64Data = imagenBase64.includes(',') ? imagenBase64.split(',')[1] : imagenBase64;
		const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
		if (sizeBytes > MAX_IMAGE_SIZE) {
			return json({
				success: false,
				error: 'La imagen excede el tamaño máximo de 5 MB'
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
			secureLog('warn', `[COMPROBANTE PÚBLICO] Magic number inválido - IP: ${clientIP}, Token: ${token.substring(0, 8)}..., Mime declarado: ${mimetype}`);
			return json({
				success: false,
				error: 'El archivo no es una imagen válida del tipo declarado'
			}, { status: 400 });
		}

		const pool = await getConnection();

		// Buscar pago por token
		const pagoResult = await pool.query(
			`
				SELECT p.id, p.tokenexpiracion, p.comprobantebase64,
					   cl.razonsocial as clienteNombre,
					   f.numero_factura
				FROM Pagos p
				INNER JOIN Facturas f ON p.facturaid = f.id
				INNER JOIN Clientes cl ON f.clienteid = cl.id
				WHERE p.tokencomprobante = $1
			`,
			[token]
		);

		if (pagoResult.rows.length === 0) {
			secureLog('warn', `[COMPROBANTE PÚBLICO] Token inválido en POST - IP: ${clientIP}, Token: ${token.substring(0, 8)}...`);
			return json({
				success: false,
				error: 'Este link no es válido o ya fue utilizado'
			}, { status: 404 });
		}

		const pago = pagoResult.rows[0];

		// Verificar expiración
		if (!pago.tokenexpiracion || new Date(pago.tokenexpiracion) < new Date()) {
			secureLog('info', `[COMPROBANTE PÚBLICO] Token expirado en POST - IP: ${clientIP}, PagoId: ${pago.id}`);
			return json({
				success: false,
				error: 'Este link no es válido o ya fue utilizado'
			}, { status: 404 });
		}

		// Verificar que no se haya subido ya
		if (pago.comprobantebase64) {
			return json({
				success: false,
				error: 'Ya se subió un comprobante para este pago'
			}, { status: 409 });
		}

		// Guardar comprobante e invalidar token
		const dataToStore = imagenBase64.includes(',') ? imagenBase64 : `data:${mimetype};base64,${imagenBase64}`;

		await pool.query(
			`
				UPDATE Pagos
				SET ComprobanteBase64 = $2,
					ComprobanteMimetype = $3,
					TokenComprobante = NULL,
					TokenExpiracion = NULL,
					UpdatedAt = NOW()
				WHERE Id = $1
			`,
			[pago.id, dataToStore, mimetype]
		);

		secureLog('info', `[COMPROBANTE PÚBLICO] Subido exitosamente - PagoId: ${pago.id}, IP: ${clientIP}, Mime: ${mimetype}, Size: ${sizeBytes}`);

		return json({
			success: true,
			message: 'Comprobante subido correctamente. ¡Gracias!'
		});

	} catch (error) {
		secureLog('error', `[COMPROBANTE PÚBLICO] Error en POST - IP: ${clientIP}, Token: ${token.substring(0, 8)}...`);
		console.error('[COMPROBANTE PÚBLICO] Error:', error);
		return json({
			success: false,
			error: 'Error al procesar el comprobante. Intenta de nuevo.'
		}, { status: 500 });
	}
};

/**
 * GET /api/comprobante-publico/[token]
 * Endpoint PÚBLICO para verificar si el token es válido y obtener info básica del pago
 */
export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const token = params.token;

	if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) {
		return json({ success: false, error: 'Link inválido' }, { status: 400 });
	}

	// Rate limit por IP: máximo 5 verificaciones cada 15 minutos (prevenir enumeración de tokens)
	const clientIP = getClientIP(event);
	const rateCheck = checkRateLimit(`comprobante_publico_info:${clientIP}`, 5, 15);
	if (!rateCheck.allowed) {
		return json({ success: false, error: 'Demasiados intentos' }, { status: 429 });
	}

	try {
		const pool = await getConnection();

		const result = await pool.query(
			`
				SELECT p.id, p.monto, p.fechapago, p.tokenexpiracion, p.comprobantebase64,
					   f.numero_factura,
					   o.nombre as organizacionNombre
				FROM Pagos p
				INNER JOIN Facturas f ON p.facturaid = f.id
				INNER JOIN Clientes cl ON f.clienteid = cl.id
				INNER JOIN Organizaciones o ON cl.organizacionid = o.id
				WHERE p.tokencomprobante = $1
			`,
			[token]
		);

		if (result.rows.length === 0) {
			secureLog('warn', `[COMPROBANTE PÚBLICO] Token inválido en GET - IP: ${clientIP}, Token: ${token.substring(0, 8)}...`);
			return json({ success: false, error: 'Link inválido o expirado' }, { status: 404 });
		}

		const pago = result.rows[0];

		if (!pago.tokenexpiracion || new Date(pago.tokenexpiracion) < new Date()) {
			return json({ success: false, error: 'Link inválido o expirado' }, { status: 404 });
		}

		if (pago.comprobantebase64) {
			return json({ success: false, error: 'Ya se subió un comprobante para este pago' }, { status: 409 });
		}

		return json({
			success: true,
			pago: {
				monto: pago.monto,
				fechaPago: pago.fechapago,
				numeroFactura: pago.numero_factura,
				organizacion: pago.organizacionNombre
			}
		});

	} catch (error) {
		console.error('[COMPROBANTE PÚBLICO] Error al verificar:', error);
		return json({ success: false, error: 'Error al verificar el link' }, { status: 500 });
	}
};
