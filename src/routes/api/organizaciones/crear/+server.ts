import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import { getUserFromRequest } from '$lib/server/auth';
import sql from 'mssql';

// Variable de entorno para la API de Facturapi
const FACTURAPI_USER_KEY = process.env.FACTURAPI_USER_KEY || '';

export const POST: RequestHandler = async (event) => {
	try {
		// 1. Verificar autenticación
		const user = getUserFromRequest(event);

		if (!user) {
			return json({ error: 'No autorizado' }, { status: 401 });
		}

		// 2. Obtener datos del body
		const body = await event.request.json();
		const { name, legal_name, tax_id, tax_system, email, phone, website, address } = body;

		// 3. Validar datos requeridos
		if (!name || !legal_name || !tax_id || !tax_system || !email || !address) {
			return json({ error: 'Faltan datos requeridos' }, { status: 400 });
		}

		// 4. Validar que se haya configurado la clave de Facturapi
		if (!FACTURAPI_USER_KEY) {
			return json(
				{ error: 'No se ha configurado la clave de usuario de Facturapi en el servidor' },
				{ status: 500 }
			);
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
					tax_id,
					tax_system,
					website: website || undefined,
					support_email: email,
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
			// Intentar eliminar la organización creada si falla
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

		// PASO 3: Guardar organización en la base de datos local
		console.log('[DB] Guardando organización en base de datos...');
		const pool = await getConnection();

		const insertResult = await pool
			.request()
			.input('RazonSocial', sql.NVarChar(255), legal_name)
			.input('NombreComercial', sql.NVarChar(255), name)
			.input('RFC', sql.NVarChar(13), tax_id.toUpperCase())
			.input('RegimenFiscal', sql.NVarChar(10), tax_system)
			.input('Email', sql.NVarChar(255), email)
			.input('Telefono', sql.NVarChar(20), phone || null)
			.input('SitioWeb', sql.NVarChar(255), website || null)
			.input('CodigoPostal', sql.NVarChar(5), address.zip)
			.input('Calle', sql.NVarChar(255), address.street)
			.input('NumeroExterior', sql.NVarChar(50), address.exterior)
			.input('NumeroInterior', sql.NVarChar(50), address.interior || null)
			.input('Colonia', sql.NVarChar(255), address.neighborhood)
			.input('Ciudad', sql.NVarChar(255), address.city)
			.input('Municipio', sql.NVarChar(255), address.municipality)
			.input('Estado', sql.NVarChar(255), address.state)
			.input('Pais', sql.NVarChar(3), 'MEX')
			.input('FacturapiId', sql.NVarChar(255), organizationId).query(`
				INSERT INTO Organizaciones (
					RazonSocial, NombreComercial, RFC, RegimenFiscal, Email, Telefono, SitioWeb,
					CodigoPostal, Calle, NumeroExterior, NumeroInterior, Colonia, Ciudad, Municipio, Estado, Pais,
					FacturapiId, FechaCreacion
				)
				OUTPUT INSERTED.Id
				VALUES (
					@RazonSocial, @NombreComercial, @RFC, @RegimenFiscal, @Email, @Telefono, @SitioWeb,
					@CodigoPostal, @Calle, @NumeroExterior, @NumeroInterior, @Colonia, @Ciudad, @Municipio, @Estado, @Pais,
					@FacturapiId, GETDATE()
				)
			`);

		const localOrganizacionId = insertResult.recordset[0].Id;
		console.log('[DB] Organización guardada con ID local:', localOrganizacionId);

		// PASO 4: Asociar el usuario actual con la organización como Administrador (RolId = 1)
		console.log('[DB] Asociando usuario con organización...');
		await pool
			.request()
			.input('UsuarioId', sql.Int, user.id)
			.input('OrganizacionId', sql.Int, localOrganizacionId)
			.input('RolId', sql.Int, 1) // 1 = Administrador
			.query(`
				INSERT INTO Usuario_Organizacion (UsuarioId, OrganizacionId, RolId, FechaAsignacion)
				VALUES (@UsuarioId, @OrganizacionId, @RolId, GETDATE())
			`);

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
				error: 'Error en el servidor',
				details: error instanceof Error ? error.message : 'Error desconocido'
			},
			{ status: 500 }
		);
	}
};
