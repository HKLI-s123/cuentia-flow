/**
 * Endpoint para subir certificados CSD a una organización
 * 
 * Recibe:
 * - cer: Archivo .cer (certificado)
 * - key: Archivo .key (llave privada)
 * - password: Contraseña de la llave privada
 * - organizacion_id: ID de la organización
 * 
 * SEGURIDAD:
 * - Validación de tamaño de archivo (máx 5MB cada uno)
 * - Validación de fortaleza de contraseña
 * - Rate limiting (máx 10 intentos por hora)
 * - Audit logging de intentos y resultados
 * - Prevención de duplicados mediante hash SHA256
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import crypto from 'crypto';
import { validateFileExtension, validateFileSize, validationError, sanitizeFilename } from '$lib/server/validation';
import { checkRateLimit } from '$lib/server/security';
import { logAuditEvent } from '$lib/server/auditLog';

const FACTURAPI_USER_KEY = process.env.FACTURAPI_USER_KEY || '';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB por archivo

// Validar fortaleza de contraseña para certificados
function validateCertificatePassword(password: string): { valid: boolean; error?: string } {
	if (!password || typeof password !== 'string') {
		return { valid: false, error: 'La contraseña es requerida' };
	}

	if (password.length < 6) {
		return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres' };
	}

	// Verificar que contiene al menos un número
	if (!/\d/.test(password)) {
		return { valid: false, error: 'La contraseña debe contener al menos un número' };
	}

	// Advertencia: no pueden ser todas mayúsculas o minúsculas para seguridad extra
	if (password === password.toUpperCase() || password === password.toLowerCase()) {
		// Log pero no bloquear (algunas keys pueden ser así)
		console.warn('[CERT] Advertencia: Contraseña sin variación de mayúsculas/minúsculas');
	}

	return { valid: true };
}

export const PUT: RequestHandler = async (event) => {
	try {
		// 1. Verificar autenticación
		if (!event.locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		// Aplicar rate limiting (máx 10 intentos por hora)
		const clientIP = event.request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
		                event.getClientAddress?.() || 
		                'unknown';
		const rateLimitKey = `upload_cert:${event.locals.user.id}:${clientIP}`;
		const rateLimitCheck = checkRateLimit(rateLimitKey, 10, 60); // 10 intentos con 60 minutos de bloqueo

		if (!rateLimitCheck.allowed) {
			console.warn(`[CERT] Rate limit excedido para usuario ${event.locals.user.id}`);
			const blockedUntilSeconds = rateLimitCheck.blockedUntil ? Math.ceil((rateLimitCheck.blockedUntil - Date.now()) / 1000) : 3600;
			return json(
				{
					error: 'Demasiados intentos de carga. Por favor, intenta más tarde.',
					retryAfter: blockedUntilSeconds
				},
				{ status: 429 }
			);
		}

		// 2. Obtener datos del FormData
		const formData = await event.request.formData();
		const cerFile = formData.get('cer') as File | null;
		const keyFile = formData.get('key') as File | null;
		const password = formData.get('password') as string | null;
		const organizacionIdStr = formData.get('organizacion_id') as string | null;

		// 3. Validar datos requeridos
		if (!cerFile || !keyFile || !password || !organizacionIdStr) {
			return json({ 
				error: 'Faltan datos requeridos: cer, key, password, organizacion_id' 
			}, { status: 400 });
		}

		const organizacionId = parseInt(organizacionIdStr, 10);
		if (isNaN(organizacionId)) {
			return json({ error: 'organizacion_id debe ser un número válido' }, { status: 400 });
		}

		// 4. Validar tipos de archivo
		const cerExtensionCheck = validateFileExtension(cerFile.name, ['cer']);
		if (!cerExtensionCheck.valid) {
			await logAuditEvent({
				userId: event.locals.user.id,
				organizacionId,
				action: 'UPLOAD_CERTIFICATE',
				details: `FALLO: Extensión inválida para CER: ${cerFile.name}`,
				ipAddress: clientIP
			});
			return json(validationError('cer', cerExtensionCheck.error!, 400), { status: 400 });
		}

		const keyExtensionCheck = validateFileExtension(keyFile.name, ['key']);
		if (!keyExtensionCheck.valid) {
			await logAuditEvent({
				userId: event.locals.user.id,
				organizacionId,
				action: 'UPLOAD_CERTIFICATE',
				details: `FALLO: Extensión inválida para KEY: ${keyFile.name}`,
				ipAddress: clientIP
			});
			return json(validationError('key', keyExtensionCheck.error!, 400), { status: 400 });
		}

		// 5. Validar tamano de archivos
		const cerSizeCheck = validateFileSize(cerFile.size, MAX_FILE_SIZE);
		if (!cerSizeCheck.valid) {
			await logAuditEvent({
				userId: event.locals.user.id,
				organizacionId,
				action: 'UPLOAD_CERTIFICATE',
				details: `FALLO: Archivo CER demasiado grande: ${cerFile.size} bytes (máximo ${MAX_FILE_SIZE})`,
				ipAddress: clientIP
			});
			return json(validationError('cer', cerSizeCheck.error!, 400), { status: 400 });
		}

		const keySizeCheck = validateFileSize(keyFile.size, MAX_FILE_SIZE);
		if (!keySizeCheck.valid) {
			await logAuditEvent({
				userId: event.locals.user.id,
				organizacionId,
				action: 'UPLOAD_CERTIFICATE',
				details: `FALLO: Archivo KEY demasiado grande: ${keyFile.size} bytes (máximo ${MAX_FILE_SIZE})`,
				ipAddress: clientIP
			});
			return json(validationError('key', keySizeCheck.error!, 400), { status: 400 });
		}

		// 6. Validar fortaleza de contraseña
		const passwordCheck = validateCertificatePassword(password);
		if (!passwordCheck.valid) {
			await logAuditEvent({
				userId: event.locals.user.id,
				organizacionId,
				action: 'UPLOAD_CERTIFICATE',
				details: `FALLO: Contraseña débil - ${passwordCheck.error}`,
				ipAddress: clientIP
			});
			return json(validationError('password', passwordCheck.error!, 400), { status: 400 });
		}

		// 7. Sanitizar nombres de archivo
		const cerFilenameSanitized = sanitizeFilename(cerFile.name);
		const keyFilenameSanitized = sanitizeFilename(keyFile.name);
		// 8. Calcular hash de los archivos para validación de duplicados
		const cerArrayBuffer = await cerFile.arrayBuffer();
		const keyArrayBuffer = await keyFile.arrayBuffer();
		const cerHash = crypto.createHash('sha256').update(Buffer.from(cerArrayBuffer)).digest('hex');
		const keyHash = crypto.createHash('sha256').update(Buffer.from(keyArrayBuffer)).digest('hex');
		// 9. Obtener organización y su Facturapi ID
		const pool = await getConnection();
		
		// 9A. Validar que los CSD no existan en otra organización
		try {
			const csdDuplicateCheck = await pool
				.query(
			`
					SELECT COUNT(*) as total
					FROM configuracion_organizacion
					WHERE (csd_cer_hash = $1 OR csd_key_hash = $2)
					AND organizacion_id != $3
				`,
			[cerHash, keyHash, organizacionId]
		);

			if (csdDuplicateCheck.rows[0].total > 0) {
				await logAuditEvent({
					userId: event.locals.user.id,
					organizacionId,
					action: 'UPLOAD_CERTIFICATE',
					details: 'FALLO: CSD duplicado detectado en otra organización',
					ipAddress: clientIP
				});

				return json({
					error: 'CSD ya registrado',
					message: 'Estos certificados CSD ya están registrados en otra organización del sistema.',
					status_code: 'CSD_DUPLICADO'
				}, { status: 409 });
			}
		} catch (err) {
			console.warn('[CERT] No se pudo validar CSD duplicado (columnas podrían no existir aún):', err);
			// Las columnas csd_cer_hash y csd_key_hash podrían no existir aún; continuar sin validación
		}

		const orgResult = await pool
			.query(
			`
				SELECT o.id, c.idfacturapi
				FROM organizaciones o
				LEFT JOIN configuracion_organizacion c ON o.id = c.organizacion_id
				WHERE o.id = $1
			`,
			[organizacionId]
		);

		if (orgResult.rows.length === 0) {
			return json({ error: 'Organización no encontrada' }, { status: 404 });
		}

		const facturapiId = orgResult.rows[0].idfacturapi;
		if (!facturapiId) {
			return json({ 
				error: 'La organización no tiene un ID de Facturapi asociado' 
			}, { status: 400 });
		}

		// 10. Construir FormData usando APIs nativas (undici / Web)
		const uploadFormData = new FormData();
		
		const cerBuffer = Buffer.from(cerArrayBuffer);
		// Usar Blob para compatibilidad con fetch Web
		const cerBlob = new Blob([cerBuffer], { type: 'application/octet-stream' });
		uploadFormData.append('cer', cerBlob, cerFilenameSanitized);

		const keyBuffer = Buffer.from(keyArrayBuffer);
		const keyBlob = new Blob([keyBuffer], { type: 'application/octet-stream' });
		uploadFormData.append('key', keyBlob, keyFilenameSanitized);

		uploadFormData.append('password', password);
		let uploadResponse;
		try {
			uploadResponse = await fetch(
				`https://www.facturapi.io/v2/organizations/${facturapiId}/certificate`,
				{
					method: 'PUT',
					// NO establecer Content-Type; fetch lo hará con boundary correcto
					headers: {
						Authorization: `Bearer ${FACTURAPI_USER_KEY}`
					},
					body: uploadFormData
				}
			);
		} catch (fetchErr) {
			console.error('[FACTURAPI] ERROR EN FETCH:', fetchErr);
			
			await logAuditEvent({
				userId: event.locals.user.id,
				organizacionId,
				action: 'UPLOAD_CERTIFICATE',
				details: `ERROR EN FETCH: ${fetchErr instanceof Error ? fetchErr.message : 'Error desconocido'}`,
				ipAddress: clientIP
			});

			throw fetchErr;
		}

		// Si es exitoso (2xx), asumir que Facturapi procesó correctamente
		if (uploadResponse.ok) {
			// 11A. Guardar los hashes de CSD en la BD para futuras validaciones
			try {
				await pool
					.query(
			`
						UPDATE configuracion_organizacion
						SET csd_cer_hash = $2,
							csd_key_hash = $3,
							fecha_actualizacion = NOW()
						WHERE organizacion_id = $1
					`,
			[organizacionId, cerHash, keyHash]
		);
			} catch (dbErr) {
				console.error('[DB] Error al guardar hashes (no crítico):', dbErr);
				// No retornamos error aquí porque los certificados ya fueron subidos a Facturapi
			}

			// Registrar carga exitosa
			await logAuditEvent({
				userId: event.locals.user.id,
				organizacionId,
				action: 'UPLOAD_CERTIFICATE',
				details: `Certificados CSD subidos exitosamente. CER: ${cerFilenameSanitized}, KEY: ${keyFilenameSanitized}`,
				ipAddress: clientIP
			});
			
			// 11B. Retornar éxito
			return json({
				success: true,
				message: 'Certificados CSD subidos exitosamente a Facturapi',
				certificateInfo: {
					status: uploadResponse.status,
					statusText: uploadResponse.statusText
				}
			});
		}

		// Si NO es exitoso, intentar leer la respuesta
		let responseText: string = '';
		
		try {
			// Usar .blob() para evitar validación de Content-Type
			const blob = await uploadResponse.blob();
			responseText = await blob.text();
		} catch (readErr) {
			console.error('[FACTURAPI] ERROR AL LEER RESPUESTA:', readErr);
			responseText = `[No se pudo leer: ${readErr instanceof Error ? readErr.message : String(readErr)}]`;
		}

		// Intentar parsear como JSON
		let errorData;
		try {
			errorData = JSON.parse(responseText);
		} catch (e) {
			errorData = { 
				raw_response: responseText, 
				parse_error: (e as Error).message 
			};
		}
		
		console.error('[FACTURAPI] Parsed error:', errorData);

		// Registrar error en carga
		await logAuditEvent({
			userId: event.locals.user.id,
			organizacionId,
			action: 'UPLOAD_CERTIFICATE',
			details: `ERROR de Facturapi (${uploadResponse.status}): ${JSON.stringify(errorData).substring(0, 200)}`,
			ipAddress: clientIP
		});
		
		return json(
			{
				error: 'Error al subir certificados a Facturapi',
				status: uploadResponse.status,
				details: errorData
			},
			{ status: uploadResponse.status }
		);

	} catch (error) {
		console.error('[ERROR] ========== CATCH BLOCK ==========');
		console.error('[ERROR] Error al subir certificados:', error);
		if (error instanceof Error) {
			console.error('[ERROR] Error message:', error.message);
			console.error('[ERROR] Error stack:', error.stack);
		}
		return json(
			{
				error: 'Error en el servidor',
				details: error instanceof Error ? error.message : 'Error desconocido'
			},
			{ status: 500 }
		);
	}
};
