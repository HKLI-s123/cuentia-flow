import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';

// GET - Obtener un cliente individual
export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const { id } = params;
		const organizacionId = url.searchParams.get('organizacionId');

		if (!organizacionId) {
			return json({ error: 'organizacionId es requerido' }, { status: 400 });
		}

		const pool = await getConnection();

		// Consulta para obtener el cliente individual con toda su información
		const result = await pool
			.request()
			.input('ClienteId', sql.Int, parseInt(id))
			.input('OrganizacionId', sql.Int, parseInt(organizacionId))
			.query(`
				SELECT
					c.Id,
					c.NombreComercial,
					c.RazonSocial,
					c.RFC,
					c.RegimenFiscalId,
					r.Descripcion as RegimenFiscal,
					c.CondicionesPago,
					c.CorreoPrincipal,
					c.PaisId,
					p.NombrePais as Pais,
					c.CodigoPais,
					c.Telefono,
					c.EstadoId,
					e.NombreEstado as Estado,
					c.Calle,
					c.NumeroExterior,
					c.NumeroInterior,
					c.CodigoPostal,
					c.Colonia,
					c.Ciudad,
					c.OrganizacionId
				FROM Clientes c
				LEFT JOIN Regimen r ON c.RegimenFiscalId = r.ID_Regimen
				LEFT JOIN Estados e ON c.EstadoId = e.ID
				LEFT JOIN Paises p ON c.PaisId = p.ID
				WHERE c.Id = @ClienteId
					AND c.OrganizacionId = @OrganizacionId
			`);

		if (result.recordset.length === 0) {
			return json({ error: 'Cliente no encontrado' }, { status: 404 });
		}

		const cliente = result.recordset[0];

		return json(cliente);
	} catch (err) {
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};

// PUT - Actualizar cliente
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { id } = params;
		const clienteData = await request.json();

		const pool = await getConnection();

		await pool
			.request()
			.input('Id', sql.Int, parseInt(id))
			.input('NombreComercial', sql.NVarChar(200), clienteData.NombreComercial || null)
			.input('RazonSocial', sql.NVarChar(200), clienteData.RazonSocial || null)
			.input('RFC', sql.NVarChar(13), clienteData.RFC || null)
			.input('RegimenFiscalId', sql.Int, clienteData.RegimenFiscalId || null)
			.input('CondicionesPago', sql.NVarChar(50), clienteData.CondicionesPago || null)
			.input('CorreoPrincipal', sql.NVarChar(100), clienteData.CorreoPrincipal || null)
			.input('PaisId', sql.Int, clienteData.PaisId || null)
			.input('CodigoPais', sql.NVarChar(10), clienteData.CodigoPais || null)
			.input('Telefono', sql.NVarChar(20), clienteData.Telefono || null)
			.input('EstadoId', sql.Int, clienteData.EstadoId || null)
			.input('Calle', sql.NVarChar(200), clienteData.Calle || null)
			.input('NumeroExterior', sql.NVarChar(20), clienteData.NumeroExterior || null)
			.input('NumeroInterior', sql.NVarChar(20), clienteData.NumeroInterior || null)
			.input('CodigoPostal', sql.NVarChar(10), clienteData.CodigoPostal || null)
			.input('Colonia', sql.NVarChar(100), clienteData.Colonia || null)
			.input('Ciudad', sql.NVarChar(100), clienteData.Ciudad || null)
			.query(`
				UPDATE Clientes SET
					NombreComercial = @NombreComercial,
					RazonSocial = @RazonSocial,
					RFC = @RFC,
					RegimenFiscalId = @RegimenFiscalId,
					CondicionesPago = @CondicionesPago,
					CorreoPrincipal = @CorreoPrincipal,
					PaisId = @PaisId,
					CodigoPais = @CodigoPais,
					Telefono = @Telefono,
					EstadoId = @EstadoId,
					Calle = @Calle,
					NumeroExterior = @NumeroExterior,
					NumeroInterior = @NumeroInterior,
					CodigoPostal = @CodigoPostal,
					Colonia = @Colonia,
					Ciudad = @Ciudad
				WHERE Id = @Id
			`);

		return json({ message: 'Cliente actualizado correctamente' });
	} catch (err) {
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};

// DELETE - Eliminar cliente
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { id } = params;
		const pool = await getConnection();

		await pool
			.request()
			.input('Id', sql.Int, parseInt(id))
			.query(`DELETE FROM Clientes WHERE Id = @Id`);

		return json({ message: 'Cliente eliminado correctamente' });
	} catch (err) {
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
