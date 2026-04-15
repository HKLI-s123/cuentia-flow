import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
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
			SELECT r.nombre
			FROM usuario_organizacion uo
			INNER JOIN roles r ON uo.rolid = r.id
			WHERE uo.usuarioid = $1 AND uo.organizacionid = $2
		`;

		const rolEditor = await pool.query(rolEditorQuery, [usuarioEditorId, organizacionId]);

		if (rolEditor.rows.length === 0) {
			return json({
				success: false,
				error: 'Usuario editor no encontrado en la organización'
			}, { status: 403 });
		}

		const nombreRol = rolEditor.rows[0].nombre;
		if (nombreRol !== 'Administrador') {
			return json({
				success: false,
				error: 'No tiene permisos para editar usuarios',
				message: 'Solo los usuarios con rol de Administrador pueden editar usuarios'
			}, { status: 403 });
		}

		// Verificar si el usuario existe
		const existeUsuario = await pool.query(
			`SELECT id FROM usuarios WHERE id = $1`,
			[usuarioId]
		);

		if (existeUsuario.rows.length === 0) {
			return json({
				success: false,
				error: 'Usuario no encontrado'
			}, { status: 404 });
		}

		// Verificar si el correo ya existe en otro usuario
		const correoExiste = await pool.query(
			`SELECT id FROM usuarios WHERE correo = $1 AND id != $2`,
			[correo, usuarioId]
		);

		if (correoExiste.rows.length > 0) {
			return json({
				success: false,
				error: 'El correo electrónico ya está registrado en otro usuario'
			}, { status: 400 });
		}

		// Actualizar tabla Usuarios
		const updateParams: any[] = [correo, numero_tel || null, activo ? true : false, Nombre, Apellido];
		let paramIndex = 6;

		let updateUsuarioQuery = `
			UPDATE usuarios SET
				correo = $1,
				numerotel = $2,
				activo = $3,
				nombre = $4,
				apellido = $5
		`;

		// Si se proporciona una nueva contraseña, hashearla y actualizarla
		if (contrasena && contrasena.trim() !== '') {
			const salt = await bcrypt.genSalt(12);
			const hashedPassword = await bcrypt.hash(contrasena, salt);

			updateUsuarioQuery += `, contrasena = $${paramIndex}`;
			updateParams.push(hashedPassword);
			paramIndex++;
		}

		updateUsuarioQuery += ` WHERE id = $${paramIndex}`;
		updateParams.push(usuarioId);

		await pool.query(updateUsuarioQuery, updateParams);

		// Actualizar Usuario_Organizacion
		const ahora = new Date();
		const updateUsuarioOrgQuery = `
			UPDATE usuario_organizacion SET
				rolid = $1,
				updatedat = $2
			WHERE usuarioid = $3 AND organizacionid = $4
		`;

		await pool.query(updateUsuarioOrgQuery, [rolId, ahora, usuarioId, organizacionId]);

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
		const existeUsuario = await pool.query(
			`SELECT id FROM usuarios WHERE id = $1`,
			[usuarioId]
		);

		if (existeUsuario.rows.length === 0) {
			return json({
				success: false,
				error: 'Usuario no encontrado'
			}, { status: 404 });
		}

		// Verificar si el usuario está asignado a clientes en agentes_clientes
		const asignaciones = await pool.query(
			`SELECT clienteid FROM agentes_clientes WHERE usuarioid = $1`,
			[usuarioId]
		);

		if (asignaciones.rows.length > 0) {
			// El usuario está asignado a clientes, verificar si tienen facturas vencidas
			const clienteIds = asignaciones.rows.map((r: any) => r.clienteid);

			// Build parameterized placeholders for IN clause
			const placeholders = clienteIds.map((_: any, i: number) => `$${i + 1}`).join(',');
			const facturasVencidasQuery = `
				SELECT COUNT(*) as totalvencidas
				FROM facturas f
				WHERE f.clienteid IN (${placeholders})
				AND f.estado_factura_id = 4
				AND f.saldopendiente > 0
			`;

			const facturasVencidas = await pool.query(facturasVencidasQuery, clienteIds);

			const totalVencidas = parseInt(facturasVencidas.rows[0].totalvencidas);

			if (totalVencidas > 0) {
				return json({
					success: false,
					error: 'No se puede eliminar el usuario',
					message: `Este usuario está asignado a clientes que tienen ${totalVencidas} factura(s) vencida(s). Debe resolver las facturas vencidas antes de eliminar el usuario.`,
					detalles: {
						clientesAsignados: asignaciones.rows.length,
						facturasVencidas: totalVencidas
					}
				}, { status: 400 });
			}

			// Tiene clientes asignados pero sin facturas vencidas
			return json({
				success: false,
				error: 'No se puede eliminar el usuario',
				message: `Este usuario está asignado a ${asignaciones.rows.length} cliente(s). Debe desasignar los clientes antes de eliminar el usuario.`,
				detalles: {
					clientesAsignados: asignaciones.rows.length
				}
			}, { status: 400 });
		}

		// No tiene clientes asignados, proceder a "eliminar"
		// Eliminar de Usuario_Organizacion
		await pool.query(
			`DELETE FROM usuario_organizacion WHERE usuarioid = $1`,
			[usuarioId]
		);

		// Marcar como inactivo en Usuarios (soft delete)
		await pool.query(
			`UPDATE usuarios SET activo = false WHERE id = $1`,
			[usuarioId]
		);

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
