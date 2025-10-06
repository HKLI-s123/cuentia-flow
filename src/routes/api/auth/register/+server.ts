import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';
import bcrypt from 'bcryptjs';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { correo, contrasena, organizacion_id, numero_tel } = await request.json();

		if (!correo || !contrasena) {
			return json({ error: 'Correo y contraseña son requeridos' }, { status: 400 });
		}

		const pool = await getConnection();

		// Encriptar contraseña
		const hashedPassword = await bcrypt.hash(contrasena, 10);

		const result = await pool
			.request()
			.input('Correo', sql.NVarChar(150), correo)
			.input('Contrasena', sql.NVarChar(200), hashedPassword)
			.input('NumeroTel', sql.NVarChar(20), numero_tel || null)
			.input('Activo', sql.Bit, 1)
			.query(`
				INSERT INTO Usuarios (Correo, Contrasena, NumeroTel, Activo)
				OUTPUT INSERTED.Id
				VALUES (@Correo, @Contrasena, @NumeroTel, @Activo)
			`);

		return json(
			{
				message: 'Usuario registrado correctamente',
				id: result.recordset[0].Id
			},
			{ status: 201 }
		);
	} catch (err) {
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
