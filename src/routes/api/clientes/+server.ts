import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { validarClienteCompleto } from '$lib/server/validaciones-clientes';
import { validarLimiteClientes } from '$lib/server/validar-plan';
import { obtenerApiKeyFacturaAPI, generarApiKeyFacturaAPI, crearClienteFacturaAPI } from '$lib/server/facturapi';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		let organizacionId = url.searchParams.get('organizacionId');

		if (locals.user) {
			const userId = locals.user.id;
			const pool2 = await getConnection();
			const usuarioOrgs = await pool2.query(
				`
				SELECT uo.organizacionid
				FROM Usuario_Organizacion uo
				WHERE uo.usuarioid = $1
				`,
				[userId]
			);

			if (usuarioOrgs.rows.length > 0) {
				let userOrgId = usuarioOrgs.rows[0].organizacionid;
				if (organizacionId && usuarioOrgs.rows.length > 1) {
					const parsedOrgId = parseInt(organizacionId);
					const orgEncontrada = usuarioOrgs.rows.find(
						(org: any) => org.organizacionid === parsedOrgId
					);
					if (orgEncontrada) {
						userOrgId = parsedOrgId;
					}
				}
				organizacionId = userOrgId.toString();
			}
		}

		if (!organizacionId) {
			return new Response(
				JSON.stringify({ error: 'organizacionId es requerido' }),
				{ status: 400 }
			);
		}

		const search = url.searchParams.get('search') || '';
		const all = url.searchParams.get('all') === 'true';
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = parseInt(url.searchParams.get('pageSize') || '5');

		const offset = (page - 1) * pageSize;

		const pool = await getConnection();

		const params: any[] = [organizacionId];
		let paramIdx = 2;

		// Construir WHERE clause para búsqueda
		let whereClause = 'WHERE c.organizacionid = $1';
		if (search) {
			whereClause += ` AND (
				c.nombrecomercial ILIKE $${paramIdx} OR
				c.razonsocial ILIKE $${paramIdx} OR
				c.rfc ILIKE $${paramIdx} OR
				COALESCE(agentes.ListaAgentes, '') ILIKE $${paramIdx}
			)`;
			params.push(`%${search}%`);
			paramIdx++;
		}

		const countParams = [...params];

		// Query principal con JOIN a Agentes_Clientes (concatenando todos los agentes)
		let query = `
			SELECT
				c.id,
				c.nombrecomercial as cliente,
				c.nombrecomercial as "nombreComercial",
				c.razonsocial as "razonSocial",
				c.rfc,
				c.condicionespago as condiciones,
				c.correoprincipal as correo,
				c.telefono,
				c.telefonowhatsapp as "telefonoWhatsApp",
				COALESCE(agentes.ListaAgentes, '') as agente,
				0 as "cuentasMXN",
				0 as "cuentasUSD"
			FROM Clientes c
			LEFT JOIN (
				SELECT
					ac.clienteid,
					STRING_AGG(CONCAT(u.nombre, ' ', u.apellido), ', ') as ListaAgentes
				FROM Agentes_Clientes ac
				INNER JOIN Usuarios u ON ac.usuarioid = u.id
				GROUP BY ac.clienteid
			) agentes ON c.id = agentes.clienteid
			${whereClause}
			ORDER BY c.razonsocial ASC`;

		// Solo agregar paginación si no se solicita todos los registros
		if (!all) {
			query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
			params.push(pageSize, offset);
			paramIdx += 2;
		}

		const result = await pool.query(query, params);

		// Query para contar total de registros
		const countResult = await pool.query(`
			SELECT COUNT(DISTINCT c.id) as total
			FROM Clientes c
			LEFT JOIN (
				SELECT
					ac.clienteid,
					STRING_AGG(CONCAT(u.nombre, ' ', u.apellido), ', ') as ListaAgentes
				FROM Agentes_Clientes ac
				INNER JOIN Usuarios u ON ac.usuarioid = u.id
				GROUP BY ac.clienteid
			) agentes ON c.id = agentes.clienteid
			${whereClause}
		`, countParams);

		const total = parseInt(countResult.rows[0].total) || 0;

		// Respuesta diferente dependiendo si se solicita todos o paginación
		if (all) {
			return new Response(
				JSON.stringify({
					clientes: result.rows,
					total
				}),
				{ status: 200 }
			);
		} else {
			const totalPages = Math.ceil(total / pageSize);
			return new Response(
				JSON.stringify({
					clientes: result.rows,
					pagination: {
						currentPage: page,
						totalPages,
						totalRecords: total,
						pageSize
					}
				}),
				{ status: 200 }
			);
		}
	} catch (error) {
		return new Response(
			JSON.stringify({ error: 'Error interno del servidor' }),
			{ status: 500 }
		);
	}
};

// POST - Crear nuevo cliente
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const rawData = await request.json();
		// Normalize keys to lowercase for consistency (frontend sends PascalCase)
		const clienteData: Record<string, any> = {};
		for (const [key, value] of Object.entries(rawData)) {
			clienteData[key.toLowerCase()] = value;
			clienteData[key] = value;
		}

		if (!locals.user) {
			return new Response(
				JSON.stringify({ error: 'No autorizado' }),
				{ status: 401 }
			);
		}

		const validacion = validarClienteCompleto(clienteData);
		if (!validacion.valido) {
			return new Response(
				JSON.stringify({
					error: 'Datos inválidos',
					detalles: validacion.errores
				}),
				{ status: 400 }
			);
		}

		const userId = locals.user.id;
		let organizacionId = clienteData.organizacionid;
		if (typeof organizacionId === 'string') {
			organizacionId = parseInt(organizacionId);
		}

		const pool = await getConnection();

		const usuarioOrgs = await pool.query(
			`
			SELECT uo.organizacionid, uo.rolid
			FROM Usuario_Organizacion uo
			WHERE uo.usuarioid = $1
			`,
			[userId]
		);

		let usuarioOrgId = usuarioOrgs.rows[0]?.organizacionid;
		let usuarioRolId = usuarioOrgs.rows[0]?.rolid;

		if (!usuarioOrgId) {
			return new Response(
				JSON.stringify({ error: 'El usuario no tiene organizaciones asignadas' }),
				{ status: 403 }
			);
		}

		if (organizacionId && usuarioOrgs.rows.length > 1) {
			const orgEncontrada = usuarioOrgs.rows.find(
				(org: any) => org.organizacionid === organizacionId
			);
			if (orgEncontrada) {
				usuarioOrgId = orgEncontrada.organizacionid;
				usuarioRolId = orgEncontrada.rolid;
			}
		}

		if (usuarioRolId !== 3) {
			return new Response(
				JSON.stringify({
					error: 'No tienes permiso para crear clientes',
					message: `Solo los administradores pueden crear clientes. RolId: ${usuarioRolId}`
				}),
				{ status: 403 }
			);
		}

		const validacionLimites = await validarLimiteClientes(usuarioOrgId);
		if (!validacionLimites.permitido) {
			return new Response(
				JSON.stringify({
					error: 'Límite alcanzado',
					detalles: {
						mensaje: validacionLimites.mensaje,
						plan: validacionLimites.plan,
						clientes_actual: validacionLimites.clientes_actual,
						clientes_max: validacionLimites.clientes_max
					}
				}),
				{ status: 429 }
			);
		}

		organizacionId = usuarioOrgId;

		if (clienteData.telefonowhatsapp) {
			const whatsappExistente = await pool.query(
				`SELECT id FROM Clientes WHERE TelefonoWhatsApp = $1 AND OrganizacionId = $2`,
				[clienteData.telefonowhatsapp, organizacionId]
			);
			if (whatsappExistente.rows.length > 0) {
				return new Response(
					JSON.stringify({ error: 'Ya existe un cliente con ese número de WhatsApp en tu organización' }),
					{ status: 409 }
				);
			}
		}

		const result = await pool.query(
			`
			INSERT INTO Clientes (
				OrganizacionId, NombreComercial, RazonSocial, RFC, RegimenFiscalId,
				CondicionesPago, CorreoPrincipal, PaisId, CodigoPais, Telefono, TelefonoWhatsApp,
				EstadoId, Calle, NumeroExterior, NumeroInterior, CodigoPostal,
				Colonia, Ciudad
			)
			VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9, $10, $11,
				$12, $13, $14, $15, $16,
				$17, $18
			)
			RETURNING id
			`,
			[
				organizacionId,
				clienteData.nombrecomercial || null,
				clienteData.razonsocial || null,
				clienteData.rfc || null,
				clienteData.regimenfiscalid || null,
				clienteData.condicionespago || null,
				clienteData.correoprincipal || null,
				clienteData.paisid || null,
				clienteData.codigopais || null,
				clienteData.telefono || null,
				clienteData.telefonowhatsapp || null,
				clienteData.estadoid || null,
				clienteData.calle || null,
				clienteData.numeroexterior || null,
				clienteData.numerointerior || null,
				clienteData.codigopostal || null,
				clienteData.colonia || null,
				clienteData.ciudad || null
			]
		);

		const clienteId = result.rows[0].id;

		if (clienteData.AgenteSeleccionado) {
			await pool.query(
				`
				INSERT INTO Agentes_Clientes (ClienteId, UsuarioId)
				VALUES ($1, $2)
				`,
				[clienteId, clienteData.AgenteSeleccionado]
			);
		}

		let idClienteFacturaAPI = null;
		let sincronizado = false;
		let errorSincronizacion: string | null = null;

		try {
			const orgResult = await pool.query(
				`
				SELECT co.IdFacturapi, o.apikeyfacturaapi
				FROM Organizaciones o
				LEFT JOIN configuracion_organizacion co ON o.id = co.organizacion_id
				WHERE o.id = $1
				`,
				[organizacionId]
			);

			if (orgResult.rows.length === 0) {
				errorSincronizacion = 'Organización no encontrada en BD';
				console.warn(`[CLIENTES POST] ${errorSincronizacion}`);
			} else {
				const org = orgResult.rows[0];
				let apiKeyFacturaAPI = org.apikeyfacturaapi;
				const facturAPIKey = org.idfacturapi;

				if (!apiKeyFacturaAPI && facturAPIKey) {
					apiKeyFacturaAPI = await obtenerApiKeyFacturaAPI(facturAPIKey);
					if (!apiKeyFacturaAPI) {
						apiKeyFacturaAPI = await generarApiKeyFacturaAPI(facturAPIKey);
					}
					if (apiKeyFacturaAPI) {
						await pool.query(
							`
							UPDATE Organizaciones
							SET ApiKeyFacturaAPI = $2,
								FechaActualizacionApiKey = NOW()
							WHERE Id = $1
							`,
							[organizacionId, apiKeyFacturaAPI]
						);
					} else {
						console.error(`[CLIENTES POST] No se pudo obtener API Key. IdFacturapi:`, facturAPIKey);
					}
				} else if (!facturAPIKey) {
					errorSincronizacion = 'Organización no tiene IdFacturapi configurado';
					console.warn(`[CLIENTES POST] ${errorSincronizacion}`);
				}

				if (apiKeyFacturaAPI) {
					const respuestaFacturaAPI = await crearClienteFacturaAPI(apiKeyFacturaAPI, {
						razonsocial: clienteData.razonsocial,
						nombrecomercial: clienteData.nombrecomercial,
						rfc: clienteData.rfc,
						regimenfiscalid: clienteData.regimenfiscalid,
						correoprincipal: clienteData.correoprincipal,
						telefono: clienteData.telefono,
						codigopostal: clienteData.codigopostal,
						calle: clienteData.calle,
						numeroexterior: clienteData.numeroexterior,
						numerointerior: clienteData.numerointerior,
						colonia: clienteData.colonia,
						ciudad: clienteData.ciudad
					});
					if (respuestaFacturaAPI && respuestaFacturaAPI.id) {
						idClienteFacturaAPI = respuestaFacturaAPI.id;
						sincronizado = true;
					} else {
						errorSincronizacion = 'FacturaAPI: No se recibió ID de cliente';
						console.warn(`[CLIENTES POST] ${errorSincronizacion}`);
					}
				} else {
					errorSincronizacion = 'No se pudo obtener API Key de FacturaAPI para la organización';
					console.warn(`[CLIENTES POST] ${errorSincronizacion}`);
				}
			}
		} catch (facturapiError) {
			errorSincronizacion = facturapiError instanceof Error
				? facturapiError.message
				: 'Error desconocido al sincronizar con FacturaAPI';
			console.error(`[CLIENTES POST] Error en sincronización FacturaAPI:`, {
				error: errorSincronizacion,
				type: typeof facturapiError,
				stack: facturapiError instanceof Error ? facturapiError.stack : '',
				fullError: facturapiError
			});
		}

		if (idClienteFacturaAPI || errorSincronizacion) {
			await pool.query(
				`
				UPDATE Clientes
				SET
					IdClienteFacturaAPI = $2,
					SincronizadoFacturaAPI = $3,
					ErrorSincronizacionFacturaAPI = $4,
					FechaRegistroFacturaAPI = $5
				WHERE Id = $1
				`,
				[clienteId, idClienteFacturaAPI || null, sincronizado ? 1 : 0, errorSincronizacion || null, new Date()]
			);
		}

		return new Response(
			JSON.stringify({
				message: 'Cliente creado correctamente',
				id: clienteId,
				sincronizadoFacturaAPI: sincronizado,
				idClienteFacturaAPI: idClienteFacturaAPI || undefined,
				advertencia: errorSincronizacion ? `Sincronización con FacturaAPI: ${errorSincronizacion}` : undefined
			}),
			{ status: 201 }
		);
	} catch (err: any) {
		console.error('[CLIENTES POST] Error completo:', err);
		console.error('[CLIENTES POST] Stack:', err.stack);
		return new Response(
			JSON.stringify({
				error: 'Error en el servidor'
			}),
			{ status: 500 }
		);
	}
};