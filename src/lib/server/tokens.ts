/**
 * Sistema mejorado de Tokens JWT con Refresh Token
 * Proporciona mejor control de sesiones y seguridad
 */

import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { secureLog } from './security';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'change-me-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface AuthToken {
	id: number;
	correo: string;
	nombre?: string;
	apellido?: string;
	organizacion?: number;
	rolId?: number;
	iat?: number;
	exp?: number;
}

/**
 * Genera un nuevo Access Token (corta duración)
 */
export function generateAccessToken(payload: AuthToken): string {
	const secretCheck = validateSecretConfiguration();
	if (!secretCheck.valid) {
		throw new Error(`🔐 Configuración insegura: ${secretCheck.message}`);
	}

	try {
		return jwt.sign(payload, JWT_SECRET, {
			expiresIn: JWT_EXPIRES_IN,
			algorithm: 'HS256',
			issuer: 'cobranza-app',
			audience: 'cobranza-api'
		} as SignOptions);
	} catch (error) {
		secureLog('error', 'Error generating access token', { error });
		throw new Error('No se pudo generar el token de acceso');
	}
}

/**
 * Genera un nuevo Refresh Token (larga duración)
 * Se usa para renovar el Access Token sin pedir credenciales de nuevo
 */
export function generateRefreshToken(payload: AuthToken): string {
	const secretCheck = validateSecretConfiguration();
	if (!secretCheck.valid) {
		throw new Error(`🔐 Configuración insegura: ${secretCheck.message}`);
	}

	try {
		return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
			expiresIn: REFRESH_TOKEN_EXPIRES_IN,
			algorithm: 'HS256',
			issuer: 'cobranza-app',
			audience: 'cobranza-refresh'
		} as SignOptions);
	} catch (error) {
		secureLog('error', 'Error generating refresh token', { error });
		throw new Error('No se pudo generar el token de refresco');
	}
}

/**
 * Verifica y decodifica un Access Token
 */
export function verifyAccessToken(token: string): AuthToken | null {
	try {
		const decoded = jwt.verify(token, JWT_SECRET, {
			algorithms: ['HS256'],
			issuer: 'cobranza-app',
			audience: 'cobranza-api'
		});

		return decoded as AuthToken;
	} catch (error) {
		// No loguear tokens en logs por seguridad
		if (error instanceof jwt.TokenExpiredError) {
			secureLog('warn', 'Access token expired');
		} else if (error instanceof jwt.JsonWebTokenError) {
			secureLog('warn', 'Invalid access token');
		}
		return null;
	}
}

/**
 * Verifica y decodifica un Refresh Token
 */
export function verifyRefreshToken(token: string): AuthToken | null {
	try {
		const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
			algorithms: ['HS256'],
			issuer: 'cobranza-app',
			audience: 'cobranza-refresh'
		});

		return decoded as AuthToken;
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			secureLog('warn', 'Refresh token expired');
		} else if (error instanceof jwt.JsonWebTokenError) {
			secureLog('warn', 'Invalid refresh token');
		}
		return null;
	}
}

/**
 * Genera tanto Access como Refresh Token (para login)
 */
export function generateTokenPair(payload: AuthToken): {
	accessToken: string;
	refreshToken: string;
	expiresIn: string;
} {
	return {
		accessToken: generateAccessToken(payload),
		refreshToken: generateRefreshToken(payload),
		expiresIn: JWT_EXPIRES_IN
	};
}

/**
 * Extrae el token del header Authorization
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	return authHeader.substring(7).trim();
}

/**
 * Valida que las variables de entorno estén configuradas adecuadamente
 */
function validateSecretConfiguration(): { valid: boolean; message: string } {
	// Verificar que JWT_SECRET no sea el valor por defecto inseguro
	if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me-in-production') {
		return {
			valid: false,
			message:
				'JWT_SECRET no configurado. Configure una clave segura en las variables de entorno (mínimo 32 caracteres aleatorios)'
		};
	}

	if (process.env.JWT_SECRET.length < 32) {
		return {
			valid: false,
			message: 'JWT_SECRET debe tener al menos 32 caracteres'
		};
	}

	if (!process.env.REFRESH_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET === 'change-me-refresh-secret') {
		return {
			valid: false,
			message:
				'REFRESH_TOKEN_SECRET no configurado. Configure una clave segura diferente a JWT_SECRET'
		};
	}

	if (process.env.REFRESH_TOKEN_SECRET.length < 32) {
		return {
			valid: false,
			message: 'REFRESH_TOKEN_SECRET debe tener al menos 32 caracteres'
		};
	}

	if (process.env.JWT_SECRET === process.env.REFRESH_TOKEN_SECRET) {
		return {
			valid: false,
			message:
				'JWT_SECRET y REFRESH_TOKEN_SECRET deben ser diferentes'
		};
	}

	return { valid: true, message: 'Configuración válida' };
}

/**
 * Función para debugging en desarrollo (solo se ejecuta si NODE_ENV !== production)
 */
export function validateSecretsAtStartup(): void {
	if (process.env.NODE_ENV === 'production') {
		const check = validateSecretConfiguration();
		if (!check.valid) {
			console.error('❌ FATAL: ' + check.message);
			process.exit(1);
		}
		console.info('✅ Secretos configurados correctamente');
	}
}
