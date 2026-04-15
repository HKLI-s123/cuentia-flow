import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { generateAccessToken, generateRefreshToken } from '$lib/server/tokens';
import {
	validateRequired,
	validationError,
	validateLength,
	validateRFC,
	validateEmail,
	validatePhone,
	validateNoSQLInjection,
	validateZipCode
} from '$lib/server/validation';
import { PLAN_LIMITS } from '$lib/server/stripe';

// Variable de entorno para la API de Facturapi
const FACTURAPI_USER_KEY = process.env.FACTURAPI_USER_KEY || '';

const PLAN_NOMBRES: Record<string, string> = {
	free: 'Gratuito',
	basico: 'Básico',
	pro: 'Profesional',
	enterprise: 'Empresarial'
};

export const POST: RequestHandler = async (event) => {
	try {
		// 1. Verificar autenticación
		if (!event.locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const user = event.locals.user;

		// 2. Obtener datos del body
		const body = await event.request.json();
		const { name, legal_name, tax_id, tax_system, email, phone, website, address } = body;

		// 3. Validar datos requeridos
		const validationChecks = [
			validateRequired(name, 'name'),
			validateRequired(legal_name, 'legal_name'),
			validateRequired(tax_id, 'tax_id'),
			validateRequired(tax_system, 'tax_system'),
			validateRequired(email, 'email'),
			validateRequired(address, 'address')
		];
		const requiredError = validationChecks.find((v) => !v.valid);
		if (requiredError) {
			return json(validationError(requiredError.field!, requiredError.error!, 400), { status: 400 });
		}

		const nameValidation = validateLength(name, 'name', 1, 255);
		if (!nameValidation.valid) {
			return json(validationError('name', nameValidation.error!, 400), { status: 400 });
		}

		const legalNameValidation = validateLength(legal_name, 'legal_name', 1, 255);
		if (!legalNameValidation.valid) {
			return json(validationError('legal_name', legalNameValidation.error!, 400), { status: 400 });
		}

		const rfcValidation = validateRFC(tax_id);
		if (!rfcValidation.valid) {
			return json(validationError('tax_id', rfcValidation.error!, 400), { status: 400 });
		}

		const emailValidation = validateEmail(email);
		if (!emailValidation.valid) {
			return json(validationError('email', emailValidation.error!, 400), { status: 400 });
		}

		if (phone) {
			const phoneValidation = validatePhone(phone);
			if (!phoneValidation.valid) {
				return json(validationError('phone', phoneValidation.error!, 400), { status: 400 });
			}
		}

		const sqlInjectionChecks = [validateNoSQLInjection(name), validateNoSQLInjection(legal_name)];
		const sqlError = sqlInjectionChecks.find((v) => !v.valid);
		if (sqlError) {
			return json(validationError('input', sqlError.error!, 400), { status: 400 });
		}

		if (
			!address.street ||
			!address.exterior ||
			!address.neighborhood ||
			!address.city ||
			!address.state ||
			!address.zip
		) {
			return json(
				validationError(
					'address',
					'La dirección debe incluir: calle, número exterior, colonia, ciudad, estado y código postal',
					400
				),
				{ status: 400 }
			);
		}

		const zipValidation = validateZipCode(address.zip);
		if (!zipValidation.valid) {
			return json(validationError('zip', zipValidation.error!, 400), { status: 400 });
		}

		// 4. Validar que se haya configurado la clave de Facturapi
		if (!FACTURAPI_USER_KEY) {
			return json(
				{ error: 'No se ha configurado la clave de usuario de Facturapi en el servidor' },
				{ status: 500 }
			);
		}

		const pool = await getConnection();

		// Verificar permisos
		const permCheckResult = await pool.query(
			`SELECT COUNT(*) as totalOrgs FROM Usuario_Organizacion WHERE UsuarioId = $1`,
			[user.id]
		);
		const totalOrgs = parseInt(permCheckResult.rows[0].totalorgs, 10) || 0;
		const esPrimeraOrg = totalOrgs === 0;

		if (!esPrimeraOrg) {
			const adminCheckResult = await pool.query(
				`SELECT COUNT(*) as totalAdmin
				 FROM Usuario_Organizacion uo
				 INNER JOIN Roles r ON uo.rolid = r.id
				 WHERE uo.usuarioid = $1 AND r.nombre = 'Administrador'`,
				[user.id]
			);
			const totalAdmin = parseInt(adminCheckResult.rows[0].totaladmin, 10) || 0;
			const isAdmin = totalAdmin > 0;
			if (!isAdmin) {
				return json(
					{
						error: 'No tienes permiso para crear organizaciones',
						message:
							'Solo los usuarios con rol de Administrador pueden crear nuevas organizaciones',
						status_code: 'INSUFFICIENT_PERMISSIONS'
					},
					{ status: 403 }
				);
			}
		}

		// Verificar plan y límites
		let planUsuario = 'free';
		try {
			const userPlanResult = await pool.query(
				`SELECT s.planseleccionado
				 FROM Suscripciones s
				 INNER JOIN Usuario_Organizacion uo ON s.organizacionid = uo.organizacionid
				 WHERE uo.usuarioid = $1
				   AND s.estado IN ('active', 'trialing')
				 ORDER BY CASE s.planseleccionado
				   WHEN 'enterprise' THEN 4
				   WHEN 'pro' THEN 3
				   WHEN 'basico' THEN 2
				   ELSE 1
				 END DESC
				 LIMIT 1`,
				[user.id]
			);
			if (userPlanResult.rows.length > 0 && userPlanResult.rows[0].planseleccionado) {
				planUsuario = userPlanResult.rows[0].planseleccionado;
			}
		} catch (err) {
			console.warn(
				'[VALIDACIÓN] Error consultando Suscripciones, usando plan por defecto:',
				err
			);
		}

		const limites = PLAN_LIMITS[planUsuario] || PLAN_LIMITS['free'];
		const planNombre = PLAN_NOMBRES[planUsuario] || 'Gratuito';

		const orgCountResult = await pool.query(
			`SELECT COUNT(*) as total FROM Usuario_Organizacion WHERE UsuarioId = $1`,
			[user.id]
		);
		const orgCount = parseInt(orgCountResult.rows[0].total, 10) || 0;

		if (orgCount >= limites.maxOrganizaciones) {
			return json(
				{
					error: 'Límite de organizaciones alcanzado',
					message: `Tu plan ${planNombre} permite máximo ${limites.maxOrganizaciones} organización(es). Ya tienes ${orgCount}.`,
					status_code: 'LIMIT_EXCEEDED'
				},
				{ status: 403 }
			);
		}

		// Verificar RFC duplicado
		const rfcCheckResult = await pool.query(
			`SELECT COUNT(*) as total FROM organizaciones WHERE RFC = $1`,
			[tax_id.toUpperCase()]
		);
		const rfcDuplicado = (parseInt(rfcCheckResult.rows[0].total, 10) || 0) > 0;
		if (rfcDuplicado) {
			return json(
				{
					error: 'RFC duplicado',
					message: 'Ya existe una organización registrada con este RFC en el sistema.',
					status_code: 'RFC_DUPLICADO'
				},
				{ status: 409 }
			);
		}

		// Verificar CSD duplicado si se proporcionaron hashes
		if (body.csd_cer_hash || body.csd_key_hash) {
			try {
				const csdCheckResult = await pool.query(
					`SELECT COUNT(*) as total
					 FROM configuracion_organizacion
					 WHERE (csd_cer_hash = $1 OR csd_key_hash = $2)
					 AND ($1 IS NOT NULL OR $2 IS NOT NULL)`,
					[body.csd_cer_hash || null, body.csd_key_hash || null]
				);
				const csdDuplicado = (parseInt(csdCheckResult.rows[0].total, 10) || 0) > 0;
				if (csdDuplicado) {
					return json(
						{
							error: 'CSD duplicado',
							message:
								'Ya existe una organización registrada con estos certificados CSD.',
							status_code: 'CSD_DUPLICADO'
						},
						{ status: 409 }
					);
				}
			} catch (err) {
				console.warn(
					'[VALIDACIÓN] No se pudo validar CSD duplicado (columnas podrían no existir aún):',
					err
				);
			}
		}

		// PASO 1: Crear organización en Facturapi
		console.log('[FACTURAPI] Creando organización:', name);
		const createOrgResponse = await fetch('https://www.facturapi.io/v2/organizations', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${FACTURAPI_USER_KEY}`
			},
			body: JSON.stringify({ name })
		});

		if (!createOrgResponse.ok) {
			const errorData = await createOrgResponse.json();
			console.error('[FACTURAPI] Error al crear organización:', errorData);
			return json(
				{
					error: 'Error al crear organización en Facturapi',
					details: errorData.message || errorData
				},
				{ status: createOrgResponse.status }
			);
		}

		const orgData = await createOrgResponse.json();
		const organizationId = orgData.id;
		console.log('[FACTURAPI] Organización creada con ID:', organizationId);

		// PASO 2: Actualizar información legal de la organización
		console.log('[FACTURAPI] Actualizando información legal...');
		const updateLegalResponse = await fetch(
			`https://www.facturapi.io/v2/organizations/${organizationId}/legal`,
			{
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${FACTURAPI_USER_KEY}`
				},
				body: JSON.stringify({
					name,
					legal_name,
					tax_system,
					website: website || undefined,
					phone: phone || undefined,
					address: {
						street: address.street,
						exterior: address.exterior,
						interior: address.interior || undefined,
						neighborhood: address.neighborhood,
						city: address.city,
						municipality: address.municipality,
						zip: address.zip,
						state: address.state
					}
				})
			}
		);

		if (!updateLegalResponse.ok) {
			const errorData = await updateLegalResponse.json();
			console.error('[FACTURAPI] Error al actualizar información legal:', errorData);
			try {
				await fetch(`https://www.facturapi.io/v2/organizations/${organizationId}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${FACTURAPI_USER_KEY}` }
				});
			} catch (e) {
				console.error('[FACTURAPI] No se pudo eliminar la organización creada:', e);
			}
			return json(
				{
					error: 'Error al actualizar información legal en Facturapi',
					details: errorData.message || errorData
				},
				{ status: updateLegalResponse.status }
			);
		}

		const legalData = await updateLegalResponse.json();
		console.log('[FACTURAPI] Información legal actualizada correctamente');

		// Buscar régimen fiscal
		const regimenResult = await pool.query(
			`SELECT ID_Regimen FROM Regimen WHERE Codigo = $1`,
			[tax_system]
		);

		if (regimenResult.rows.length === 0) {
			console.error('[DB] Régimen fiscal no encontrado:', tax_system);
			return json(
				{
					error: 'Régimen fiscal no válido',
					details: `El código de régimen ${tax_system} no existe en la base de datos`
				},
				{ status: 400 }
			);
		}

		const idRegimen = regimenResult.rows[0].id_regimen;

		// PASO 3: Guardar organización en la base de datos local
		console.log('[DB] Guardando organización en base de datos...');
		const insertOrgResult = await pool.query(
			`INSERT INTO organizaciones (
				RFC, RazonSocial, CorreoElectronico, Nombre, CreatedAt, UpdatedAt
			) VALUES (
				$1, $2, $3, $4, NOW(), NOW()
			) RETURNING id`,
			[tax_id.toUpperCase(), legal_name, email, name]
		);

		const localOrganizacionId = insertOrgResult.rows[0].id;
		console.log('[DB] Organización guardada con ID local:', localOrganizacionId);

		// Guardar configuración de la organización
		await pool.query(
			`INSERT INTO configuracion_organizacion (
				organizacion_id, nombre_comercial, email_corporativo, telefono,
				calle, numero_exterior, numero_interior, colonia, ciudad, estado,
				codigo_postal, pais, regimen_fiscal, activa, IdFacturapi,
				fecha_creacion, fecha_actualizacion
			) VALUES (
				$1, $2, $3, $4,
				$5, $6, $7, $8, $9, $10,
				$11, $12, $13, $14, $15,
				NOW(), NOW()
			)`,
			[
				localOrganizacionId,
				name,
				email,
				phone || null,
				address.street,
				address.exterior,
				address.interior || null,
				address.neighborhood,
				address.city,
				address.state,
				address.zip,
				'MEX',
				idRegimen,
				1,
				organizationId
			]
		);

		// PASO 4: Asociar el usuario actual con la organización como Administrador (RolId = 3)
		console.log('[DB] Asociando usuario con organización...');
		await pool.query(
			`INSERT INTO Usuario_Organizacion (UsuarioId, OrganizacionId, RolId, fechaasignacion)
			 VALUES ($1, $2, $3, NOW())`,
			[user.id, localOrganizacionId, 3]
		);

		// Generar nuevos tokens con la organización
		const tokenPayload = {
			id: user.id,
			correo: user.correo,
			organizacion: localOrganizacionId,
			rolId: 3 // Administrador
		};
		const newAccessToken = generateAccessToken(tokenPayload);
		const newRefreshToken = generateRefreshToken(tokenPayload);

		const isProduction = process.env.NODE_ENV === 'production';
		event.cookies.set('accessToken', newAccessToken, {
			httpOnly: true,
			secure: isProduction,
			sameSite: 'lax',
			maxAge: 60 * 15, // 15 minutos
			path: '/'
		});
		event.cookies.set('refreshToken', newRefreshToken, {
			httpOnly: true,
			secure: isProduction,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7, // 7 días
			path: '/'
		});

		console.log('[SUCCESS] Organización creada exitosamente');

		// 5. Retornar éxito
		return json({
			success: true,
			message: 'Organización creada exitosamente',
			organizacionId: localOrganizacionId,
			factuapiId: organizationId,
			organizacion: {
				id: localOrganizacionId,
				nombre: name,
				razonSocial: legal_name,
				rfc: tax_id.toUpperCase(),
				factuapiId: organizationId
			}
		});
	} catch (error) {
		console.error('[ERROR] Error al crear organización:', error);
		return json(
			{
				error: 'Error en el servidor'
			},
			{ status: 500 }
		);
	}
};
