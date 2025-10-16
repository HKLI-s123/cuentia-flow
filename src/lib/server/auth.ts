import jwt, { type SignOptions } from 'jsonwebtoken';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getConnection } from './db';
import sql from 'mssql';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecreto';

export interface JWTPayload {
	id: number;
	correo: string;
	organizacion?: number;
}

// Verificar y decodificar token JWT
export function verifyToken(token: string): JWTPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as JWTPayload;
	} catch (error) {
		return null;
	}
}

// Generar token JWT
export function generateToken(payload: JWTPayload, expiresIn: string | number = '12h'): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

// Middleware helper para obtener usuario del token
export function getUserFromRequest(event: RequestEvent): JWTPayload | null {
	const authHeader = event.request.headers.get('authorization');

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.substring(7);
	return verifyToken(token);
}

// Respuesta de error de autenticación
export function unauthorizedResponse(message: string = 'No autorizado') {
	return new Response(JSON.stringify({ error: message }), {
		status: 401,
		headers: { 'Content-Type': 'application/json' }
	});
}

// Respuesta de error de autorización (forbidden)
export function forbiddenResponse(message: string = 'Acceso denegado a esta organización') {
	return new Response(JSON.stringify({ error: message }), {
		status: 403,
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * Middleware de seguridad multi-tenant
 * Valida que el usuario tenga acceso a la organización solicitada
 */
export async function validateOrganizationAccess(
	event: RequestEvent,
	organizacionId: number | string | null
): Promise<{ valid: boolean; user: JWTPayload | null; error?: Response }> {
	// 1. Verificar que el usuario esté autenticado
	const user = getUserFromRequest(event);

	if (!user) {
		return {
			valid: false,
			user: null,
			error: unauthorizedResponse('Token de autenticación inválido o ausente')
		};
	}

	// 2. Si no se proporciona organizacionId, solo validar autenticación
	if (!organizacionId) {
		return { valid: true, user };
	}

	// 3. Convertir organizacionId a número
	const orgId = typeof organizacionId === 'string' ? parseInt(organizacionId) : organizacionId;

	if (isNaN(orgId)) {
		return {
			valid: false,
			user,
			error: json({ error: 'ID de organización inválido' }, { status: 400 })
		};
	}

	// 4. Validar que el usuario tenga acceso a esta organización
	try {
		const pool = await getConnection();

		const result = await pool
			.request()
			.input('UsuarioId', sql.Int, user.id)
			.input('OrganizacionId', sql.Int, orgId)
			.query(`
				SELECT COUNT(*) as Count
				FROM Usuario_Organizacion
				WHERE UsuarioId = @UsuarioId
				AND OrganizacionId = @OrganizacionId
			`);

		const hasAccess = result.recordset[0].Count > 0;

		if (!hasAccess) {
			return {
				valid: false,
				user,
				error: forbiddenResponse('No tienes acceso a esta organización')
			};
		}

		return { valid: true, user };

	} catch (error) {
		return {
			valid: false,
			user,
			error: json({
				error: 'Error al validar permisos',
				details: error instanceof Error ? error.message : 'Error desconocido'
			}, { status: 500 })
		};
	}
}

/**
 * Helper para obtener organizacionId del header X-Organization-Id
 */
export function getOrganizationIdFromHeader(event: RequestEvent): number | null {
	const orgIdHeader = event.request.headers.get('x-organization-id');

	if (!orgIdHeader) {
		return null;
	}

	const orgId = parseInt(orgIdHeader);
	return isNaN(orgId) ? null : orgId;
}

/**
 * Middleware completo: valida autenticación y acceso a organización
 * Uso recomendado en endpoints que requieren acceso a una organización específica
 */
export async function requireOrganizationAccess(
	event: RequestEvent,
	organizacionId?: number | string | null
): Promise<{ user: JWTPayload; organizacionId: number } | Response> {
	// Intentar obtener organizacionId del header si no se proporciona
	const orgId = organizacionId ?? getOrganizationIdFromHeader(event);

	if (!orgId) {
		return json({ error: 'ID de organización requerido (header X-Organization-Id)' }, { status: 400 });
	}

	const validation = await validateOrganizationAccess(event, orgId);

	if (!validation.valid || !validation.user) {
		return validation.error!;
	}

	const finalOrgId = typeof orgId === 'string' ? parseInt(orgId) : orgId;

	return {
		user: validation.user,
		organizacionId: finalOrgId
	};
}
