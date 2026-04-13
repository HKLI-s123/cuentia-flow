/**
 * Helper para validaciones de seguridad centralizadas
 * Se usa en todos los endpoints de organizaciones y certificados
 */

/**
 * Interfaz para resultados de validación
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
	field?: string;
}

/**
 * Validar que un campo no esté vacío
 */
export function validateRequired(value: any, fieldName: string): ValidationResult {
	if (!value || (typeof value === 'string' && value.trim() === '')) {
		return { valid: false, error: `${fieldName} es requerido`, field: fieldName };
	}
	return { valid: true };
}

/**
 * Validar longitud de string
 */
export function validateLength(
	value: string,
	fieldName: string,
	min: number = 1,
	max: number = 255
): ValidationResult {
	const trimmed = value?.trim() ?? '';

	if (trimmed.length < min) {
		return { valid: false, error: `${fieldName} debe tener al menos ${min} caracteres`, field: fieldName };
	}

	if (trimmed.length > max) {
		return { valid: false, error: `${fieldName} no puede exceder ${max} caracteres`, field: fieldName };
	}

	return { valid: true };
}

/**
 * Validar formato de email
 */
export function validateEmail(email: string, fieldName: string = 'email'): ValidationResult {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	if (!emailRegex.test(email.trim())) {
		return { valid: false, error: `${fieldName} no tiene un formato válido`, field: fieldName };
	}

	return { valid: true };
}

/**
 * Validar formato de RFC mexicano (13 caracteres alfanuméricos)
 */
export function validateRFC(rfc: string): ValidationResult {
	const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i;
	const trimmed = rfc.trim().toUpperCase();

	if (!rfcRegex.test(trimmed)) {
		return {
			valid: false,
			error: 'RFC debe tener el formato válido (ejemplo: ABC123456XYZ)',
			field: 'rfc'
		};
	}

	return { valid: true };
}

/**
 * Validar formato de número de teléfono (México)
 */
export function validatePhone(phone: string): ValidationResult {
	const phoneRegex = /^[\d\-\s\+()]{10,15}$/;
	const trimmed = phone.trim();

	if (trimmed && !phoneRegex.test(trimmed)) {
		return {
			valid: false,
			error: 'Teléfono no tiene formato válido',
			field: 'phone'
		};
	}

	return { valid: true };
}

/**
 * Validar código postal mexicano (5 dígitos)
 */
export function validateZipCode(zipCode: string): ValidationResult {
	const zipRegex = /^\d{5}$/;
	const trimmed = zipCode.trim();

	if (!zipRegex.test(trimmed)) {
		return {
			valid: false,
			error: 'Código postal debe ser de 5 dígitos',
			field: 'zipCode'
		};
	}

	return { valid: true };
}

/**
 * Validar contraseña de CSD (mínimo 6 caracteres, debe contener números)
 */
export function validateCertificatePassword(password: string): ValidationResult {
	if (password.length < 6) {
		return {
			valid: false,
			error: 'La contraseña de certificado debe tener al menos 6 caracteres',
			field: 'password'
		};
	}

	if (!/\d/.test(password)) {
		return {
			valid: false,
			error: 'La contraseña de certificado debe contener al menos un número',
			field: 'password'
		};
	}

	return { valid: true };
}

/**
 * Validar que un valor sea un número entero válido
 */
export function validateInteger(value: any, fieldName: string): ValidationResult {
	const num = parseInt(value, 10);

	if (isNaN(num)) {
		return { valid: false, error: `${fieldName} debe ser un número entero`, field: fieldName };
	}

	return { valid: true };
}

/**
 * Validar que un valor esté dentro de un rango
 */
export function validateRange(
	value: number,
	fieldName: string,
	min: number,
	max: number
): ValidationResult {
	if (value < min || value > max) {
		return {
			valid: false,
			error: `${fieldName} debe estar entre ${min} y ${max}`,
			field: fieldName
		};
	}

	return { valid: true };
}

/**
 * Sanitizar entrada de texto (remover caracteres peligrosos)
 */
export function sanitizeText(text: string): string {
	return text
		.trim()
		.replace(/[<>]/g, '') // Remover < >
		.replace(/["']/g, ''); // Remover comillas para prevenir inyección
}

/**
 * Sanitizar nombre de archivo
 */
export function sanitizeFilename(filename: string): string {
	return filename
		.toLowerCase()
		.replace(/[^\w\s.-]/g, '') // Solo permitir word chars, espacios, guiones, puntos
		.replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
		.slice(0, 255); // Limitar longitud
}

/**
 * Validar extensión de archivo
 */
export function validateFileExtension(
	filename: string,
	allowedExtensions: string[]
): ValidationResult {
	const ext = filename.split('.').pop()?.toLowerCase();

	if (!ext || !allowedExtensions.includes(ext)) {
		return {
			valid: false,
			error: `Tipo de archivo no permitido. Solo se permite: ${allowedExtensions.join(', ')}`,
			field: 'file'
		};
	}

	return { valid: true };
}

/**
 * Validar tamaño de archivo en bytes
 */
export function validateFileSize(
	fileSize: number,
	maxSizeInBytes: number,
	fieldName: string = 'archivo'
): ValidationResult {
	if (fileSize > maxSizeInBytes) {
		const maxSizeMB = (maxSizeInBytes / 1024 / 1024).toFixed(2);
		return {
			valid: false,
			error: `${fieldName} no puede exceder ${maxSizeMB}MB`,
			field: fieldName
		};
	}

	return { valid: true };
}

/**
 * Validar que no sea inyección HTML/SQL
 */
export function validateNoSQLInjection(value: string): ValidationResult {
	const sqlKeywords = [
		'DROP',
		'DELETE',
		'INSERT',
		'UPDATE',
		'SELECT',
		'UNION',
		'--',
		';',
		'/*',
		'*/',
		'xp_',
		'sp_'
	];

	const upperValue = value.toUpperCase();

	for (const keyword of sqlKeywords) {
		if (upperValue.includes(keyword)) {
			return {
				valid: false,
				error: 'Entrada contiene caracteres o palabras no permitidas',
				field: 'input'
			};
		}
	}

	return { valid: true };
}

/**
 * Retorna objeto de error validación para JSON response
 */
export function validationError(
	fieldName: string,
	message: string,
	status: number = 400
): { error: string; details: string; field: string; status: number } {
	return {
		error: message,
		details: `Validación fallida en campo: ${fieldName}`,
		field: fieldName,
		status
	};
}
