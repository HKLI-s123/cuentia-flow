/**
 * Servicio para integración con FacturaAPI
 * Documentación: https://www.facturapi.io/
 */

const FACTURAPI_BASE_URL = 'https://www.facturapi.io/v2';
const FACTURAPI_SECRET_USER_KEY = process.env.FACTURAPI_USER_KEY || '';

// Cache de API Keys por organización (ID de FacturaAPI -> API Key)
const apiKeysCache = new Map<string, { key: string; timestamp: number }>();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hora

/**
 * Mapeo de RegimenFiscalId (de BD local) a código de régimen de FacturaAPI
 * Referencia: https://www.facturapi.io/
 */
const REGIMEN_FISCAL_MAP: Record<number, string> = {
	// Mappeo de IDs de BD local (1-19) a códigos SAT
	1: '601',   // General de Ley Personas Morales
	2: '603',   // Personas Morales con Fines no Lucrativos
	3: '605',   // Sueldos y Salarios e Ingresos Asimilados a Salarios
	4: '606',   // Arrendamiento
	5: '607',   // Régimen de Enajenación o Adquisición de Bienes
	6: '608',   // Demás ingresos
	7: '610',   // Residentes en el Extranjero sin Establecimiento Permanente en México
	8: '611',   // Ingresos por Dividendos (socios y accionistas)
	9: '612',   // Personas Físicas con Actividades Empresariales y Profesionales
	10: '614',  // Ingresos por intereses
	11: '615',  // Régimen de los ingresos por obtención de premios
	12: '616',  // Sin obligaciones fiscales
	13: '620',  // Sociedades Cooperativas de Producción que optan por diferir sus ingresos
	14: '621',  // Incorporación Fiscal
	15: '622',  // Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras
	16: '623',  // Opcional para Grupos de Sociedades
	17: '624',  // Coordinados
	18: '625',  // Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas
	19: '626',  // Régimen Simplificado de Confianza
};

interface ClienteFacturaAPI {
	legal_name: string;
	email?: string;
	phone?: string;
	tax_id: string;
	tax_system: string;
	address: {
		zip: string;
		street?: string;
		exterior?: string;
		interior?: string;
		neighborhood?: string;
		state?: string;
		country?: string;
	};
}

interface RespuestaClienteFacturaAPI {
	id: string;
	legal_name: string;
	email?: string;
	phone?: string;
	tax_id: string;
	tax_system: string;
	address: Record<string, any>;
	[key: string]: any;
}

/**
 * Obtener la Live API Key de una organización en FacturaAPI
 * Usa la SecretUserKey para acceder a los datos de la organización
 */
export async function obtenerApiKeyFacturaAPI(idFacturaAPIOrganizacion: string): Promise<string | null> {
	try {
		if (!FACTURAPI_SECRET_USER_KEY) {
			console.error('[FACTURAPI] FACTURAPI_SECRET_USER_KEY no está configurada');
			return null;
		}

		// Verificar cache
		const cached = apiKeysCache.get(idFacturaAPIOrganizacion);
		if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
			return cached.key;
		}

		const url = `${FACTURAPI_BASE_URL}/organizations/${idFacturaAPIOrganizacion}/apikeys/live`;
		// Obtener las Live API Keys de la organización
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${FACTURAPI_SECRET_USER_KEY}`,
				'Content-Type': 'application/json',
			},
		});

		const data = await response.json();
		if (!response.ok) {
			const errorMsg = data.message || data.error || 'Error desconocido';
			console.error('[FACTURAPI] Error al obtener API Keys:', {
				status: response.status,
				error: errorMsg,
				details: data,
			});
			return null;
		}

		// data.api_keys es un array de objetos con 'key' y otros campos
		if (data.api_keys && Array.isArray(data.api_keys) && data.api_keys.length > 0) {
			const liveKey = data.api_keys[0].key;
			// Guardar en cache
			apiKeysCache.set(idFacturaAPIOrganizacion, {
				key: liveKey,
				timestamp: Date.now(),
			});

			return liveKey;
		}

		console.error('[FACTURAPI] No se encontraron API Keys en la respuesta. Estructura de data:', {
			keysEnData: Object.keys(data).slice(0, 10)
		});
		return null;
	} catch (error) {
		console.error('[FACTURAPI] Exception al obtener API Key:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : ''
		});
		return null;
	}
}

/**
 * Generar una nueva Live API Key para una organización en FacturaAPI
 * Usa PUT a /organizations/{id}/apikeys/live
 */
export async function generarApiKeyFacturaAPI(idFacturaAPIOrganizacion: string): Promise<string | null> {
	try {
		if (!FACTURAPI_SECRET_USER_KEY) {
			console.error('[FACTURAPI] FACTURAPI_SECRET_USER_KEY no está configurada');
			return null;
		}

		const url = `${FACTURAPI_BASE_URL}/organizations/${idFacturaAPIOrganizacion}/apikeys/live`;
		const response = await fetch(url, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${FACTURAPI_SECRET_USER_KEY}`,
				'Content-Type': 'application/json',
				'Content-Length': '0',
			},
		});

		const data = await response.json();
		if (!response.ok) {
			const errorMsg = (data as any)?.message || (data as any)?.error || 'Error desconocido';
			console.error('[FACTURAPI] Error al generar API Key:', {
				status: response.status,
				error: errorMsg,
				details: data,
			});
			return null;
		}

		let newKey: string | null = null;

		// La respuesta puede ser directamente la key (string)
		if (typeof data === 'string') {
			newKey = data;
		}
		// O un objeto con array de api_keys
		else if ((data as any)?.api_keys && Array.isArray((data as any).api_keys) && (data as any).api_keys.length > 0) {
			newKey = (data as any).api_keys[0].key;
		}

		if (newKey) {
			// Limpiar cache para forzar que se obtenga la nueva key
			apiKeysCache.delete(idFacturaAPIOrganizacion);
			return newKey;
		}

		console.error('[FACTURAPI] No se encontraron API Keys en la respuesta al generar');
		return null;
	} catch (error) {
		console.error('[FACTURAPI] Exception al generar API Key:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : ''
		});
		return null;
	}
}

/**
 * Reiniciar la Live API Key de una organización (DELETE la antigua + generar nueva)
 */
export async function reiniciarApiKeyFacturaAPI(idFacturaAPIOrganizacion: string): Promise<string | null> {
	try {
		if (!FACTURAPI_SECRET_USER_KEY) {
			console.error('[FACTURAPI] FACTURAPI_SECRET_USER_KEY no está configurada');
			return null;
		}

		// 1. Obtener la API Key actual para saber qué eliminar
		const urlGet = `${FACTURAPI_BASE_URL}/organizations/${idFacturaAPIOrganizacion}/apikeys/live`;
		const responseGet = await fetch(urlGet, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${FACTURAPI_SECRET_USER_KEY}`,
				'Content-Type': 'application/json',
			},
		});

		const dataGet = await responseGet.json();
		if (!responseGet.ok || !dataGet.api_keys || dataGet.api_keys.length === 0) {
			console.warn('[FACTURAPI] No hay API Key actual para eliminar, solo generando nueva...');
		} else {
			// 2. Eliminar la API Key actual
			const keyIdToDelete = dataGet.api_keys[0].id;
			const urlDelete = `${FACTURAPI_BASE_URL}/organizations/${idFacturaAPIOrganizacion}/apikeys/live/${keyIdToDelete}`;
			const responseDel = await fetch(urlDelete, {
				method: 'DELETE',
				headers: {
					'Authorization': `Bearer ${FACTURAPI_SECRET_USER_KEY}`,
					'Content-Type': 'application/json',
				},
			});

			if (!responseDel.ok) {
				const errorData = await responseDel.json();
				console.error('[FACTURAPI] Error al eliminar API Key antigua:', {
					status: responseDel.status,
					error: errorData
				});
				// Continuar de todas formas para generar una nueva
			}
		}

		// 3. Generar nueva API Key
		const newKey = await generarApiKeyFacturaAPI(idFacturaAPIOrganizacion);
		
		if (newKey) {
			return newKey;
		} else {
			console.error('[FACTURAPI] Error al reiniciar API Key - no se pudo generar nueva');
			return null;
		}
	} catch (error) {
		console.error('[FACTURAPI] Exception al reiniciar API Key:', {
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : ''
		});
		return null;
	}
}

/**
 * Mapear RegimenFiscalId a código de régimen de FacturaAPI
 */
export function mapearRegimenFiscal(regimenFiscalId: number | null | undefined): string | null {
	if (!regimenFiscalId) return null;
	return REGIMEN_FISCAL_MAP[regimenFiscalId] || null;
}

/**
 * Crear un cliente en FacturaAPI
 * Requiere la API Key Live de la organización
 */
export async function crearClienteFacturaAPI(
	apiKey: string,
	cliente: {
		razonsocial?: string;
		nombrecomercial?: string;
		rfc: string;
		regimenfiscalid?: number;
		correoprincipal?: string;
		telefono?: string;
		codigopostal?: string;
		calle?: string;
		numeroexterior?: string;
		numerointerior?: string;
		colonia?: string;
		ciudad?: string;
	}
): Promise<RespuestaClienteFacturaAPI | null> {
	try {
		if (!apiKey) {
			console.error('[FACTURAPI] No hay API key proporcionada');
			return null;
		}

		// Validar datos requeridos
		if (!cliente.rfc || !cliente.razonsocial && !cliente.nombrecomercial) {
			throw new Error('RFC y RazonSocial/NombreComercial son requeridos');
		}

		// Mapear régimen fiscal
		const taxSystem = mapearRegimenFiscal(cliente.regimenfiscalid);
		if (!taxSystem) {
			console.warn(`[FACTURAPI] RegímenFiscalId ${cliente.regimenfiscalid} no mapeado. Usando 601 por defecto.`);
		}

		// Construir objeto para FacturaAPI
		const datosFacturaAPI: ClienteFacturaAPI = {
			legal_name: cliente.razonsocial || cliente.nombrecomercial || '',
			tax_id: cliente.rfc,
			tax_system: taxSystem || '601', // Default a régimen general
			address: {
				zip: cliente.codigopostal || '01234', // FacturaAPI requiere al menos zip
				street: cliente.calle || undefined,
				exterior: cliente.numeroexterior || undefined,
				interior: cliente.numerointerior || undefined,
				neighborhood: cliente.colonia || undefined,
				state: cliente.ciudad || undefined,
			country: 'MEX', // Código de país ISO 3166-1 alpha-3 para México
			},
		};

		// Agregar email si existe
		if (cliente.correoprincipal) {
			datosFacturaAPI.email = cliente.correoprincipal;
		}

		// Agregar teléfono si existe
		if (cliente.telefono) {
			datosFacturaAPI.phone = cliente.telefono;
		}

		// Realizar llamada a FacturaAPI
		const response = await fetch(`${FACTURAPI_BASE_URL}/customers`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(datosFacturaAPI),
		});

		const responseData = await response.json();

		if (!response.ok) {
			const errorMsg = responseData.message || responseData.error || 'Error desconocido';
			console.error('[FACTURAPI] Error al crear cliente:', {
				status: response.status,
				error: errorMsg,
				details: responseData,
			});
			throw new Error(`FacturaAPI Error: ${errorMsg}`);
		}

		return responseData as RespuestaClienteFacturaAPI;
	} catch (error) {
		console.error('[FACTURAPI] Exception al crear cliente:', error);
		throw error;
	}
}

/**
 * Editar un cliente existente en FacturaAPI
 * Requiere la API Key Live y el ID del cliente en FacturaAPI
 */
export async function editarClienteFacturaAPI(
	apiKey: string,
	idClienteFacturaAPI: string,
	cliente: {
		razonsocial?: string;
		nombrecomercial?: string;
		rfc?: string;
		regimenfiscalid?: number;
		correoprincipal?: string;
		telefono?: string;
		codigopostal?: string;
		calle?: string;
		numeroexterior?: string;
		numerointerior?: string;
		colonia?: string;
		ciudad?: string;
	}
): Promise<RespuestaClienteFacturaAPI | null> {
	try {
		if (!apiKey) {
			console.error('[FACTURAPI] No hay API key proporcionada');
			return null;
		}

		if (!idClienteFacturaAPI) {
			throw new Error('ID de cliente en FacturaAPI requerido');
		}

		// Construir objeto de actualización (solo campos no vacíos)
		const datosActualizacion: Record<string, any> = {};

		if (cliente.razonsocial || cliente.nombrecomercial) {
			datosActualizacion.legal_name = cliente.razonsocial || cliente.nombrecomercial;
		}

		if (cliente.rfc) {
			datosActualizacion.tax_id = cliente.rfc;
		}

		if (cliente.regimenfiscalid) {
			const taxSystem = mapearRegimenFiscal(cliente.regimenfiscalid);
			if (taxSystem) {
				datosActualizacion.tax_system = taxSystem;
			}
		}

		if (cliente.correoprincipal) {
			datosActualizacion.email = cliente.correoprincipal;
		}

		if (cliente.telefono) {
			datosActualizacion.phone = cliente.telefono;
		}

		// Construir dirección si hay datos
		const address: Record<string, any> = {};
		if (cliente.codigopostal) address.zip = cliente.codigopostal;
		if (cliente.calle) address.street = cliente.calle;
		if (cliente.numeroexterior) address.exterior = cliente.numeroexterior;
		if (cliente.numerointerior) address.interior = cliente.numerointerior;
		if (cliente.colonia) address.neighborhood = cliente.colonia;
		if (cliente.ciudad) address.state = cliente.ciudad;
		address.country = 'MEX';

		if (Object.keys(address).length > 1) {
			// Solo agregar si hay más que solo country
			datosActualizacion.address = address;
		}

		const response = await fetch(`${FACTURAPI_BASE_URL}/customers/${idClienteFacturaAPI}`, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(datosActualizacion),
		});

		const responseData = await response.json();

		if (!response.ok) {
			const errorMsg = responseData.message || responseData.error || 'Error desconocido';
			console.error('[FACTURAPI] Error al editar cliente:', {
				status: response.status,
				error: errorMsg,
				details: responseData,
			});
			throw new Error(`FacturaAPI Error: ${errorMsg}`);
		}

		return responseData as RespuestaClienteFacturaAPI;
	} catch (error) {
		console.error('[FACTURAPI] Exception al editar cliente:', error);
		throw error;
	}
}

/**
 * Eliminar un cliente de FacturaAPI
 * Nota: Las facturas asociadas al cliente no se eliminarán
 */
export async function borrarClienteFacturaAPI(apiKey: string, idClienteFacturaAPI: string): Promise<boolean> {
	try {
		if (!apiKey) {
			console.error('[FACTURAPI] No hay API key proporcionada');
			return false;
		}

		if (!idClienteFacturaAPI) {
			throw new Error('ID de cliente en FacturaAPI requerido');
		}

		const response = await fetch(`${FACTURAPI_BASE_URL}/customers/${idClienteFacturaAPI}`, {
			method: 'DELETE',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			const responseData = await response.json();
			const errorMsg = responseData.message || responseData.error || 'Error desconocido';
			console.error('[FACTURAPI] Error al eliminar cliente:', {
				status: response.status,
				error: errorMsg,
				details: responseData,
			});
			throw new Error(`FacturaAPI Error: ${errorMsg}`);
		}

		return true;
	} catch (error) {
		console.error('[FACTURAPI] Exception al eliminar cliente:', error);
		throw error;
	}
}

/**
 * Obtener un cliente de FacturaAPI
 */
export async function obtenerClienteFacturaAPI(apiKey: string, idCliente: string): Promise<RespuestaClienteFacturaAPI | null> {
	try {
		if (!apiKey) {
			console.error('[FACTURAPI] No hay API key proporcionada');
			return null;
		}

		const response = await fetch(`${FACTURAPI_BASE_URL}/customers/${idCliente}`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			console.error('[FACTURAPI] Cliente no encontrado:', idCliente);
			return null;
		}

		return await response.json() as RespuestaClienteFacturaAPI;
	} catch (error) {
		console.error('[FACTURAPI] Error al obtener cliente:', error);
		return null;
	}
}

/**
 * Crear una factura en FacturaAPI usando CFDI 4.0
 * @param apiKey - API Key de FacturaAPI (sk_live_* o sk_test_*)
 * @param customerIdFacturaAPI - ID del cliente en FacturaAPI
 * @param datosFactura - Datos de la factura (items, moneda, método de pago, condiciones, etc)
 * @param async - Si es true, FacturaAPI retornará inmediatamente sin esperar a que el SAT timbre
 */
export async function crearFacturaFacturaAPI(
	apiKey: string,
	customerIdFacturaAPI: string,
	datosFactura: {
		items: Array<{
			quantity: number;
			product: {
				description: string;
				product_key: string; // Clave de producto SAT (ej: 60131324)
				price: number;
			};
			discount?: {
				type?: 'fixed' | 'percent';
				value?: number;
			};
		}>;
		payment_form: string; // Código de forma de pago SAT (ej: "06" para Dinero en efectivo)
		payment_method?: string; // "PUE" o "PPD" (default: PUE)
		currency?: string; // "MXN", "USD", etc (default: MXN)
		exchange?: number; // Tipo de cambio (default: 1)
		use?: string; // Uso CFDI (default: "G01")
		conditions?: string; // Condiciones de pago
		folio_number?: number; // Número de folio (si se omite, se auto-incrementa)
		series?: string; // Serie (máx 25 caracteres)
		date?: string; // ISO8601 formato UTC (default: now)
		external_id?: string; // ID externo para búsquedas
		status?: string; // "pending" (default) o "draft"
	},
	facturacionAsincrona: boolean = false
): Promise<{
	id: string;
	folio: number;
	series: string;
	status: string;
	uuid?: string;
	xml?: string;
	pdf?: string;
	error?: string;
	message?: string;
}> {
	try {
		if (!apiKey) {
			throw new Error('API Key no proporcionada');
		}

		if (!customerIdFacturaAPI) {
			throw new Error('ID del cliente en FacturaAPI es requerido');
		}

		if (!datosFactura.items || datosFactura.items.length === 0) {
			throw new Error('Debe incluir al menos un item en la factura');
		}

		// Construir payload para FacturaAPI
		const payload = {
			customer_id: customerIdFacturaAPI, // Usar solo el ID del cliente (no enviar objeto completo)
			items: datosFactura.items,
			payment_form: datosFactura.payment_form,
			payment_method: datosFactura.payment_method || 'PUE',
			currency: datosFactura.currency || 'MXN',
			exchange: datosFactura.exchange || 1,
			use: datosFactura.use || 'G01',
			...(datosFactura.conditions && { conditions: datosFactura.conditions }),
			...(datosFactura.folio_number && { folio_number: datosFactura.folio_number }),
			...(datosFactura.series && { series: datosFactura.series }),
			...(datosFactura.date && { date: datosFactura.date }),
			...(datosFactura.external_id && { external_id: datosFactura.external_id }),
			...(datosFactura.status && { status: datosFactura.status })
		};

		// URL con parámetro de facturación asíncrona si se requiere
		const url = facturacionAsincrona
			? `${FACTURAPI_BASE_URL}/invoices?async=true`
			: `${FACTURAPI_BASE_URL}/invoices`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		const data = await response.json();

		if (!response.ok) {
			const errorMsg = data.message || data.error || response.statusText;
			console.error('[FACTURAPI] Error al crear factura:', {
				status: response.status,
				message: errorMsg,
				data: data
			});

			return {
				id: '',
				folio: 0,
				series: '',
				status: 'error',
				error: errorMsg,
				message: `Error al crear factura en FacturaAPI: ${errorMsg}`
			};
		}

		return {
			id: data.id,
			folio: data.folio,
			series: data.series || '',
			status: data.status,
			uuid: data.uuid,
			xml: data.xml,
			pdf: data.pdf
		};
	} catch (error) {
		console.error('[FACTURAPI] Exception al crear factura:', error);
		return {
			id: '',
			folio: 0,
			series: '',
			status: 'error',
			error: error instanceof Error ? error.message : String(error),
			message: 'Error interno al crear factura en FacturaAPI'
		};
	}
}
