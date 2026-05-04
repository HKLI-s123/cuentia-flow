import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { checkRateLimit, getClientIP, validateImageMagicNumber, secureLog } from '$lib/server/security';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function validateToken(token: string | undefined): boolean {
	return !!(token && token.length === 64 && /^[a-f0-9]{64}$/.test(token));
}

/**
 * GET /api/comprobante-factura/[token]
 * Verificar si el token es válido y obtener info básica de la factura
 */
export const GET: RequestHandler = async (event) => {
	const { params } = event;
	const token = params.token;

	if (!validateToken(token)) {
		return json({ success: false, error: 'Link inválido' }, { status: 400 });
	}

	const validatedToken = token as string;

	const clientIP = getClientIP(event);
	const rateCheck = checkRateLimit(`comprobante_factura_get:${clientIP}`, 30, 15);
	if (!rateCheck.allowed) {
		return json({ success: false, error: 'Demasiados intentos. Espera unos minutos.' }, { status: 429 });
	}

	try {
		const pool = await getConnection();

		const result = await pool.query(
			`SELECT f.id, f.numero_factura, f.montototal, f.tokenexpiracioncf,
			        cl.razonsocial as clientenombre,
			        o.nombre as organizacion
			 FROM Facturas f
			 INNER JOIN Clientes cl ON f.clienteid = cl.id
			 INNER JOIN Organizaciones o ON cl.organizacionid = o.id
			 WHERE f.tokencomprobantecf = $1`,
			[validatedToken]
		);

		if (result.rows.length === 0) {
			secureLog('warn', `[COMPROBANTE FACTURA] Token GET inválido - IP: ${clientIP}, Token: ${validatedToken.substring(0, 8)}...`);
			return json({ success: false, error: 'Link inválido o expirado' }, { status: 404 });
		}

		const factura = result.rows[0];

		if (!factura.tokenexpiracioncf || new Date(factura.tokenexpiracioncf) < new Date()) {
			return json({ success: false, error: 'Este link ha expirado' }, { status: 404 });
		}

		// Verificar si ya se subió un comprobante con este token
		const existeResult = await pool.query(
			`SELECT id FROM comprobantes_facturas WHERE facturaid = $1 AND token_usado = $2`,
			[factura.id, validatedToken.substring(validatedToken.length - 16)]
		);

		if (existeResult.rows.length > 0) {
			return json({ success: false, error: 'Ya se subió un comprobante con este link' }, { status: 409 });
		}

		return json({
			success: true,
			factura: {
				numeroFactura: factura.numero_factura,
				monto: factura.montototal,
				clienteNombre: factura.clientenombre,
				organizacion: factura.organizacion
			}
		});

	} catch (err) {
		console.error('[COMPROBANTE FACTURA] Error GET:', err);
		return json({ success: false, error: 'Error de servidor' }, { status: 500 });
	}
};

/**
 * POST /api/comprobante-factura/[token]
 * El cliente sube su comprobante de pago de la factura
 */
export const POST: RequestHandler = async (event) => {
	const { params, request } = event;
	const token = params.token;

	if (!validateToken(token)) {
		return json({ success: false, error: 'Link inválido' }, { status: 400 });
	}

	const validatedToken = token as string;

	const clientIP = getClientIP(event);
	const rateCheck = checkRateLimit(`comprobante_factura_post:${clientIP}`, 10, 15);
	if (!rateCheck.allowed) {
		return json({
			success: false,
			error: 'Demasiados intentos. Por favor espera unos minutos e intenta de nuevo.'
		}, { status: 429 });
	}

	const contentLength = Number(request.headers.get('content-length') || '0');
	if (Number.isFinite(contentLength) && contentLength > 8 * 1024 * 1024) {
		return json({ success: false, error: 'Payload demasiado grande' }, { status: 413 });
	}

	try {
		const body = await request.json();
		const { imagenBase64, mimetype } = body;

		if (!imagenBase64 || !mimetype) {
			return json({ success: false, error: 'Debes seleccionar una imagen' }, { status: 400 });
		}

		if (!ALLOWED_MIMETYPES.includes(mimetype)) {
			return json({ success: false, error: 'Formato no permitido. Usa JPEG, PNG, WebP o GIF.' }, { status: 400 });
		}

		const base64Data = imagenBase64.includes(',') ? imagenBase64.split(',')[1] : imagenBase64;
		const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
		if (sizeBytes > MAX_IMAGE_SIZE) {
			return json({ success: false, error: 'La imagen excede el tamaño máximo de 5 MB' }, { status: 400 });
		}

		const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
		if (!base64Regex.test(base64Data)) {
			return json({ success: false, error: 'Imagen con formato inválido' }, { status: 400 });
		}

		const magicCheck = validateImageMagicNumber(base64Data, mimetype);
		if (!magicCheck.valid) {
			secureLog('warn', `[COMPROBANTE FACTURA] Magic number inválido - IP: ${clientIP}, Token: ${validatedToken.substring(0, 8)}...`);
			return json({ success: false, error: 'El archivo no es una imagen válida del tipo declarado' }, { status: 400 });
		}

		const pool = await getConnection();
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			// Buscar factura por token y bloquear fila para evitar doble consumo concurrente.
			const facturaResult = await client.query(
				`SELECT f.id, f.tokenexpiracioncf, cl.organizacionid
				 FROM Facturas f
				 INNER JOIN Clientes cl ON f.clienteid = cl.id
				 WHERE f.tokencomprobantecf = $1
				 FOR UPDATE`,
				[validatedToken]
			);

			if (facturaResult.rows.length === 0) {
				await client.query('ROLLBACK');
				secureLog('warn', `[COMPROBANTE FACTURA] Token POST inválido - IP: ${clientIP}, Token: ${validatedToken.substring(0, 8)}...`);
				return json({ success: false, error: 'Este link no es válido o ya fue utilizado' }, { status: 404 });
			}

			const factura = facturaResult.rows[0];

			if (!factura.tokenexpiracioncf || new Date(factura.tokenexpiracioncf) < new Date()) {
				await client.query('ROLLBACK');
				return json({ success: false, error: 'Este link no es válido o ya fue utilizado' }, { status: 404 });
			}

			const tokenParcial = validatedToken.substring(validatedToken.length - 16);

			// Verificar duplicado por token parcial
			const existeResult = await client.query(
				`SELECT id FROM comprobantes_facturas WHERE facturaid = $1 AND token_usado = $2`,
				[factura.id, tokenParcial]
			);

			if (existeResult.rows.length > 0) {
				await client.query('ROLLBACK');
				return json({ success: false, error: 'Ya se subió un comprobante con este link' }, { status: 409 });
			}

			const dataToStore = imagenBase64.includes(',') ? imagenBase64 : `data:${mimetype};base64,${imagenBase64}`;

			// Insertar comprobante e invalidar token en la factura de forma atómica.
			await client.query(
				`INSERT INTO comprobantes_facturas (facturaid, organizacionid, imagenbase64, imagenmimetype, fechasubida, ip_cliente, token_usado, visto)
				 VALUES ($1, $2, $3, $4, NOW(), $5, $6, FALSE)`,
				[factura.id, factura.organizacionid, dataToStore, mimetype, clientIP, tokenParcial]
			);

			const invalidateResult = await client.query(
				`UPDATE Facturas
				 SET tokencomprobantecf = NULL, tokenexpiracioncf = NULL
				 WHERE id = $1 AND tokencomprobantecf = $2`,
				[factura.id, validatedToken]
			);

			if (invalidateResult.rowCount === 0) {
				await client.query('ROLLBACK');
				return json({ success: false, error: 'Este link no es válido o ya fue utilizado' }, { status: 409 });
			}

			await client.query('COMMIT');

			secureLog('info', `[COMPROBANTE FACTURA] Subido exitosamente - FacturaId: ${factura.id}, IP: ${clientIP}, Size: ${sizeBytes}`);
			return json({ success: true, message: 'Comprobante recibido correctamente. ¡Gracias!' });
		} catch (txErr) {
			try {
				await client.query('ROLLBACK');
			} catch {
				// noop
			}
			throw txErr;
		} finally {
			client.release();
		}

	} catch (err) {
		secureLog('error', `[COMPROBANTE FACTURA] Error POST - IP: ${clientIP}, Token: ${validatedToken.substring(0, 8)}...`);
		console.error('[COMPROBANTE FACTURA] Error:', err);
		return json({ success: false, error: 'Error al procesar el comprobante. Intenta de nuevo.' }, { status: 500 });
	}
};
