/**
 * Validaciones y utilidades de seguridad para el módulo de Clientes
 */

/**
 * Validar formato de RFC (México)
 * RFC debe tener 13 caracteres alfanuméricos
 */
export function validarRFC(rfc: string): { valido: boolean; mensaje?: string } {
	if (!rfc) {
		return { valido: false, mensaje: 'RFC es requerido' };
	}

	const rfcLimpio = rfc.toUpperCase().trim();

	// RFC debe tener 13 caracteres (12 letras/números + 1 dígito de verificación)
	if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfcLimpio)) {
		return { 
			valido: false, 
			mensaje: 'RFC inválido. Debe tener formato: XXXXXXXXXXXXXXXX (3-4 letras, 6 dígitos, 3 caracteres alfanuméricos)' 
		};
	}

	return { valido: true };
}

/**
 * Validar formato de email
 */
export function validarEmail(email: string): { valido: boolean; mensaje?: string } {
	if (!email) {
		return { valido: true }; // Email es opcional
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email.trim())) {
		return { 
			valido: false, 
			mensaje: 'Email inválido. Por favor verifica el formato' 
		};
	}

	return { valido: true };
}

/**
 * Validar teléfono
 */
export function validarTelefono(telefono: string): { valido: boolean; mensaje?: string } {
	if (!telefono) {
		return { valido: true }; // Teléfono es opcional
	}

	const telefonoLimpio = telefono.replace(/\D/g, '');

	// Permite 10-20 dígitos (para números internacionales)
	if (telefonoLimpio.length < 10 || telefonoLimpio.length > 20) {
		return { 
			valido: false, 
			mensaje: 'Teléfono inválido. Debe tener entre 10 y 20 dígitos' 
		};
	}

	return { valido: true };
}

/**
 * Validar código postal (México)
 */
export function validarCodigoPostal(cp: string): { valido: boolean; mensaje?: string } {
	if (!cp) {
		return { valido: true }; // CP es opcional pero requerido para FacturaAPI
	}

	const cpLimpio = cp.trim();

	// Código postal mexicano: 5 dígitos
	if (!/^\d{5}$/.test(cpLimpio)) {
		return { 
			valido: false, 
			mensaje: 'Código postal inválido. Debe tener 5 dígitos' 
		};
	}

	return { valido: true };
}

/**
 * Validar que RazonSocial o NombreComercial no estén vacíos
 */
export function validarNombre(razonSocial?: string, nombreComercial?: string): { valido: boolean; mensaje?: string } {
	const nombre = (razonSocial || '').trim() || (nombreComercial || '').trim();

	if (!nombre) {
		return { 
			valido: false, 
			mensaje: 'Razón Social o Nombre Comercial es requerido' 
		};
	}

	if (nombre.length > 200) {
		return { 
			valido: false, 
			mensaje: 'Nombre demasiado largo (máximo 200 caracteres)' 
		};
	}

	return { valido: true };
}

/**
 * Validar RegimenFiscalId
 */
export function validarRegimenFiscal(regimenId?: number): { valido: boolean; mensaje?: string } {
	if (!regimenId) {
		return { 
			valido: false, 
			mensaje: 'Régimen Fiscal es requerido' 
		};
	}

	// Validar que sea un ID entre 1-19 (según tabla de BD)
	if (!Number.isInteger(regimenId) || regimenId < 1 || regimenId > 19) {
		return { 
			valido: false, 
			mensaje: 'Régimen Fiscal inválido' 
		};
	}

	return { valido: true };
}

/**
 * Validar datos de dirección
 */
export function validarDireccion(data: {
	calle?: string;
	numeroExterior?: string;
	codigoPostal?: string;
	ciudad?: string;
}): { valido: boolean; mensaje?: string } {
	if (data.calle && data.calle.length > 200) {
		return { 
			valido: false, 
			mensaje: 'Calle demasiado larga (máximo 200 caracteres)' 
		};
	}

	if (data.numeroExterior && data.numeroExterior.length > 20) {
		return { 
			valido: false, 
			mensaje: 'Número exterior demasiado largo (máximo 20 caracteres)' 
		};
	}

	if (data.codigoPostal) {
		const validCP = validarCodigoPostal(data.codigoPostal);
		if (!validCP.valido) {
			return validCP;
		}
	}

	if (data.ciudad && data.ciudad.length > 100) {
		return { 
			valido: false, 
			mensaje: 'Ciudad demasiado larga (máximo 100 caracteres)' 
		};
	}

	return { valido: true };
}

/**
 * Validar datos completos de cliente para creación
 */
export function validarClienteCompleto(clienteData: any): { valido: boolean; errores: string[] } {
	const errores: string[] = [];

	// Validar nombre
	const validNombre = validarNombre(clienteData.razonsocial, clienteData.nombrecomercial);
	if (!validNombre.valido) errores.push(validNombre.mensaje || '');

	// Validar RFC
	const validRFC = validarRFC(clienteData.rfc);
	if (!validRFC.valido) errores.push(validRFC.mensaje || '');

	// Validar Régimen Fiscal
	const validRegimen = validarRegimenFiscal(clienteData.regimenfiscalid);
	if (!validRegimen.valido) errores.push(validRegimen.mensaje || '');

	// Validar email (opcional pero si se envía debe ser válido)
	if (clienteData.correoprincipal) {
		const validMail = validarEmail(clienteData.correoprincipal);
		if (!validMail.valido) errores.push(validMail.mensaje || '');
	}

	// Validar teléfono (opcional pero si se envía debe ser válido)
	if (clienteData.telefono) {
		const validTel = validarTelefono(clienteData.telefono);
		if (!validTel.valido) errores.push(validTel.mensaje || '');
	}

	// Validar dirección
	const validDir = validarDireccion({
		calle: clienteData.calle,
		numeroExterior: clienteData.numeroexterior,
		codigoPostal: clienteData.codigopostal,
		ciudad: clienteData.ciudad
	});
	if (!validDir.valido) errores.push(validDir.mensaje || '');

	return {
		valido: errores.length === 0,
		errores
	};
}

/**
 * Validar datos para edición de cliente (menos restrictivo)
 */
export function validarActualizacionCliente(clienteData: any): { valido: boolean; errores: string[] } {
	const errores: string[] = [];

	// Si se envía RFC, validar
	if (clienteData.rfc) {
		const validRFC = validarRFC(clienteData.rfc);
		if (!validRFC.valido) errores.push(validRFC.mensaje || '');
	}

	// Si se envía nombre, validar
	if (clienteData.razonsocial || clienteData.nombrecomercial) {
		const validNombre = validarNombre(clienteData.razonsocial, clienteData.nombrecomercial);
		if (!validNombre.valido) errores.push(validNombre.mensaje || '');
	}

	// Si se envía Régimen Fiscal, validar
	if (clienteData.regimenfiscalid !== undefined && clienteData.regimenfiscalid !== null) {
		const validRegimen = validarRegimenFiscal(clienteData.regimenfiscalid);
		if (!validRegimen.valido) errores.push(validRegimen.mensaje || '');
	}

	// Si se envía email, validar
	if (clienteData.correoprincipal) {
		const validMail = validarEmail(clienteData.correoprincipal);
		if (!validMail.valido) errores.push(validMail.mensaje || '');
	}

	// Si se envía teléfono, validar
	if (clienteData.telefono) {
		const validTel = validarTelefono(clienteData.telefono);
		if (!validTel.valido) errores.push(validTel.mensaje || '');
	}

	// Validar dirección
	if (clienteData.calle || clienteData.codigopostal || clienteData.ciudad) {
		const validDir = validarDireccion({
			calle: clienteData.calle,
			numeroExterior: clienteData.numeroexterior,
			codigoPostal: clienteData.codigopostal,
			ciudad: clienteData.ciudad
		});
		if (!validDir.valido) errores.push(validDir.mensaje || '');
	}

	return {
		valido: errores.length === 0,
		errores
	};
}
