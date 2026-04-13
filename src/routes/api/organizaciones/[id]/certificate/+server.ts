/**
 * Endpoint para eliminar certificados CSD de una organización
 * 
 * DELETE /api/organizaciones/[id]/certificate - Eliminar certificados CSD
 * 
 * SEGURIDAD:
 * - Rate limiting (máx 5 intentos por hora)
 * - Audit logging de intentos y resultados
 * - Solo administradores pueden eliminar certificados
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { checkRateLimit } from '$lib/server/security';
import { logAuditEvent } from '$lib/server/auditLog';

// Obtener credenciales de Facturapi desde variables de entorno
const FACTURAPI_USER_KEY = process.env.FACTURAPI_USER_KEY || '';

export const DELETE: RequestHandler = async ({ params, locals, request, getClientAddress }) => {
	try {
		// Validar autenticación
		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		// Aplicar rate limiting a operaciones sensibles (máx 5 deletions por hora)
		const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
		                getClientAddress?.() || 
		                'unknown';
		const rateLimitKey = `delete_cert:${locals.user.id}:${clientIP}`;
		const rateLimitCheck = checkRateLimit(rateLimitKey, 5, 60); // 5 intentos con 60 minutos de bloqueo

		if (!rateLimitCheck.allowed) {
			console.warn(`[DELETE CERT] Rate limit excedido para usuario ${locals.user.id} desde ${clientIP}`);
			
			const blockedUntilSeconds = rateLimitCheck.blockedUntil ? Math.ceil((rateLimitCheck.blockedUntil - Date.now()) / 1000) : 3600;
			
			await logAuditEvent({
				userId: locals.user.id,
				organizacionId: parseInt(params.id, 10),
				action: 'DELETE_CERTIFICATE',
				details: 'INTENTO BLOQUEADO: Rate limit excedido',
				ipAddress: clientIP
			});

			return json(
				{
					error: 'Demasiados intentos. Por favor, intenta más tarde.',
					retryAfter: blockedUntilSeconds
				},
				{ status: 429 }
			);
		}

		const organizacionId = parseInt(params.id, 10);
		if (isNaN(organizacionId)) {
			return json({ error: 'organizacion_id debe ser un número válido' }, { status: 400 });
		}

		const userId = locals.user.id;
		const pool = await getConnection();

		// 1. Verificar que el usuario sea administrador en esta organización
		const permissionCheck = await pool
			.query(
			`
				SELECT uo.rolid, r.nombre as RolNombre, c.idfacturapi, o.nombre as orgName
				FROM Usuario_Organizacion uo
				LEFT JOIN Roles r ON uo.rolid = r.id
				LEFT JOIN configuracion_organizacion c ON uo.organizacionid = c.organizacion_id
				LEFT JOIN organizaciones o ON uo.organizacionid = o.id
				WHERE uo.usuarioid = $1 AND uo.organizacionid = $2
			`,
			[userId, organizacionId]
		);

		if (permissionCheck.rows.length === 0) {
			// Registrar intento de eliminación no autorizado
			await logAuditEvent({
				userId,
				organizacionId,
				action: 'DELETE_CERTIFICATE',
				details: 'INTENTO FALLIDO: Usuario no tiene asociación con la organización',
				ipAddress: clientIP
			});

			return json(
				{ error: 'No tienes permiso para gestionar certificados de esta organización' },
				{ status: 403 }
			);
		}

		const rol = permissionCheck.rows[0];
		const facturapiBrgan_id = permissionCheck.rows[0].idfacturapi;
		const orgName = permissionCheck.rows[0].orgname || 'Desconocida';

		// Solo admin puede eliminar certificados (RolId = 3 = Administrador)
		if (rol.rolid !== 3) {
			// Registrar intento de eliminación con permisos insuficientes
			await logAuditEvent({
				userId,
				organizacionId,
				action: 'DELETE_CERTIFICATE',
				details: `INTENTO FALLIDO: Usuario tiene rol ${rol.rolnombre} (se requiere Admin)`,
				ipAddress: clientIP
			});

			return json(
				{ error: 'Solo administradores pueden eliminar certificados' },
				{ status: 403 }
			);
		}

		// 2. Eliminar en Facturapi
		if (!FACTURAPI_USER_KEY) {
			return json(
				{
					error: 'No se ha configurado la clave de Facturapi en el servidor',
					details: 'Verifica que FACTURAPI_USER_KEY esté configurada en las variables de entorno'
				},
				{ status: 500 }
			);
		}

		const facturapResponse = await fetch(
			`https://www.facturapi.io/v2/organizations/${facturapiBrgan_id}/certificate`,
			{
				method: 'DELETE',
				headers: {
					'Authorization': `Bearer ${FACTURAPI_USER_KEY}`
				}
			}
		);

		if (!facturapResponse.ok && facturapResponse.status !== 404) {
			const facturapError = await facturapResponse.text();
			console.error(`[DELETE CERT] Error de Facturapi (${facturapResponse.status}):`, facturapError);
			
			// Registrar fallo en Facturapi
			await logAuditEvent({
				userId,
				organizacionId,
				action: 'DELETE_CERTIFICATE',
				details: `FALLO EN FACTURAPI (${facturapResponse.status}): ${facturapError.substring(0, 200)}`,
				ipAddress: clientIP
			});
			
			// IMPORTANTE: Nunca retornar 401 cuando el error viene de Facturapi
			// porque el cliente lo interpretaría como sesión expirada
			// Retornar 502 (Bad Gateway) para indicar error en servicio externo
			return json(
				{
					error: 'Error al eliminar certificados en Facturapi',
					details: facturapError,
					facturapi_status: facturapResponse.status
				},
				{ status: 502 }
			);
		}

		// 3. Limpiar hashes en BD local
		try {
			// Usar try-catch por si las columnas no existen en versiones antiguas de BD
			await pool
				.query(
			`
					UPDATE configuracion_organizacion
					SET 
						csd_cer_hash = NULL,
						csd_key_hash = NULL
					WHERE organizacion_id = $1
				`,
			[organizacionId]
		);
		} catch (dbError) {
			// Si hay error, continuar de todas formas
			console.warn('[DELETE CERT] Aviso: No se pudieron limpiar hashes en BD (columnas podría no existir)');
		}

		// Registrar eliminación exitosa
		await logAuditEvent({
			userId,
			organizacionId,
			action: 'DELETE_CERTIFICATE',
			details: `Certificados CSD de "${orgName}" eliminados exitosamente. Facturapi ID: ${facturapiBrgan_id}`,
			ipAddress: clientIP
		});

		return json({
			success: true,
			message: 'Certificados CSD eliminados correctamente. No podrás emitir nuevas facturas hasta que subas nuevos certificados.'
		});

	} catch (error) {
		console.error('[DELETE CERT] Error al eliminar certificados:', error);
		return json(
			{
				error: 'Error al eliminar los certificados',
				details: error instanceof Error ? error.message : 'Error desconocido'
			},
			{ status: 500 }
		);
	}
};


