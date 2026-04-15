/**
 * Utilidades de Seguridad para Producción
 * Incluye validación, sanitización, y protecciones contra ataques comunes
 */

import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

/**
 * ============================================
 * 1. VALIDACIÓN Y SANITIZACIÓN DE ENTRADA
 * ============================================
 */

export interface ValidationResult {
	valid: boolean;
	error?: string;
	value?: string | null;
}

/**
 * Valida y sanitiza un email
 */
export function validateEmail(email: string): ValidationResult {
	if (!email || typeof email !== 'string') {
		return { valid: false, error: 'Email es requerido' };
	}

	const sanitized = email.trim().toLowerCase();

	// RFC 5322 simplified regex
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (!emailRegex.test(sanitized)) {
		return { valid: false, error: 'Formato de email inválido' };
	}

	if (sanitized.length > 150) {
		return { valid: false, error: 'Email muy largo (máximo 150 caracteres)' };
	}

	return { valid: true, value: sanitized };
}

/**
 * Valida una contraseña según requisitos de seguridad
 * Requisitos:
 * - Mínimo 10 caracteres
 * - Debe contener mayúscula, minúscula, número y símbolo
 */
export function validatePassword(password: string): ValidationResult {
	if (!password || typeof password !== 'string') {
		return { valid: false, error: 'Contraseña es requerida' };
	}

	if (password.length < 10) {
		return {
			valid: false,
			error: 'Contraseña debe tener al menos 10 caracteres'
		};
	}

	if (password.length > 128) {
		return {
			valid: false,
			error: 'Contraseña muy larga (máximo 128 caracteres)'
		};
	}

	// Validar que contenga mayúscula
	if (!/[A-Z]/.test(password)) {
		return {
			valid: false,
			error: 'Contraseña debe contener al menos una mayúscula'
		};
	}

	// Validar que contenga minúscula
	if (!/[a-z]/.test(password)) {
		return {
			valid: false,
			error: 'Contraseña debe contener al menos una minúscula'
		};
	}

	// Validar que contenga número
	if (!/[0-9]/.test(password)) {
		return {
			valid: false,
			error: 'Contraseña debe contener al menos un número'
		};
	}

	// Validar que contenga símbolo especial
	if (!/[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]/.test(password)) {
		return {
			valid: false,
			error: 'Contraseña debe contener al menos un símbolo especial'
		};
	}

	return { valid: true, value: password };
}

/**
 * Valida un nombre o apellido
 */
export function validateName(name: string, fieldName: string = 'Nombre'): ValidationResult {
	if (!name || typeof name !== 'string') {
		return { valid: false, error: `${fieldName} es requerido` };
	}

	const sanitized = name.trim();

	if (sanitized.length < 2) {
		return { valid: false, error: `${fieldName} debe tener al menos 2 caracteres` };
	}

	if (sanitized.length > 100) {
		return { valid: false, error: `${fieldName} muy largo (máximo 100 caracteres)` };
	}

	// Permitir solo letras, espacios y algunos caracteres acentuados
	if (!/^[a-záéíóúñA-ZÁÉÍÓÚÑ\s'-]+$/.test(sanitized)) {
		return { valid: false, error: `${fieldName} contiene caracteres inválidos` };
	}

	return { valid: true, value: sanitized };
}

/**
 * Valida un número de teléfono
 */
export function validatePhoneNumber(phone: string | null): ValidationResult {
	if (!phone) {
		return { valid: true, value: null }; // Opcional
	}

	if (typeof phone !== 'string') {
		return { valid: false, error: 'Teléfono inválido' };
	}

	const sanitized = phone.trim();

	// Permitir solo dígitos, espacios, guiones y símbolos de teléfono
	if (!/^[\d\s\-+()]+$/.test(sanitized)) {
		return { valid: false, error: 'Teléfono contiene caracteres inválidos' };
	}

	if (sanitized.length < 7 || sanitized.length > 20) {
		return { valid: false, error: 'Teléfono debe tener entre 7 y 20 caracteres' };
	}

	return { valid: true, value: sanitized };
}

/**
 * ============================================
 * 2. RATE LIMITING
 * ============================================
 */

interface RateLimitData {
	attempts: number;
	lastAttempt: number;
	blockedUntil?: number;
}

// Store en memoria para rate limiting (en producción usar Redis)
const rateLimitStore = new Map<string, RateLimitData>();

/**
 * Verifica si una dirección IP/usuario está siendo bloqueada por rate limit
 */
export function checkRateLimit(
	identifier: string,
	maxAttempts: number = 5,
	lockoutMinutes: number = 15
): { allowed: boolean; remainingAttempts: number; blockedUntil?: number } {
	const now = Date.now();
	const data = rateLimitStore.get(identifier) || {
		attempts: 0,
		lastAttempt: now
	};

	// Si está bloqueado, verificar si el bloqueo ha expirado
	if (data.blockedUntil && now < data.blockedUntil) {
		return {
			allowed: false,
			remainingAttempts: 0,
			blockedUntil: data.blockedUntil
		};
	}

	// Si pasó más de una hora desde el último intento, resetear contador
	if (now - data.lastAttempt > 60 * 60 * 1000) {
		data.attempts = 1;
		data.lastAttempt = now;
		rateLimitStore.set(identifier, data);
		return { allowed: true, remainingAttempts: maxAttempts - 1 };
	}

	// Incrementar intentos
	data.attempts++;
	data.lastAttempt = now;

	if (data.attempts > maxAttempts) {
		// Bloquear por lockoutMinutes
		data.blockedUntil = now + lockoutMinutes * 60 * 1000;
		rateLimitStore.set(identifier, data);
		return {
			allowed: false,
			remainingAttempts: 0,
			blockedUntil: data.blockedUntil
		};
	}

	rateLimitStore.set(identifier, data);
	return { allowed: true, remainingAttempts: maxAttempts - data.attempts };
}

/**
 * Limpia el rate limit de un identificador (después de login exitoso)
 */
export function clearRateLimit(identifier: string): void {
	rateLimitStore.delete(identifier);
}

/**
 * ============================================
 * 3. MANEJO SEGURO DE ERRORES
 * ============================================
 */

/**
 * Respuesta de error genérica sin exponer detalles internos
 */
export function secureErrorResponse(statusCode: number = 400, message: string = 'Error en la solicitud') {
	// En logs, registrar el error completo
	console.error(`[SECURITY] Error ${statusCode}: ${message}`);

	return json(
		{ error: message },
		{ status: statusCode }
	);
}

/**
 * Log seguro que no expone información sensible
 */
export function secureLog(level: 'info' | 'warn' | 'error', message: string, data?: any) {
	const timestamp = new Date().toISOString();
	const logLevel = level.toUpperCase();

	// No loguear datos sensibles como contraseñas o tokens
	const cleanData = data ? JSON.stringify(data, (key, value) => {
		if (key.toLowerCase().includes('password') ||
			key.toLowerCase().includes('token') ||
			key.toLowerCase().includes('secret') ||
			key.toLowerCase().includes('contrasena')) {
			return '***REDACTED***';
		}
		return value;
	}) : '';

}

/**
 * ============================================
 * 4. CSRF PROTECTION
 * ============================================
 */

import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * Genera un nuevo CSRF token seguro usando crypto
 */
export function generateCSRFToken(): string {
	return randomBytes(32).toString('hex');
}

/**
 * Valida el CSRF token con comparación timing-safe
 */
export function validateCSRFToken(provided: string | null | undefined, session: string | null | undefined): boolean {
	if (!provided || !session) {
		return false;
	}

	if (provided.length !== session.length) {
		return false;
	}

	try {
		return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(session, 'utf8'));
	} catch {
		return false;
	}
}

/**
 * ============================================
 * 5. HEADERS DE SEGURIDAD
 * ============================================
 */

/**
 * Retorna headers de seguridad para aplicar a todas las respuestas
 */
export function getSecurityHeaders(): Record<string, string> {
	return {
		'X-Frame-Options': 'DENY',
		'X-Content-Type-Options': 'nosniff',
		'X-XSS-Protection': '1; mode=block',
		'Referrer-Policy': 'strict-origin-when-cross-origin',

		'Content-Security-Policy': `
			default-src 'self';
			script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com;
			style-src 'self' 'unsafe-inline';
			img-src 'self' data: blob: https://www.google.com https://www.gstatic.com;
			frame-src https://www.google.com;
			connect-src 'self' https://www.google.com;
		`.replace(/\n/g, ''),

		'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
	};
}

/**
 * ============================================
 * 6. COOKIES SEGURAS
 * ============================================
 */

export interface SecureCookieOptions {
	path?: string;
	maxAge?: number; // en segundos
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Opciones recomendadas para cookies de seguridad en producción
 */
export function getSecureCookieOptions(maxAge: number = 15 * 60): SecureCookieOptions {
	return {
		path: '/',
		maxAge, // segundos
		httpOnly: true, // No accesible desde JavaScript (previene XSS)
		secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
		sameSite: 'strict' // Previene CSRF
	};
}

/**
 * ============================================
 * 7. UTILIDADES ADICIONALES
 * ============================================
 */

/**
 * Extrae la IP del cliente desde la request
 */
export function getClientIP(event: RequestEvent): string {
	const forwarded = event.request.headers.get('x-forwarded-for');
	if (forwarded) {
		return forwarded.split(',')[0].trim();
	}

	const clientIP = event.request.headers.get('cf-connecting-ip') ||
		event.request.headers.get('x-real-ip') ||
		event.getClientAddress?.() ||
		'unknown';

	return clientIP as string;
}

/**
 * Valida que el origen de la request sea permitido
 */
export function validateOrigin(event: RequestEvent, allowedOrigins: string[]): boolean {
	const origin = event.request.headers.get('origin');

	if (!origin) return true; // Same-site requests no tienen origin header

	return allowedOrigins.includes(origin);
}

/**
 * ============================================
 * 6. VALIDACIÓN DE RECAPTCHA V3
 * ============================================
 */

export interface RecaptchaValidationResult {
	valid: boolean;
	score?: number;
	error?: string;
}

/**
 * Valida un token de reCAPTCHA v3 con Google
 * Retorna true si la validación es exitosa y el score es >= 0.5
 * reCAPTCHA v3 retorna un score de 0.0 a 1.0
 * - 1.0 = casi seguro que es humano
 * - 0.0 = casi seguro que es bot
 */
export async function validateRecaptcha(
	token: string,
	secretKey: string
): Promise<RecaptchaValidationResult> {
	try {
		if (!token) {
			return { valid: false, error: 'reCAPTCHA token requerido' };
		}

		const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: new URLSearchParams({
				secret: secretKey,
				response: token
			}).toString()
		});

		if (!response.ok) {
			return {
				valid: false,
				error: `Error validando reCAPTCHA con Google (${response.status})`
			};
		}

		const data = await response.json();

		// Google retorna { success: boolean, challenge_ts: string, hostname: string, score: number, action: string, error-codes?: string[] }
		if (!data.success) {
			const errorCodes = data['error-codes'] || [];
			return {
				valid: false,
				error: `reCAPTCHA validation failed: ${errorCodes.join(', ')}`
			};
		}

		// Validar que el score sea >= 0.5 (configurable según necesidad)
		// Score bajo = probablemente bot, score alto = probablemente humano
		const threshold = 0.5;
		if (data.score < threshold) {
			return {
				valid: false,
				score: data.score,
				error: `reCAPTCHA score too low: ${data.score.toFixed(2)} < ${threshold}`
			};
		}

		return {
			valid: true,
			score: data.score
		};
	} catch (error) {
		console.error('[RECAPTCHA] Error validating token:', error);
		return {
			valid: false,
			error: error instanceof Error ? error.message : 'Unknown error validating reCAPTCHA'
		};
	}
}

/**
 * ============================================
 * 8. VALIDACIÓN DE MAGIC NUMBERS (ARCHIVOS)
 * ============================================
 */

// Firmas de archivos de imagen conocidos (magic numbers)
const IMAGE_SIGNATURES: Record<string, number[]> = {
	'image/jpeg': [0xFF, 0xD8, 0xFF],
	'image/png':  [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
	'image/gif':  [0x47, 0x49, 0x46, 0x38], // GIF87a o GIF89a
	'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF (+ WEBP a offset 8)
};

/**
 * Valida que el contenido base64 corresponda al MIME type declarado
 * usando magic numbers (file signatures).
 * Previene file type spoofing (enviar ejecutables disfrazados de imagen).
 */
export function validateImageMagicNumber(base64Data: string, declaredMimetype: string): { valid: boolean; detectedType?: string; error?: string } {
	try {
		// Decodificar los primeros 16 bytes del base64 (suficiente para magic numbers)
		const sampleBase64 = base64Data.substring(0, 24); // 24 chars base64 = 18 bytes
		const buffer = Buffer.from(sampleBase64, 'base64');

		if (buffer.length < 4) {
			return { valid: false, error: 'Archivo demasiado pequeño para ser una imagen válida' };
		}

		const signature = IMAGE_SIGNATURES[declaredMimetype];
		if (!signature) {
			return { valid: false, error: 'Tipo MIME no soportado' };
		}

		// Verificar que los primeros bytes coincidan con la firma esperada
		for (let i = 0; i < signature.length; i++) {
			if (buffer[i] !== signature[i]) {
				return {
					valid: false,
					error: 'El contenido del archivo no coincide con el tipo declarado'
				};
			}
		}

		// Validación extra para WebP: verificar "WEBP" en offset 8-11
		if (declaredMimetype === 'image/webp' && buffer.length >= 12) {
			const webpMagic = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
			for (let i = 0; i < webpMagic.length; i++) {
				if (buffer[8 + i] !== webpMagic[i]) {
					return {
						valid: false,
						error: 'El contenido del archivo no es un WebP válido'
					};
				}
			}
		}

		return { valid: true, detectedType: declaredMimetype };
	} catch {
		return { valid: false, error: 'Error al validar el contenido del archivo' };
	}
}

