import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';

export const PUT: RequestHandler = async (event) => {
	try {
		// Verificar autenticación
		const authUser = getUserFromRequest(event);
		if (!authUser) {
			return unauthorizedResponse('Token de autorización requerido');
		}

		const { id } = event.params;
		const { correo, contrasena, nombre, apellido, activo } = await event.request.json();

		const pool = await getConnection();

		// Verificar si existe el usuario
		const checkUser = await pool
			.request()
			.input('Id', sql.Int, id)
			.query('SELECT * FROM Usuarios WHERE Id = @Id');

		if (checkUser.recordset.length === 0) {
			return json({ error: 'Usuario no encontrado' }, { status: 404 });
		}

		// Si viene contraseña nueva, la encriptamos
		let hashedPassword = null;
		if (contrasena) {
			hashedPassword = await bcrypt.hash(contrasena, 10);
		}

		// Actualizar usuario
		await pool
			.request()
			.input('Id', sql.Int, id)
			.input('Correo', sql.NVarChar(150), correo || checkUser.recordset[0].Correo)
			.input('Contrasena', sql.NVarChar(sql.MAX), hashedPassword || checkUser.recordset[0].Contrasena)
			.input('Nombre', sql.NVarChar(150), nombre || checkUser.recordset[0].Nombre)
			.input('Apellido', sql.NVarChar(150), apellido || checkUser.recordset[0].Apellido)
			.input('Activo', sql.Bit, activo !== undefined ? activo : checkUser.recordset[0].Activo)
			.query(`
				UPDATE Usuarios
				SET Correo = @Correo,
					Contrasena = @Contrasena,
					Nombre = @Nombre,
					Apellido = @Apellido,
					Activo = @Activo
				WHERE Id = @Id
			`);

		return json({ message: 'Usuario actualizado correctamente' });
	} catch (err) {
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
