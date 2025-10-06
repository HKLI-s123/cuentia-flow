import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import sql from 'mssql';
import bcrypt from 'bcryptjs';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { id } = params;
		const usuarioId = parseInt(id);
		const { correo, contrasena, numero_tel, Nombre, Apellido, activo, organizacionId, rolId, usuarioEditorId } = await request.json();

		if (!usuarioId || isNaN(usuarioId)) {
			return json({
				success: false,
				error: 'ID de usuario inválido'
			}, { status: 400 });
		}

		// Validaciones básicas
		if (!correo || !Nombre || !Apellido) {
			return json({
				success: false,
				error: 'Correo, nombre y apellido son requeridos'
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

		if (!usuarioEditorId) {
			return json({
				success: false,
				error: 'ID del usuario editor es requerido'
			}, { status: 400 });
		}

		const pool = await getConnection();

		// Validar que el usuario editor sea administrador
		const rolEditorQuery = `
			SELECT r.Nombre
			FROM Usuario_Organizacion uo
			INNER JOIN Roles r ON uo.RolId = r.Id
			WHERE uo.UsuarioId = @UsuarioEditorId AND uo.OrganizacionId = @OrganizacionId
		`;

		const rolEditor = await pool
			.request()
			.input('UsuarioEditorId', sql.Int, usuarioEditorId)
			.input('OrganizacionId', sql.Int, organizacionId)
			.query(rolEditorQuery);

		if (rolEditor.recordset.length === 0) {
			return json({
				success: false,
				error: 'Usuario editor no encontrado en la organización'
			}, { status: 403 });
		}

		const nombreRol = rolEditor.recordset[0].Nombre;
		if (nombreRol !== 'Administrador') {
			return json({
				success: false,
				error: 'No tiene permisos para editar usuarios',
				message: 'Solo los usuarios con rol de Administrador pueden editar usuarios'
			}, { status: 403 });
		}

		// Verificar si el usuario existe
		const existeUsuario = await pool
			.request()
			.input('UsuarioId', sql.Int, usuarioId)
			.query(`SELECT Id FROM Usuarios WHERE Id = @UsuarioId`);

		if (existeUsuario.recordset.length === 0) {
			return json({
				success: false,
				error: 'Usuario no encontrado'
			}, { status: 404 });
		}

		// Verificar si el correo ya existe en otro usuario
		const correoExiste = await pool
			.request()
			.input('Correo', sql.NVarChar(150), correo)
			.input('UsuarioId', sql.Int, usuarioId)
			.query(`SELECT Id FROM Usuarios WHERE Correo = @Correo AND Id != @UsuarioId`);

		if (correoExiste.recordset.length > 0) {
			return json({
				success: false,
				error: 'El correo electrónico ya está registrado en otro usuario'
			}, { status: 400 });
		}

		// Actualizar tabla Usuarios
		let updateUsuarioQuery = `
			UPDATE Usuarios SET
				Correo = @Correo,
				NumeroTel = @NumeroTel,
				Activo = @Activo,
				Nombre = @Nombre,
				Apellido = @Apellido
		`;

		const sqlRequest = pool.request()
			.input('Correo', sql.NVarChar(150), correo)
			.input('NumeroTel', sql.NVarChar(20), numero_tel || null)
			.input('Activo', sql.Bit, activo ? 1 : 0)
			.input('Nombre', sql.NVarChar(100), Nombre)
			.input('Apellido', sql.NVarChar(100), Apellido);

		// Si se proporciona una nueva contraseña, hashearla y actualizarla
		if (contrasena && contrasena.trim() !== '') {
			const salt = await bcrypt.genSalt(10);
			const hashedPassword = await bcrypt.hash(contrasena, salt);

			updateUsuarioQuery += `, Contrasena = @Contrasena`;
			sqlRequest.input('Contrasena', sql.NVarChar(255), hashedPassword);
		}

		updateUsuarioQuery += ` WHERE Id = @UsuarioId`;
		sqlRequest.input('UsuarioId', sql.Int, usuarioId);

		await sqlRequest.query(updateUsuarioQuery);

		// Actualizar Usuario_Organizacion
		const ahora = new Date();
		const updateUsuarioOrgQuery = `
			UPDATE Usuario_Organizacion SET
				RolId = @RolId,
				UpdatedAt = @UpdatedAt
			WHERE UsuarioId = @UsuarioId AND OrganizacionId = @OrganizacionId
		`;

		await pool
			.request()
			.input('RolId', sql.Int, rolId)
			.input('UpdatedAt', sql.DateTime, ahora)
			.input('UsuarioId', sql.Int, usuarioId)
			.input('OrganizacionId', sql.Int, organizacionId)
			.query(updateUsuarioOrgQuery);

		return json({
			success: true,
			message: 'Usuario actualizado exitosamente'
		});

	} catch (err) {
		console.error('Error al actualizar usuario:', err);
		return json({
			success: false,
			error: 'Error en el servidor',
			details: err instanceof Error ? err.message : 'Error desconocido'
		}, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const { id } = params;
		const usuarioId = parseInt(id);

		if (!usuarioId || isNaN(usuarioId)) {
			return json({
				success: false,
				error: 'ID de usuario inválido'
			}, { status: 400 });
		}

		const pool = await getConnection();

		// Verificar si el usuario existe
		const existeUsuario = await pool
			.request()
			.input('UsuarioId', sql.Int, usuarioId)
			.query(`SELECT Id FROM Usuarios WHERE Id = @UsuarioId`);

		if (existeUsuario.recordset.length === 0) {
			return json({
				success: false,
				error: 'Usuario no encontrado'
			}, { status: 404 });
		}

		// Verificar si el usuario está asignado a clientes en agentes_clientes
		const asignacionesQuery = `
			SELECT ac.ClienteId
			FROM agentes_clientes ac
			WHERE ac.UsuarioId = @UsuarioId
		`;

		const asignaciones = await pool
			.request()
			.input('UsuarioId', sql.Int, usuarioId)
			.query(asignacionesQuery);

		if (asignaciones.recordset.length > 0) {
			// El usuario está asignado a clientes, verificar si tienen facturas vencidas
			const clienteIds = asignaciones.recordset.map((r: any) => r.ClienteId);

			const facturasVencidasQuery = `
				SELECT COUNT(*) as TotalVencidas
				FROM Facturas f
				WHERE f.ClienteId IN (${clienteIds.join(',')})
				AND f.estado_factura_id = 4
				AND f.SaldoPendiente > 0
			`;

			const facturasVencidas = await pool
				.request()
				.query(facturasVencidasQuery);

			const totalVencidas = facturasVencidas.recordset[0].TotalVencidas;

			if (totalVencidas > 0) {
				return json({
					success: false,
					error: 'No se puede eliminar el usuario',
					message: `Este usuario está asignado a clientes que tienen ${totalVencidas} factura(s) vencida(s). Debe resolver las facturas vencidas antes de eliminar el usuario.`,
					detalles: {
						clientesAsignados: asignaciones.recordset.length,
						facturasVencidas: totalVencidas
					}
				}, { status: 400 });
			}

			// Tiene clientes asignados pero sin facturas vencidas
			return json({
				success: false,
				error: 'No se puede eliminar el usuario',
				message: `Este usuario está asignado a ${asignaciones.recordset.length} cliente(s). Debe desasignar los clientes antes de eliminar el usuario.`,
				detalles: {
					clientesAsignados: asignaciones.recordset.length
				}
			}, { status: 400 });
		}

		// No tiene clientes asignados, proceder a "eliminar"
		// Eliminar de Usuario_Organizacion
		await pool
			.request()
			.input('UsuarioId', sql.Int, usuarioId)
			.query(`DELETE FROM Usuario_Organizacion WHERE UsuarioId = @UsuarioId`);

		// Marcar como inactivo en Usuarios (soft delete)
		await pool
			.request()
			.input('UsuarioId', sql.Int, usuarioId)
			.query(`UPDATE Usuarios SET Activo = 0 WHERE Id = @UsuarioId`);

		return json({
			success: true,
			message: 'Usuario desactivado exitosamente'
		});

	} catch (err) {
		console.error('Error al eliminar usuario:', err);
		return json({
			success: false,
			error: 'Error en el servidor',
			details: err instanceof Error ? err.message : 'Error desconocido'
		}, { status: 500 });
	}
};
