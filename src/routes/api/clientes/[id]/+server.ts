import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { validarActualizacionCliente } from '$lib/server/validaciones-clientes';
import { editarClienteFacturaAPI, borrarClienteFacturaAPI } from '$lib/server/facturapi';

// GET - Obtener un cliente individual
export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const { id } = params;
		const clienteId = parseInt(id);

		if (isNaN(clienteId)) {
			return json({ error: 'ID de cliente inválido' }, { status: 400 });
		}

		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const userId = locals.user.id;
		const pool = await getConnection();

		const usuarioOrgs = await pool.query(
			`
			SELECT uo.organizacionid
			FROM Usuario_Organizacion uo
			WHERE uo.usuarioid = $1
			`,
			[userId]
		);

		if (usuarioOrgs.rows.length === 0) {
			return json({ error: 'El usuario no tiene organizaciones asignadas' }, { status: 403 });
		}

		const clienteOrgs = usuarioOrgs.rows.map((org: any) => org.organizacionid);

		// Consulta para obtener el cliente individual con toda su información
		const result = await pool.query(
			`
			SELECT
				c.id,
				c.nombrecomercial as "NombreComercial",
				c.razonsocial as "RazonSocial",
				c.rfc as "RFC",
				c.regimenfiscalid as "RegimenFiscalId",
				r.descripcion as "RegimenFiscal",
				c.condicionespago as "CondicionesPago",
				c.correoprincipal as "CorreoPrincipal",
				c.paisid as "PaisId",
				p.nombrepais as "Pais",
				c.codigopais as "CodigoPais",
				c.telefono as "Telefono",
				c.telefonowhatsapp as "TelefonoWhatsApp",
				c.estadoid as "EstadoId",
				e.nombreestado as "Estado",
				c.calle as "Calle",
				c.numeroexterior as "NumeroExterior",
				c.numerointerior as "NumeroInterior",
				c.codigopostal as "CodigoPostal",
				c.colonia as "Colonia",
				c.ciudad as "Ciudad",
				c.organizacionid as "OrganizacionId",
				COALESCE((
					SELECT CONCAT(u.nombre, ' ', u.apellido)
					FROM Agentes_Clientes ac
					INNER JOIN Usuarios u ON ac.usuarioid = u.id
					WHERE ac.clienteid = c.id
					ORDER BY ac.usuarioid
				), '') as "Agente"
			FROM Clientes c
			LEFT JOIN Regimen r ON c.regimenfiscalid = r.id_regimen
			LEFT JOIN Estados e ON c.estadoid = e.ID
			LEFT JOIN Paises p ON c.paisid = p.ID
			WHERE c.id = $1
			LIMIT 1
			`,
			[clienteId]
		);

		if (result.rows.length === 0) {
			return json({ error: 'Cliente no encontrado' }, { status: 404 });
		}

		const cliente = result.rows[0];

		if (!clienteOrgs.includes(cliente.OrganizacionId)) {
			return json({
				error: 'No tienes permiso para ver este cliente',
				message: 'El cliente pertenece a una organización a la que no tienes acceso'
			}, { status: 403 });
		}

		return json(cliente);
	} catch (err: any) {
		console.error('[CLIENTES GET] Error completo:', err);
		console.error('[CLIENTES GET] Stack:', err.stack);
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};

// PUT - Actualizar cliente
export const PUT: RequestHandler = async ({ params, request, locals, url }) => {
	try {
		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const { id } = params;
		const rawData = await request.json();
		// Normalize keys to lowercase for consistency (frontend sends PascalCase)
		const clienteData: Record<string, any> = {};
		for (const [key, value] of Object.entries(rawData)) {
			clienteData[key.toLowerCase()] = value;
			// Keep original casing too for fields accessed as-is (e.g. AgenteSeleccionado)
			clienteData[key] = value;
		}

		const validacion = validarActualizacionCliente(clienteData);
		if (!validacion.valido) {
			return json({
				error: 'Datos inválidos',
				detalles: validacion.errores
			}, { status: 400 });
		}

		let organizacionId: number | null = url.searchParams.get('organizacionId')
			? parseInt(url.searchParams.get('organizacionId')!)
			: clienteData.organizacionid || null;

		if (!organizacionId) {
			return json({ error: 'organizacionId es requerido' }, { status: 400 });
		}

		if (typeof organizacionId === 'string') {
			organizacionId = parseInt(organizacionId);
		}

		const userId = locals.user.id;
		const clienteId = parseInt(id);
		const pool = await getConnection();

		const usuarioOrgs = await pool.query(
			`
			SELECT uo.organizacionid, uo.rolid
			FROM Usuario_Organizacion uo
			WHERE uo.usuarioid = $1
			`,
			[userId]
		);

		if (usuarioOrgs.rows.length === 0) {
			return json({ error: 'El usuario no tiene organizaciones asignadas' }, { status: 403 });
		}

		let usuarioOrgId = usuarioOrgs.rows[0].organizacionid;
		let usuarioRolId = usuarioOrgs.rows[0].rolid;

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
			return json({
				error: 'No tienes permiso para editar clientes',
				message: 'Solo los administradores pueden editar clientes'
			}, { status: 403 });
		}

		const clienteVerify = await pool.query(
			`
			SELECT Id, IdClienteFacturaAPI FROM Clientes
			WHERE Id = $1 AND OrganizacionId = $2
			`,
			[clienteId, usuarioOrgId]
		);

		if (clienteVerify.rows.length === 0) {
			return json({ error: 'Cliente no encontrado o no tienes permiso para editarlo' }, { status: 404 });
		}

		const idClienteFacturaAPI = clienteVerify.rows[0].idclientefacturaapi;

		if (clienteData.telefonowhatsapp) {
			const whatsappExistente = await pool.query(
				`SELECT id FROM Clientes WHERE TelefonoWhatsApp = $1 AND OrganizacionId = $2 AND Id != $3`,
				[clienteData.telefonowhatsapp, usuarioOrgId, clienteId]
			);
			if (whatsappExistente.rows.length > 0) {
				return json({ error: 'Ya existe un cliente con ese número de WhatsApp en tu organización' }, { status: 409 });
			}
		}

		await pool.query(
			`
			UPDATE Clientes SET
				NombreComercial = $2,
				RazonSocial = $3,
				RFC = $4,
				RegimenFiscalId = $5,
				CondicionesPago = $6,
				CorreoPrincipal = $7,
				PaisId = $8,
				CodigoPais = $9,
				Telefono = $10,
				TelefonoWhatsApp = $11,
				EstadoId = $12,
				Calle = $13,
				NumeroExterior = $14,
				NumeroInterior = $15,
				CodigoPostal = $16,
				Colonia = $17,
				Ciudad = $18
			WHERE Id = $1
			`,
			[
				clienteId,
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

		if (clienteData.AgenteSeleccionado) {
			await pool.query(
				`DELETE FROM Agentes_Clientes WHERE ClienteId = $1`,
				[clienteId]
			);
			await pool.query(
				`
				INSERT INTO Agentes_Clientes (ClienteId, UsuarioId)
				VALUES ($1, $2)
				`,
				[clienteId, clienteData.AgenteSeleccionado]
			);
		}

		let sincronizacionFacturaAPI = {
			sincronizado: false,
			mensaje: '',
			error: null as string | null
		};

		if (idClienteFacturaAPI) {
			try {
				const orgResult = await pool.query(
					`
					SELECT apikeyfacturaapi
					FROM Organizaciones
					WHERE Id = $1
					`,
					[usuarioOrgId]
				);

				if (orgResult.rows.length > 0 && orgResult.rows[0].apikeyfacturaapi) {
					const apiKey = orgResult.rows[0].apikeyfacturaapi;
					await editarClienteFacturaAPI(apiKey, idClienteFacturaAPI, {
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
					sincronizacionFacturaAPI.sincronizado = true;
					sincronizacionFacturaAPI.mensaje = 'Los datos se han actualizado en FacturaAPI. Tu información fiscal ha sido validada nuevamente con el SAT.';
				} else {
					sincronizacionFacturaAPI.error = 'No hay API Key configurada para sincronizar con FacturaAPI';
					console.warn(`[CLIENTES PUT] API Key no configurada para organización ${usuarioOrgId}`);
				}
			} catch (errorFacturaAPI) {
				sincronizacionFacturaAPI.error = errorFacturaAPI instanceof Error ? errorFacturaAPI.message : String(errorFacturaAPI);
				console.error(`[CLIENTES PUT] Error al sincronizar con FacturaAPI:`, sincronizacionFacturaAPI.error);
			}
		}

		return json({
			message: 'Cliente actualizado correctamente',
			facturapi: sincronizacionFacturaAPI
		});
	} catch (err: any) {
		console.error('[CLIENTES PUT] Error:', err);
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};

// DELETE - Eliminar cliente
export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		const { id } = params;
		const clienteId = parseInt(id);
		const userId = locals.user.id;

		if (isNaN(clienteId)) {
			return json({ error: 'ID de cliente inválido' }, { status: 400 });
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

		if (usuarioOrgs.rows.length === 0) {
			return json({ error: 'El usuario no tiene organizaciones asignadas' }, { status: 403 });
		}

		const usuarioRolId = usuarioOrgs.rows[0].rolid;
		if (usuarioRolId !== 3) {
			return json({
				error: 'No tienes permiso para eliminar clientes',
				message: 'Solo los administradores pueden eliminar clientes'
			}, { status: 403 });
		}

		const clienteOrgs = usuarioOrgs.rows.map((org: any) => org.organizacionid);

		const clienteCheck = await pool.query(
			`
			SELECT Id, OrganizacionId, IdClienteFacturaAPI FROM Clientes
			WHERE Id = $1
			`,
			[clienteId]
		);

		if (clienteCheck.rows.length === 0) {
			return json({ error: 'Cliente no encontrado' }, { status: 404 });
		}

		const clienteOrgId = clienteCheck.rows[0].organizacionid;
		const idClienteFacturaAPI = clienteCheck.rows[0].idclientefacturaapi;

		if (!clienteOrgs.includes(clienteOrgId)) {
			return json({
				error: 'No tienes permiso para eliminar este cliente',
				message: 'El cliente pertenece a una organización a la que no tienes acceso'
			}, { status: 403 });
		}

		let sincronizacionFacturaAPI = {
			sincronizado: false,
			mensaje: '',
			error: null as string | null
		};

		if (idClienteFacturaAPI) {
			try {
				const orgResult = await pool.query(
					`
					SELECT apikeyfacturaapi
					FROM Organizaciones
					WHERE Id = $1
					`,
					[clienteOrgId]
				);

				if (orgResult.rows.length > 0 && orgResult.rows[0].apikeyfacturaapi) {
					const apiKey = orgResult.rows[0].apikeyfacturaapi;
					const borrado = await borrarClienteFacturaAPI(apiKey, idClienteFacturaAPI);
					if (borrado) {
						sincronizacionFacturaAPI.sincronizado = true;
						sincronizacionFacturaAPI.mensaje = 'El cliente también ha sido eliminado de FacturaAPI. Las facturas asociadas permanecerán en el historial.';
					}
				} else {
					sincronizacionFacturaAPI.error = 'No hay API Key configurada para eliminar de FacturaAPI';
					console.warn(`[CLIENTES DELETE] API Key no configurada para organización ${clienteOrgId}`);
				}
			} catch (errorFacturaAPI) {
				sincronizacionFacturaAPI.error = errorFacturaAPI instanceof Error ? errorFacturaAPI.message : String(errorFacturaAPI);
				console.error(`[CLIENTES DELETE] Error al eliminar de FacturaAPI:`, sincronizacionFacturaAPI.error);
			}
		}

		await pool.query(
			`DELETE FROM Agentes_Clientes WHERE ClienteId = $1`,
			[clienteId]
		);

		try {
			await pool.query(
				`DELETE FROM Clientes WHERE Id = $1`,
				[clienteId]
			);
		} catch (deleteErr: any) {
			if (deleteErr.code === '23503') {
				return json({
					error: 'No se puede eliminar este cliente porque tiene facturas asociadas',
					message: 'Primero debes cancelar todas las facturas de este cliente antes de poder eliminarlo.'
				}, { status: 409 });
			}
			throw deleteErr;
		}

		return json({
			message: 'Cliente eliminado correctamente',
			facturapi: sincronizacionFacturaAPI
		});
	} catch (err: any) {
		console.error('[CLIENTES DELETE] Error:', err);
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
