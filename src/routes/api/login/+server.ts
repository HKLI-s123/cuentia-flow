import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { generateToken } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { correo, contrasena } = await request.json();

		if (!correo || !contrasena) {
			return json({ error: 'Correo y contraseña son requeridos' }, { status: 400 });
		}

		const pool = await getConnection();

		// Buscar usuario activo
		const result = await pool
			.request()
			.input('Correo', sql.NVarChar(150), correo)
			.query(`SELECT * FROM Usuarios WHERE Correo = @Correo AND Activo = 1`);

		if (result.recordset.length === 0) {
			return json({ error: 'Usuario no encontrado o inactivo' }, { status: 400 });
		}

		const user = result.recordset[0];

		// Validar contraseña
		const validPassword = await bcrypt.compare(contrasena, user.Contrasena);
		if (!validPassword) {
			return json({ error: 'Contraseña incorrecta' }, { status: 401 });
		}

		// Crear token JWT
		const token = generateToken(
			{
				id: user.Id,
				correo: user.Correo,
				organizacion: user.OrganizacionId
			},
			'12h'
		);

		return json({
			message: 'Login exitoso',
			token,
			usuario: {
				id: user.Id,
				correo: user.Correo,
				nombre: user.Nombre,
				apellido: user.Apellido,
				organizacion: user.OrganizacionId
			}
		});
	} catch (err) {
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
