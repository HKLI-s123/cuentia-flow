import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import bcrypt from 'bcryptjs';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { validateName, validateEmail, validatePassword } from '$lib/server/security';
import { generateAccessToken, generateRefreshToken } from '$lib/server/tokens';

export const PUT: RequestHandler = async (event) => {
	try {
		// Verificar autenticación
		const authUser = getUserFromRequest(event);
		if (!authUser) {
			return unauthorizedResponse('Token de autorización requerido');
		}

		const { id } = event.params;
		const parsedId = parseInt(id);

		if (authUser.id !== parsedId) {
			return json({ error: 'No autorizado para modificar este usuario' }, { status: 403 });
		}

		const body = await event.request.json();
		const { correo, contrasena, nombre, apellido, activo } = body;

		// Validaciones
		if (nombre !== undefined) {
			const nombreResult = validateName(nombre, 'Nombre');
			if (!nombreResult.valid) {
				return json({ error: nombreResult.error }, { status: 400 });
			}
		}
		if (apellido !== undefined && apellido.trim() !== '') {
			const apellidoResult = validateName(apellido, 'Apellido');
			if (!apellidoResult.valid) {
				return json({ error: apellidoResult.error }, { status: 400 });
			}
		}
		if (correo !== undefined) {
			const correoResult = validateEmail(correo);
			if (!correoResult.valid) {
				return json({ error: correoResult.error }, { status: 400 });
			}
		}
		if (contrasena !== undefined) {
			const passResult = validatePassword(contrasena);
			if (!passResult.valid) {
				return json({ error: passResult.error }, { status: 400 });
			}
		}

		const pool = await getConnection();

		// Verificar si existe el usuario
		const checkUser = await pool.query(
			'SELECT * FROM usuarios WHERE id = $1',
			[parsedId]
		);

		if (checkUser.rows.length === 0) {
			return json({ error: 'Usuario no encontrado' }, { status: 404 });
		}

		// Verificar correo duplicado
		const correoFinal = correo ? correo.trim().toLowerCase() : checkUser.rows[0].correo;
		if (correo && correoFinal !== checkUser.rows[0].correo.toLowerCase()) {
			const emailCheck = await pool.query(
				'SELECT id FROM usuarios WHERE LOWER(correo) = LOWER($1) AND id != $2',
				[correoFinal, parsedId]
			);
			if (emailCheck.rows.length > 0) {
				return json({ error: 'Ya existe otro usuario con ese correo electrónico' }, { status: 409 });
			}
		}

		// Si viene contraseña nueva, la encriptamos
		let hashedPassword = null;
		if (contrasena) {
			hashedPassword = await bcrypt.hash(contrasena, 12);
		}

		const nombreFinal = nombre ? nombre.trim() : checkUser.rows[0].nombre;
		const apellidoFinal = apellido !== undefined ? apellido.trim() : checkUser.rows[0].apellido;

		// Actualizar usuario
		await pool.query(
			`UPDATE usuarios
			 SET correo = $1,
				 contrasena = $2,
				 nombre = $3,
				 apellido = $4,
				 activo = $5
			 WHERE id = $6`,
			[
				correoFinal,
				hashedPassword || checkUser.rows[0].contrasena,
				nombreFinal,
				apellidoFinal,
				activo !== undefined ? activo : checkUser.rows[0].activo,
				parsedId
			]
		);

		// Regenerar tokens con datos actualizados para que la sesión refleje los cambios
		const updatedPayload = {
			id: parsedId,
			correo: correoFinal,
			nombre: nombreFinal,
			apellido: apellidoFinal,
			organizacion: authUser.organizacion,
			rolId: authUser.rolId
		};

		const newAccessToken = generateAccessToken(updatedPayload);
		event.cookies.set('accessToken', newAccessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 15,
			path: '/'
		});

		const newRefreshToken = generateRefreshToken(updatedPayload);
		event.cookies.set('refreshToken', newRefreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7,
			path: '/'
		});

		return json({ message: 'Usuario actualizado correctamente' });
	} catch (err) {
		console.error('Error al actualizar usuario:', err);
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
