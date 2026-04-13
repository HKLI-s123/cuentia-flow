import crypto from 'crypto';

// Clave de encriptación (obligatoria en producción)
const ENCRYPTION_KEY = process.env.WHATSAPP_ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.WHATSAPP_ENCRYPTION_IV;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.includes('change-me')) {
	console.error('[SECURITY] WHATSAPP_ENCRYPTION_KEY no está configurada o usa el valor por defecto');
	if (process.env.NODE_ENV === 'production') {
		throw new Error('WHATSAPP_ENCRYPTION_KEY debe configurarse en producción');
	}
}

if (!ENCRYPTION_IV || ENCRYPTION_IV.includes('default')) {
	console.error('[SECURITY] WHATSAPP_ENCRYPTION_IV no está configurada o usa el valor por defecto');
	if (process.env.NODE_ENV === 'production') {
		throw new Error('WHATSAPP_ENCRYPTION_IV debe configurarse en producción');
	}
}

// Normalizar clave a 32 bytes y IV a 16 bytes
const key = crypto.createHash('sha256').update(ENCRYPTION_KEY || 'dev-only-fallback-key').digest();
const iv = (ENCRYPTION_IV || 'dev-only-iv-16bt').slice(0, 16).padEnd(16, '0');

/**
 * Encripta datos sensibles (sesiones de Baileys)
 */
export function encryptData(data: string): string {
	try {
		const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
		let encrypted = cipher.update(data, 'utf8', 'hex');
		encrypted += cipher.final('hex');
		return encrypted;
	} catch (error) {
		console.error('Error encriptando datos:', error);
		throw new Error('Error al encriptar datos');
	}
}

/**
 * Desencripta datos sensibles (sesiones de Baileys)
 */
export function decryptData(encryptedData: string): string {
	try {
		const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
		let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	} catch (error) {
		console.error('Error desencriptando datos:', error);
		throw new Error('Error al desencriptar datos');
	}
}

/**
 * Genera una clave aleatoria (para usar en .env settings)
 */
export function generateEncryptionKey(): string {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash de un valor (para verificación)
 */
export function hashValue(value: string): string {
	return crypto.createHash('sha256').update(value).digest('hex');
}
