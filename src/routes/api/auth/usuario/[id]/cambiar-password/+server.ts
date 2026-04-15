import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import bcrypt from 'bcryptjs';
import { getUserFromRequest, unauthorizedResponse } from '$lib/server/auth';
import { validatePassword } from '$lib/server/security';

export const POST: RequestHandler = async (event) => {
	try {
		const authUser = getUserFromRequest(event);
		if (!authUser) {
			return unauthorizedResponse('Token de autorización requerido');
		}

		const { id } = event.params;
		const parsedId = parseInt(id);

		// Solo el propio usuario puede cambiar su contraseña
		if (authUser.id !== parsedId) {
			return json({ error: 'No autorizado para cambiar la contraseña de otro usuario' }, { status: 403 });
		}

		const body = await event.request.json();
		const { contrasenaActual, nuevaContrasena } = body;

		if (!contrasenaActual || typeof contrasenaActual !== 'string') {
			return json({ error: 'La contraseña actual es requerida' }, { status: 400 });
		}

		if (!nuevaContrasena || typeof nuevaContrasena !== 'string') {
			return json({ error: 'La nueva contraseña es requerida' }, { status: 400 });
		}

		// Validar nueva contraseña con las reglas de seguridad del sistema
		const passValidation = validatePassword(nuevaContrasena);
		if (!passValidation.valid) {
			return json({ error: passValidation.error }, { status: 400 });
		}

		const pool = await getConnection();

		// Obtener contraseña actual del usuario
		const userResult = await pool.query(
			'SELECT contrasena FROM usuarios WHERE id = $1',
			[parsedId]
		);

		if (userResult.rows.length === 0) {
			return json({ error: 'Usuario no encontrado' }, { status: 404 });
		}

		// Verificar contraseña actual
		const contrasenaValida = await bcrypt.compare(contrasenaActual, userResult.rows[0].contrasena);
		if (!contrasenaValida) {
			return json({ error: 'La contraseña actual es incorrecta' }, { status: 400 });
		}

		// Evitar reusar la misma contraseña
		const mismaContrasena = await bcrypt.compare(nuevaContrasena, userResult.rows[0].contrasena);
		if (mismaContrasena) {
			return json({ error: 'La nueva contraseña no puede ser igual a la actual' }, { status: 400 });
		}

		// Hash de la nueva contraseña
		const hashedPassword = await bcrypt.hash(nuevaContrasena, 12);

		// Actualizar contraseña
		await pool.query(
			'UPDATE usuarios SET contrasena = $1 WHERE id = $2',
			[hashedPassword, parsedId]
		);

		return json({ success: true, message: 'Contraseña actualizada correctamente' });
	} catch (err) {
		console.error('Error al cambiar contraseña:', err);
		return json({ error: 'Error en el servidor' }, { status: 500 });
	}
};
