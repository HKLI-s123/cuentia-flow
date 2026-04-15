import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getConnection } from '$lib/server/db';
import bcrypt from 'bcryptjs';

// Planes de usuario con límites de creación de usuarios por día y total
const PLANES_USUARIO = {
	FREE: { nombre: 'Gratuito', usuarios_por_dia: 10, usuarios_total: 10 },
	BASIC: { nombre: 'Básico', usuarios_por_dia: 10, usuarios_total: 100 },
	PRO: { nombre: 'Profesional', usuarios_por_dia: 10, usuarios_total: 100 },
	ENTERPRISE: { nombre: 'Empresarial', usuarios_por_dia: 50, usuarios_total: 500 }
};

const PLAN_DEFECTO = 'FREE';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const organizacionId = url.searchParams.get('organizacionId');
		const getLimites = url.searchParams.get('limites') === 'true';
		const usuarioActualId = locals.user?.id;

		if (!organizacionId) {
			return json({
				success: false,
				error: 'organizacionId es requerido'
			}, { status: 400 });
		}

		const pool = await getConnection();

		// Si se solicita información de límites
		if (getLimites && locals.user) {
			try {
				// Obtener plan del usuario
				let planUsuario = PLAN_DEFECTO;
				const userPlanResult = await pool.query(
					'SELECT plan_id FROM usuarios WHERE id = $1',
					[locals.user.id]
				);

				if (userPlanResult.rows.length > 0 && userPlanResult.rows[0].plan_id) {
					planUsuario = userPlanResult.rows[0].plan_id;
				}

				const planInfo = PLANES_USUARIO[planUsuario as keyof typeof PLANES_USUARIO] || PLANES_USUARIO.FREE;

				// Contar usuarios totales (excluyendo al usuario actual)
				const totalResult = await pool.query(
					`SELECT COUNT(*) as total
					 FROM usuario_organizacion
					 WHERE organizacionid = $1 AND usuarioid != $2`,
					[parseInt(organizacionId!), locals.user.id]
				);

				const usuariosTotales = parseInt(totalResult.rows[0].total);

				// Contar usuarios creados en últimas 24 horas
				const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
				const diarioResult = await pool.query(
					`SELECT COUNT(*) as total
					 FROM usuario_organizacion
					 WHERE organizacionid = $1 AND createdat >= $2 AND usuarioid != $3`,
					[parseInt(organizacionId!), hace24Horas, locals.user.id]
				);

				const usuariosPorDia = parseInt(diarioResult.rows[0].total);

				return json({
					success: true,
					limites: {
						plan: planUsuario,
						planNombre: planInfo.nombre,
						usuarios_totales: {
							actual: usuariosTotales,
							límite: planInfo.usuarios_total,
							disponibles: Math.max(0, planInfo.usuarios_total - usuariosTotales)
						},
						usuarios_hoy: {
							actual: usuariosPorDia,
							límite: planInfo.usuarios_por_dia,
							disponibles: Math.max(0, planInfo.usuarios_por_dia - usuariosPorDia)
						}
					}
				});
			} catch (err) {
				console.error('Error al obtener límites:', err);
				return json({
					success: false,
					error: 'Error al obtener límites'
				}, { status: 500 });
			}
		}

		// Obtener usuarios de la organización (excluyendo al usuario actual para ver solo empleados creados)
		const query = `
			SELECT
				u.id,
				u.correo,
				u.nombre,
				u.apellido,
				u.numerotel,
				u.activo,
				uo.rolid,
				r.nombre as rolnombre,
				uo.organizacionid,
				uo.createdat
			FROM usuarios u
			INNER JOIN usuario_organizacion uo ON u.id = uo.usuarioid
			LEFT JOIN roles r ON uo.rolid = r.id
			WHERE uo.organizacionid = $1 AND u.id != $2
			ORDER BY u.nombre ASC, u.apellido ASC
		`;

		const result = await pool.query(query, [parseInt(organizacionId), usuarioActualId || 0]);

		return json({
			success: true,
			usuarios: result.rows.map((usuario: any) => ({
				id: usuario.id,
				correo: usuario.correo,
				nombre: usuario.nombre,
				apellido: usuario.apellido,
				numeroTel: usuario.numerotel,
				activo: usuario.activo,
				fechaCreacion: usuario.createdat,
				rolId: usuario.rolid,
				rolNombre: usuario.rolnombre,
				organizacionId: usuario.organizacionid
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
			SELECT r.nombre
			FROM usuario_organizacion uo
			INNER JOIN roles r ON uo.rolid = r.id
			WHERE uo.usuarioid = $1 AND uo.organizacionid = $2
		`;

		const rolCreador = await pool.query(rolCreadorQuery, [usuarioCreadorId, organizacionId]);

		if (rolCreador.rows.length === 0) {
			return json({
				success: false,
				error: 'Usuario creador no encontrado en la organización'
			}, { status: 403 });
		}

		const nombreRol = rolCreador.rows[0].nombre;
		if (nombreRol !== 'Administrador') {
			return json({
				success: false,
				error: 'No tiene permisos para crear usuarios',
				message: 'Solo los usuarios con rol de Administrador pueden crear nuevos usuarios'
			}, { status: 403 });
		}

		// ========== VALIDACIÓN DE LÍMITES DE USUARIOS ==========

		// Obtener plan del usuario creador
		let planUsuario = PLAN_DEFECTO;
		try {
			const userPlanResult = await pool.query(
				'SELECT plan_id FROM usuarios WHERE id = $1',
				[usuarioCreadorId]
			);
			if (userPlanResult.rows.length > 0 && userPlanResult.rows[0].plan_id) {
				planUsuario = userPlanResult.rows[0].plan_id;
			}
		} catch (err) {
			console.warn('[POST USUARIOS] No se pudo obtener plan_id, usando plan por defecto');
		}

		const planInfo = PLANES_USUARIO[planUsuario as keyof typeof PLANES_USUARIO] || PLANES_USUARIO.FREE;

		// Validar límite de usuarios totales en la organización (excluyendo al creador)
		const totalUsuariosResult = await pool.query(
			`SELECT COUNT(*) as total
			 FROM usuario_organizacion
			 WHERE organizacionid = $1 AND usuarioid != $2`,
			[organizacionId, usuarioCreadorId]
		);

		const usuariosTotales = parseInt(totalUsuariosResult.rows[0].total);

		if (usuariosTotales >= planInfo.usuarios_total) {
			return json({
				success: false,
				error: 'Límite de usuarios alcanzado',
				message: `Tu plan ${planInfo.nombre} permite máximo ${planInfo.usuarios_total} usuario(s). Ya tienes ${usuariosTotales}.`,
				status_code: 'LIMIT_TOTAL_EXCEEDED',
				limites: {
					total: {
						actual: usuariosTotales,
						límite: planInfo.usuarios_total,
						disponibles: 0
					}
				}
			}, { status: 429 });
		}

		// Validar límite de usuarios por día (últimas 24 horas)
		const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const usuariosPorDiaResult = await pool.query(
			`SELECT COUNT(*) as total
			 FROM usuario_organizacion
			 WHERE organizacionid = $1 AND createdat >= $2 AND usuarioid != $3`,
			[organizacionId, hace24Horas, usuarioCreadorId]
		);

		const usuariosPorDia = parseInt(usuariosPorDiaResult.rows[0].total);

		if (usuariosPorDia >= planInfo.usuarios_por_dia) {
			return json({
				success: false,
				error: 'Límite diario de usuarios alcanzado',
				message: `Tu plan ${planInfo.nombre} permite máximo ${planInfo.usuarios_por_dia} usuario(s) por día. Ya creaste ${usuariosPorDia} hoy.`,
				status_code: 'LIMIT_DAILY_EXCEEDED',
				limites: {
					diarios: {
						actual: usuariosPorDia,
						límite: planInfo.usuarios_por_dia,
						disponibles: 0
					}
				}
			}, { status: 429 });
		}

		// ========== FIN VALIDACIÓN DE LÍMITES ==========

		// Verificar si el correo ya existe
		const existeUsuario = await pool.query(
			`SELECT id FROM usuarios WHERE correo = $1`,
			[correo]
		);

		if (existeUsuario.rows.length > 0) {
			return json({
				success: false,
				error: 'El correo electrónico ya está registrado'
			}, { status: 400 });
		}

		// Hash de la contraseña usando bcryptjs (mismo que login)
		const salt = await bcrypt.genSalt(12);
		const hashedPassword = await bcrypt.hash(contrasena, salt);

		// Insertar en tabla Usuarios
		const insertUsuarioQuery = `
			INSERT INTO usuarios (correo, contrasena, numerotel, activo, nombre, apellido)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id
		`;

		const resultUsuario = await pool.query(insertUsuarioQuery, [
			correo,
			hashedPassword,
			numero_tel || null,
			activo ? true : false,
			Nombre,
			Apellido
		]);

		const usuarioId = resultUsuario.rows[0].id;

		// Insertar en tabla Usuario_Organizacion
		const ahora = new Date();
		const insertUsuarioOrgQuery = `
			INSERT INTO usuario_organizacion (usuarioid, organizacionid, rolid, createdat, updatedat)
			VALUES ($1, $2, $3, $4, $5)
		`;

		await pool.query(insertUsuarioOrgQuery, [
			usuarioId,
			organizacionId,
			rolId,
			ahora,
			ahora
		]);

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
