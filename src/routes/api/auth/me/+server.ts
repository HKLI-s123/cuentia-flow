import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	try {
		// Verificar autenticación
		const user = getUserFromRequest(event);
		if (!user) {
			return unauthorizedResponse('Token de autorización requerido');
		}

		const pool = await getConnection();

		const result = await pool
			.request()
			.input('Id', sql.Int, user.id)
			.query(`SELECT Id, Correo, Nombre, Apellido, OrganizacionId, Activo FROM Usuarios WHERE Id = @Id`);

		if (result.recordset.length === 0) {
			return json({ error: 'Usuario no encontrado' }, { status: 404 });
		}

		return json(result.recordset[0]);
	} catch (err) {
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
