import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';
import bcrypt from 'bcryptjs';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const organizacionId = url.searchParams.get('organizacionId');

		if (!organizacionId) {
			return json({
				success: false,
				error: 'organizacionId es requerido'
			}, { status: 400 });
		}

		const pool = await getConnection();

		// Obtener usuarios de la organización
		const query = `
			SELECT
				u.Id,
				u.Correo,
				u.Nombre,
				u.Apellido,
				u.NumeroTel,
				u.Activo,
				uo.RolId,
				r.Nombre as RolNombre,
				uo.OrganizacionId,
				uo.CreatedAt
			FROM Usuarios u
			INNER JOIN Usuario_Organizacion uo ON u.Id = uo.UsuarioId
			LEFT JOIN Roles r ON uo.RolId = r.Id
			WHERE uo.OrganizacionId = @OrganizacionId
			ORDER BY u.Nombre ASC, u.Apellido ASC
		`;

		const result = await pool
			.request()
			.input('OrganizacionId', sql.Int, parseInt(organizacionId))
			.query(query);

		return json({
			success: true,
			usuarios: result.recordset.map((usuario: any) => ({
				id: usuario.Id,
				correo: usuario.Correo,
				nombre: usuario.Nombre,
				apellido: usuario.Apellido,
				numeroTel: usuario.NumeroTel,
				activo: usuario.Activo,
				fechaCreacion: usuario.CreatedAt,
				rolId: usuario.RolId,
				rolNombre: usuario.RolNombre,
				organizacionId: usuario.OrganizacionId
			}))
		});

	} catch (err) {
		console.error('Error al obtener usuarios:', err);
		return json({
			success: false,
			error: 'Error en el servidor',
			details: err instanceof Error ? err.message : 'Error desconocido'
		}, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { correo, contrasena, numero_tel, Nombre, Apellido, activo, organizacionId, rolId, usuarioCreadorId } = await request.json();

		// Validaciones
		if (!correo || !contrasena || !Nombre || !Apellido) {
			return json({
				success: false,
				error: 'Correo, contraseña, nombre y apellido son requeridos'
			}, { status: 400 });
		}

		if (!organizacionId) {
			return json({
				success: false,
				error: 'Debe seleccionar una organización'
			}, { status: 400 });
		}

		if (!rolId) {
			return json({
				success: false,
				error: 'Debe seleccionar un rol'
			}, { status: 400 });
		}

		if (!usuarioCreadorId) {
			return json({
				success: false,
				error: 'ID del usuario creador es requerido'
			}, { status: 400 });
		}

		const pool = await getConnection();

		// Validar que el usuario creador sea administrador
		const rolCreadorQuery = `
			SELECT r.Nombre
			FROM Usuario_Organizacion uo
			INNER JOIN Roles r ON uo.RolId = r.Id
			WHERE uo.UsuarioId = @UsuarioCreadorId AND uo.OrganizacionId = @OrganizacionId
		`;

		const rolCreador = await pool
			.request()
			.input('UsuarioCreadorId', sql.Int, usuarioCreadorId)
			.input('OrganizacionId', sql.Int, organizacionId)
			.query(rolCreadorQuery);

		if (rolCreador.recordset.length === 0) {
			return json({
				success: false,
				error: 'Usuario creador no encontrado en la organización'
			}, { status: 403 });
		}

		const nombreRol = rolCreador.recordset[0].Nombre;
		if (nombreRol !== 'Administrador') {
			return json({
				success: false,
				error: 'No tiene permisos para crear usuarios',
				message: 'Solo los usuarios con rol de Administrador pueden crear nuevos usuarios'
			}, { status: 403 });
		}

		// Verificar si el correo ya existe
		const existeUsuario = await pool
			.request()
			.input('Correo', sql.NVarChar(150), correo)
			.query(`SELECT Id FROM Usuarios WHERE Correo = @Correo`);

		if (existeUsuario.recordset.length > 0) {
			return json({
				success: false,
				error: 'El correo electrónico ya está registrado'
			}, { status: 400 });
		}

		// Hash de la contraseña usando bcryptjs (mismo que login)
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(contrasena, salt);

		// Insertar en tabla Usuarios
		const insertUsuarioQuery = `
			INSERT INTO Usuarios (Correo, Contrasena, NumeroTel, Activo, Nombre, Apellido)
			OUTPUT INSERTED.Id
			VALUES (@Correo, @Contrasena, @NumeroTel, @Activo, @Nombre, @Apellido)
		`;

		const resultUsuario = await pool
			.request()
			.input('Correo', sql.NVarChar(150), correo)
			.input('Contrasena', sql.NVarChar(255), hashedPassword)
			.input('NumeroTel', sql.NVarChar(20), numero_tel || null)
			.input('Activo', sql.Bit, activo ? 1 : 0)
			.input('Nombre', sql.NVarChar(100), Nombre)
			.input('Apellido', sql.NVarChar(100), Apellido)
			.query(insertUsuarioQuery);

		const usuarioId = resultUsuario.recordset[0].Id;

		// Insertar en tabla Usuario_Organizacion
		const ahora = new Date();
		const insertUsuarioOrgQuery = `
			INSERT INTO Usuario_Organizacion (UsuarioId, OrganizacionId, RolId, CreatedAt, UpdatedAt)
			VALUES (@UsuarioId, @OrganizacionId, @RolId, @CreatedAt, @UpdatedAt)
		`;

		await pool
			.request()
			.input('UsuarioId', sql.Int, usuarioId)
			.input('OrganizacionId', sql.Int, organizacionId)
			.input('RolId', sql.Int, rolId)
			.input('CreatedAt', sql.DateTime, ahora)
			.input('UpdatedAt', sql.DateTime, ahora)
			.query(insertUsuarioOrgQuery);

		return json({
			success: true,
			message: 'Usuario creado exitosamente',
			usuarioId: usuarioId
		}, { status: 201 });

	} catch (err) {
		console.error('Error al crear usuario:', err);
		return json({
			success: false,
			error: 'Error en el servidor',
			details: err instanceof Error ? err.message : 'Error desconocido'
		}, { status: 500 });
	}
};
