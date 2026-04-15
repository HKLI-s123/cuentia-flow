/**
 * Endpoint para operaciones en organizaciones específicas
 * 
 * PUT  /api/organizaciones/[id]           - Editar datos fiscales
 * DELETE /api/organizaciones/[id]         - Eliminar organización
 * DELETE /api/organizaciones/[id]/certificate - Eliminar certificados CSD
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import {
	validateRequired,
	validateLength,
	validateEmail,
	validatePhone,
	validateZipCode,
	validateNoSQLInjection,
	validationError
} from '$lib/server/validation';
import { checkRateLimit } from '$lib/server/security';
import { logAuditEvent } from '$lib/server/auditLog';

// Obtener credenciales de Facturapi desde variables de entorno (se recorta por seguridad)
const FACTURAPI_USER_KEY = (process.env.FACTURAPI_USER_KEY || '').trim();

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		// Validar autenticación
		if (!locals.user) {
			return json(
				{ 
					error: 'No autorizado', 
					details: 'Tu sesión ha expirado. Por favor recarga la página e intenta de nuevo.' 
				}, 
				{ status: 401 }
			);
		}

		const organizacionId = parseInt(params.id, 10);
		if (isNaN(organizacionId)) {
			return json({ error: 'organizacion_id debe ser un número válido' }, { status: 400 });
		}

		const userId = locals.user.id;
		const body = await request.json();

		const pool = await getConnection();

		// 1. Verificar que el usuario sea administrador en esta organización
		const permissionCheck = await pool
			.query(
			`
				SELECT uo.rolid, r.nombre as RolNombre, c.idfacturapi
				FROM Usuario_Organizacion uo
				LEFT JOIN Roles r ON uo.rolid = r.id
				LEFT JOIN configuracion_organizacion c ON uo.organizacionid = c.organizacion_id
				WHERE uo.usuarioid = $1 AND uo.organizacionid = $2
			`,
			[userId, organizacionId]
		);

		if (permissionCheck.rows.length === 0) {
			return json({ error: 'No tienes permiso para editar esta organización' }, { status: 403 });
		}

		const rol = permissionCheck.rows[0];
		const facturapiBrgan_id = rol.idfacturapi;

		// Solo admin puede editar (RolId = 3 = Administrador)
		if (rol.rolid !== 3) {
			return json({ error: 'Solo administradores pueden editar organizaciones' }, { status: 403 });
		}

		// Verificar que tenemos el ID de Facturapi
		if (!facturapiBrgan_id) {
			return json(
				{ error: 'Esta organización no tiene un ID de Facturapi configurado' },
				{ status: 400 }
			);
		}

		// ========== VALIDACIONES DE CAMPOS ENVIADOS ==========

		// Validar longitud y formato de campos críticos
		if (body.nombreComercial || body.name) {
			const nombre = body.nombreComercial || body.name;
			const nameValidation = validateLength(nombre, 'name', 1, 255);
			if (!nameValidation.valid) {
				return json(
					validationError('name', nameValidation.error!, 400),
					{ status: 400 }
				);
			}

			const sqlCheck = validateNoSQLInjection(nombre);
			if (!sqlCheck.valid) {
				return json(
					validationError('name', sqlCheck.error!, 400),
					{ status: 400 }
				);
			}
		}

		if (body.razonSocial || body.legal_name) {
			const razonSocial = body.razonSocial || body.legal_name;
			const legalNameValidation = validateLength(razonSocial, 'legal_name', 1, 255);
			if (!legalNameValidation.valid) {
				return json(
					validationError('legal_name', legalNameValidation.error!, 400),
					{ status: 400 }
				);
			}

			const sqlCheck = validateNoSQLInjection(razonSocial);
			if (!sqlCheck.valid) {
				return json(
					validationError('legal_name', sqlCheck.error!, 400),
					{ status: 400 }
				);
			}
		}

		// Validar email si se proporciona
		if (body.emailCorporativo || body.support_email) {
			const email = body.emailCorporativo || body.support_email;
			const emailValidation = validateEmail(email);
			if (!emailValidation.valid) {
				return json(
					validationError('email', emailValidation.error!, 400),
					{ status: 400 }
				);
			}
		}

		// Validar teléfono si se proporciona
		if (body.telefono || body.phone) {
			const phone = body.telefono || body.phone;
			const phoneValidation = validatePhone(phone);
			if (!phoneValidation.valid) {
				return json(
					validationError('phone', phoneValidation.error!, 400),
					{ status: 400 }
				);
			}
		}

		// Validar dirección si se proporciona
		if (body.address) {
			if (!body.address.calle || !body.address.numeroExterior || 
			    !body.address.colonia || !body.address.ciudad || 
			    !body.address.estado || !body.address.codigoPostal) {
				return json(
					validationError('address', 'La dirección debe incluir: calle, número exterior, colonia, ciudad, estado y código postal', 400),
					{ status: 400 }
				);
			}

			const zipValidation = validateZipCode(body.address.codigoPostal);
			if (!zipValidation.valid) {
				return json(
					validationError('zip', zipValidation.error!, 400),
					{ status: 400 }
				);
			}
		}

		// 2. Obtener código SAT del régimen fiscal (tax_system)
		// En configuracion_organizacion guardamos el ID_Regimen; necesitamos el Codigo (SAT) para Facturapi
		let taxSystemCode: string | null = null;
		// 2A. Si viene el ID_Regimen, lo convertimos SIEMPRE a código SAT (preferido)
		if (body.regimenFiscal) {
			const regimenResult = await pool
				.query(
			`SELECT Codigo FROM Regimen WHERE ID_Regimen = $1`,
			[body.regimenFiscal]
		);

			if (regimenResult.rows.length === 0) {
				return json(
					{
						error: 'Régimen fiscal no válido',
						details: `El ID de régimen ${body.regimenFiscal} no existe en la base de datos`
					},
					{ status: 400 }
				);
			}

			// Aseguramos que siempre sea string, como requiere Facturapi ("601", "603", etc.)
			taxSystemCode = String(regimenResult.rows[0].codigo);
		} else if (body.tax_system) {
			// 2B. Como fallback, si viniera un código SAT directo, lo usamos
			taxSystemCode = String(body.tax_system);
		}

		if (!taxSystemCode) {
			return json(
				{
					error: 'Régimen fiscal requerido',
					details: 'Debes seleccionar un régimen fiscal válido para actualizar en Facturapi'
				},
				{ status: 400 }
			);
		}

		// 2. Preparar dirección en formato Facturapi
		let addressForFacturapi: any = undefined;
		if (body.address) {
			addressForFacturapi = {
				street: body.address.calle,
				exterior: body.address.numeroExterior,
				interior: body.address.numeroInterior || undefined,
				neighborhood: body.address.colonia,
				city: body.address.ciudad,
				municipality: body.address.ciudad,
				zip: body.address.codigoPostal,
				state: body.address.estado
			};
		}

		// 2. Preparar datos para Facturapi
		const facturapiaData = {
			name: body.name || body.nombreComercial,
			legal_name: body.legal_name || body.razonSocial,
			tax_system: taxSystemCode,
			address: addressForFacturapi,
			website: body.website || undefined,
			support_email: body.support_email || body.emailCorporativo || undefined,
			phone: body.phone || body.telefono || undefined
		};

		// 3. Actualizar en Facturapi
		if (FACTURAPI_USER_KEY) {
		} else {
		}
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
			`https://www.facturapi.io/v2/organizations/${facturapiBrgan_id}/legal`,
			{
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${FACTURAPI_USER_KEY}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(facturapiaData)
			}
		);

		if (!facturapResponse.ok) {
			const facturapError = await facturapResponse.text();
			console.error(`[PUT ORG] Error de Facturapi (${facturapResponse.status}):`, facturapError);
			
			// IMPORTANTE: Nunca retornar 401 cuando el error viene de Facturapi
			// porque el cliente lo interpretaría como sesión expirada
			// Retornar 502 (Bad Gateway) para indicar error en servicio externo
			return json(
				{
					error: 'Error al actualizar en Facturapi',
					details: facturapError,
					facturapi_status: facturapResponse.status
				},
				{ status: 502 }
			);
		}

		// 4. Actualizar en base de datos local
		await pool
			.query(
			`
				UPDATE configuracion_organizacion
				SET 
					nombre_comercial   = $2,
					email_corporativo  = $4,
					telefono           = $5,
					regimen_fiscal     = $3
				WHERE organizacion_id = $1
			`,
			[organizacionId, body.nombreComercial || body.name, body.regimenFiscal, body.emailCorporativo || body.support_email, body.telefono || body.phone]
		);

		return json({
			success: true,
			message: 'Datos fiscales actualizados correctamente'
		});

	} catch (error) {
		console.error('[PUT ORG] Error al actualizar organización:', error);
		return json(
			{
				error: 'Error al actualizar la organización'
			},
			{ status: 500 }
		);
	}
};

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
		const rateLimitKey = `delete_org:${locals.user.id}:${clientIP}`;
		const rateLimitCheck = checkRateLimit(rateLimitKey, 5, 60); // 5 intentos con 60 minutos de bloqueo

		if (!rateLimitCheck.allowed) {
			console.warn(`[DELETE ORG] Rate limit excedido para usuario ${locals.user.id} desde ${clientIP}`);
			const blockedUntilSeconds = rateLimitCheck.blockedUntil ? Math.ceil((rateLimitCheck.blockedUntil - Date.now()) / 1000) : 3600;
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
				SELECT uo.rolid, r.nombre as RolNombre, o.nombre
				FROM Usuario_Organizacion uo
				LEFT JOIN Roles r ON uo.rolid = r.id
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
				action: 'DELETE_ORGANIZATION',
				details: 'INTENTO FALLIDO: Usuario no tiene asociación con la organización',
				ipAddress: clientIP
			});

			return json(
				{ error: 'No tienes permiso para eliminar esta organización' },
				{ status: 403 }
			);
		}

		const rol = permissionCheck.rows[0];
		const orgName = rol.nombre || 'Desconocida';
		// Solo admin puede eliminar (RolId = 3 = Administrador)
		if (rol.rolid !== 3) {
			// Registrar intento de eliminación con permisos insuficientes
			await logAuditEvent({
				userId,
				organizacionId,
				action: 'DELETE_ORGANIZATION',
				details: `INTENTO FALLIDO: Usuario tiene rol ${rol.RolNombre} (se requiere Admin)`,
				ipAddress: clientIP
			});

			return json(
				{ error: 'Solo administradores pueden eliminar organizaciones' },
				{ status: 403 }
			);
		}

		// 2. Intentar eliminar la organización en Facturapi (si tiene idfacturapi configurado)
		const facturapiConfigResult = await pool
			.query(
			`SELECT idfacturapi FROM configuracion_organizacion WHERE organizacion_id = $1`,
			[organizacionId]
		);

		const facturapiOrgId: string | null = facturapiConfigResult.rows[0]?.idfacturapi || null;

		if (facturapiOrgId) {
			if (!FACTURAPI_USER_KEY) {
				console.error('[DELETE ORG] FACTURAPI_USER_KEY no configurada; no se puede eliminar en Facturapi');
				return json(
					{
						error: 'No se ha configurado la clave de Facturapi en el servidor',
						details:
							'Verifica que FACTURAPI_USER_KEY esté configurada en las variables de entorno antes de eliminar la organización'
					},
					{ status: 500 }
				);
			}

			const facturapiDeleteResponse = await fetch(
				`https://www.facturapi.io/v2/organizations/${facturapiOrgId}`,
				{
					method: 'DELETE',
					headers: {
						Authorization: `Bearer ${FACTURAPI_USER_KEY}`
					}
				}
			);

			if (!facturapiDeleteResponse.ok && facturapiDeleteResponse.status !== 404) {
				const errorBody = await facturapiDeleteResponse.text();
				console.error(
					`[DELETE ORG] Error al eliminar en Facturapi (${facturapiDeleteResponse.status}):`,
					errorBody
				);

				// Registrar fallo en Facturapi
				await logAuditEvent({
					userId,
					organizacionId,
					action: 'DELETE_ORGANIZATION',
					details: `FALLO EN FACTURAPI: ${errorBody.substring(0, 200)}`,
					ipAddress: clientIP
				});

				return json(
					{
						error: 'Error al eliminar organización en Facturapi',
						details: errorBody,
						facturapi_status: facturapiDeleteResponse.status
					},
					{ status: 502 }
				);
			}

		}

		// 3. Comenzar transacción para eliminar en cascada
		const client = await pool.connect();

		try {
			await client.query('BEGIN');

			// 4. Eliminar registros de auditoría de la organización
			await client.query(
			`DELETE FROM audit_log WHERE organizacion_id = $1`,
			[organizacionId]
		);

			// 5. Eliminar configuración de la organización
			await client.query(
			`DELETE FROM configuracion_organizacion WHERE organizacion_id = $1`,
			[organizacionId]
		);

			// 6. Eliminar asociaciones de usuarios con la organización
			await client.query(
			`DELETE FROM usuario_organizacion WHERE organizacionid = $1`,
			[organizacionId]
		);

			// 7. Eliminar la organización
			await client.query(
			`DELETE FROM organizaciones WHERE id = $1`,
			[organizacionId]
		);

			// Confirmar transacción
			await client.query('COMMIT');

			// Registrar eliminación exitosa
			await logAuditEvent({
				userId,
				organizacionId,
				action: 'DELETE_ORGANIZATION',
				details: `Organización "${orgName}" eliminada exitosamente. Facturapi: ${facturapiOrgId ? 'Sí' : 'No'}`,
				ipAddress: clientIP
			});

			return json({
				success: true,
				message: 'Organización eliminada correctamente'
			});
		} catch (transactionError) {
			await client.query('ROLLBACK');
			console.error(`[DELETE ORG] Error al eliminar (rollback ejecutado):`, transactionError);

			// Registrar fallo en transacción
			await logAuditEvent({
				userId,
				organizacionId,
				action: 'DELETE_ORGANIZATION',
				details: 'Error en transacción de eliminación',
				ipAddress: clientIP
			});

			throw transactionError;
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('[DELETE ORG] Error al eliminar organización:', error);
		return json(
			{
				error: 'Error al eliminar la organización'
			},
			{ status: 500 }
		);
	}
};
