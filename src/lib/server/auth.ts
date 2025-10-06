import jwt from 'jsonwebtoken';
import type { RequestEvent } from '@sveltejs/kit';

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
export function generateToken(payload: JWTPayload, expiresIn: string = '12h'): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn });
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
