import { json } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import bcrypt from 'bcryptjs';

export async function POST({ request }) {
	const { token, contrasena } = await request.json();
	if (!token || !contrasena) return json({ error: 'Datos requeridos' }, { status: 400 });

	// Validar fortaleza de contraseña
	if (contrasena.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
	if (!/[A-Z]/.test(contrasena)) return json({ error: 'La contraseña debe incluir al menos una mayúscula' }, { status: 400 });
	if (!/[0-9]/.test(contrasena)) return json({ error: 'La contraseña debe incluir al menos un número' }, { status: 400 });

	const pool = await getConnection();
	const userResult = await pool.query(
			'SELECT Id, password_reset_expires FROM Usuarios WHERE password_reset_token = $1',
			[token]
		);
	const user = userResult.rows[0];
	if (!user) return json({ error: 'Token inválido' }, { status: 400 });
	if (new Date() > user.password_reset_expires) return json({ error: 'Token expirado' }, { status: 400 });

	const hash = await bcrypt.hash(contrasena, 12);
	await pool.query(
			`
			UPDATE Usuarios
			SET Contrasena = $2, password_reset_token = NULL, password_reset_expires = NULL
			WHERE Id = $1
		`,
			[user.id, hash]
		);

	return json({ success: true });
}
