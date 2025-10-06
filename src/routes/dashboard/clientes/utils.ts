import type { ValidationErrors, Regimen, Pais, Estado, Agente } from './types.js';

// ========================================
// FUNCIONES DE UTILIDAD Y VALIDACIÓN
// ========================================

export function validarEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

export function validarRFC(rfc: string): boolean {
	// RFC para persona física: 4 letras + 6 números + 3 caracteres (13 total)
	// RFC para persona moral: 3 letras + 6 números + 3 caracteres (12 total)
	const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/;
	return rfcRegex.test(rfc.replace(/\s/g, '').toUpperCase());
}

export function validarTelefono(telefono: string): boolean {
	// Validar que tenga exactamente 10 dígitos
	return telefono.replace(/\D/g, '').length === 10;
}

export function validarFormulario(
	nombreComercial: string,
	razonSocial: string,
	rfc: string,
	regimen: string,
	condicionesPago: string,
	correoPrincipal: string,
	paisSeleccionado: number | null,
	telefono: string,
	estadoSeleccionado: number | null,
	calle: string,
	numExterior: string,
	agenteSeleccionado: number | null
): { esValido: boolean; errores: ValidationErrors } {
	const errores: ValidationErrors = {};
	let esValido = true;

	// Validaciones de campos requeridos - Datos Fiscales
	if (!nombreComercial.trim()) {
		errores.nombreComercial = 'El nombre comercial es requerido';
		esValido = false;
	}

	if (!razonSocial.trim()) {
		errores.razonSocial = 'La razón social es requerida';
		esValido = false;
	}

	if (!rfc.trim()) {
		errores.rfc = 'El RFC es requerido';
		esValido = false;
	} else if (!validarRFC(rfc)) {
		errores.rfc = 'El RFC no tiene un formato válido';
		esValido = false;
	}

	if (!regimen) {
		errores.regimen = 'El régimen fiscal es requerido';
		esValido = false;
	}

	if (!condicionesPago) {
		errores.condicionesPago = 'Las condiciones de pago son requeridas';
		esValido = false;
	}

	// Validaciones de campos requeridos - Datos de Contacto
	if (!correoPrincipal.trim()) {
		errores.correoPrincipal = 'El correo principal es requerido';
		esValido = false;
	} else if (!validarEmail(correoPrincipal)) {
		errores.correoPrincipal = 'El correo no tiene un formato válido';
		esValido = false;
	}

	if (!paisSeleccionado) {
		errores.paisSeleccionado = 'El país es requerido';
		esValido = false;
	}

	if (!telefono.trim()) {
		errores.telefono = 'El teléfono es requerido';
		esValido = false;
	} else if (!validarTelefono(telefono)) {
		errores.telefono = 'El teléfono debe tener exactamente 10 dígitos';
		esValido = false;
	}

	if (!estadoSeleccionado) {
		errores.estadoSeleccionado = 'El estado es requerido';
		esValido = false;
	}

	if (!calle.trim()) {
		errores.calle = 'La calle es requerida';
		esValido = false;
	}

	if (!numExterior.trim()) {
		errores.numExterior = 'El número exterior es requerido';
		esValido = false;
	}

	// Nota: Agente ya no es requerido - se asigna automáticamente por el servidor

	return { esValido, errores };
}

export function validarCampo(
	campo: string, 
	valor: any, 
	errores: ValidationErrors
): ValidationErrors {
	const nuevosErrores = { ...errores };
	
	switch (campo) {
		case 'nombreComercial':
			if (valor && valor.trim()) {
				delete nuevosErrores.nombreComercial;
			}
			break;
		case 'razonSocial':
			if (valor && valor.trim()) {
				delete nuevosErrores.razonSocial;
			}
			break;
		case 'rfc':
			if (valor && valor.trim() && validarRFC(valor)) {
				delete nuevosErrores.rfc;
			}
			break;
		case 'regimen':
			if (valor) {
				delete nuevosErrores.regimen;
			}
			break;
		case 'condicionesPago':
			if (valor) {
				delete nuevosErrores.condicionesPago;
			}
			break;
		case 'correoPrincipal':
			if (valor && valor.trim() && validarEmail(valor)) {
				delete nuevosErrores.correoPrincipal;
			}
			break;
		case 'paisSeleccionado':
			if (valor) {
				delete nuevosErrores.paisSeleccionado;
			}
			break;
		case 'telefono':
			if (valor && valor.trim() && validarTelefono(valor)) {
				delete nuevosErrores.telefono;
			}
			break;
		case 'estadoSeleccionado':
			if (valor) {
				delete nuevosErrores.estadoSeleccionado;
			}
			break;
		case 'calle':
			if (valor && valor.trim()) {
				delete nuevosErrores.calle;
			}
			break;
		case 'numExterior':
			if (valor && valor.trim()) {
				delete nuevosErrores.numExterior;
			}
			break;
		case 'agenteSeleccionado':
			// Agente ya no es requerido - se asigna automáticamente
			delete nuevosErrores.agenteSeleccionado;
			break;
	}

	return nuevosErrores;
}

export function obtenerNombrePais(paisId: number | null, paises: Pais[]): string {
	if (!paisId) return '';
	const pais = paises.find(p => p.ID === paisId);
	return pais ? pais.NombrePais : '';
}

export function obtenerNombreEstado(estadoId: number | null, estados: Estado[]): string {
	if (!estadoId) return '';
	const estado = estados.find(e => e.ID === estadoId);
	return estado ? estado.NombreEstado : '';
}

export function obtenerNombreRegimen(regimenId: string, regimenes: Regimen[]): string {
	if (!regimenId) return '';
	const regimen = regimenes.find(r => r.ID_Regimen.toString() === regimenId);
	return regimen ? regimen.Descripcion : '';
}

export function obtenerCondicionesPago(condicionId: string): string {
	const condiciones: { [key: string]: string } = {
		'1': 'De Contado',
		'2': '7 Días',
		'3': '15 Días',
		'4': '30 Días',
		'5': '45 Días',
		'6': '60 Días',
		'7': '90 Días'
	};
	return condiciones[condicionId] || '';
}

export function obtenerCodigoCondicionesPago(descripcion: string): string {
	const condiciones: { [key: string]: string } = {
		'De Contado': '1',
		'7 Días': '2', 
		'15 Días': '3',
		'30 días': '4',
		'30 Días': '4',
		'45 Días': '5',
		'60 Días': '6',
		'90 Días': '7'
	};
	return condiciones[descripcion] || '4';
}

export function obtenerNombreAgente(agenteId: number | null, agentes: Agente[]): string {
	if (!agenteId) return 'Sin asignar';
	const agente = agentes.find(a => a.value === agenteId);
	return agente ? agente.text : 'Sin asignar';
}

export function actualizarCodigoPais(paisSeleccionado: number | null): string {
	if (paisSeleccionado === 1) {
		// México
		return '+52';
	} else if (paisSeleccionado === 2) {
		// Estados Unidos
		return '+1';
	}
	return '+52'; // Default México
}

export function mapearClienteParaAPI(
	nombreComercial: string,
	razonSocial: string,
	rfc: string,
	regimen: string,
	condicionesPago: string,
	correoPrincipal: string,
	paisSeleccionado: number | null,
	codigoPais: string,
	telefono: string,
	estadoSeleccionado: number | null,
	calle: string,
	numExterior: string,
	numInterior: string,
	codigoPostal: string,
	colonia: string,
	ciudad: string,
	agenteSeleccionado: number | null,
	paises: Pais[],
	estados: Estado[],
	regimenes: Regimen[],
	agentes: Agente[]
) {
	// Obtener organizacionId dinámicamente
	let organizacionId = "3"; // Fallback
	if (typeof window !== 'undefined') {
		try {
			const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
			organizacionId = userData.organizacionId?.toString() || "3";
		} catch (error) {
			console.warn('No se pudo obtener organizacionId, usando fallback');
		}
	}

	return {
		"NombreComercial": nombreComercial || "",
		"RazonSocial": razonSocial || "",
		"RFC": rfc || "",
		"RegimenFiscalId": regimen ? parseInt(regimen) : null,
		"CondicionesPago": obtenerCondicionesPago(condicionesPago),
		"CorreoPrincipal": correoPrincipal || "",
		"PaisId": paisSeleccionado,
		"CodigoPais": codigoPais ? codigoPais.replace('+', '') : "52",
		"Telefono": telefono || "",
		"EstadoId": estadoSeleccionado,
		"Calle": calle || "",
		"NumeroExterior": numExterior || "",
		"NumeroInterior": numInterior || "",
		"CodigoPostal": codigoPostal || "",
		"Colonia": colonia || "",
		"Ciudad": ciudad || "",
		"OrganizacionId": organizacionId,
		"AgenteSeleccionado": agenteSeleccionado
	};
}

export function descargarArchivo(blob: Blob, nombreArchivo: string): void {
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);
	link.setAttribute('href', url);
	link.setAttribute('download', nombreArchivo);
	link.style.visibility = 'hidden';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function generarNombreArchivoExcel(): string {
	const fechaActual = new Date().toISOString().split('T')[0];
	return `clientes_${fechaActual}.csv`;
}