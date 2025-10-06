import type { Cliente, ClienteAPI , Regimen, Pais, Estado, Agente } from './types.js';
import { authFetch } from '$lib/api';

// ========================================
// FUNCIONES DE API
// ========================================

function obtenerToken(): string | null {
	return sessionStorage.getItem('jwt');
}

export async function cargarConfiguracion(): Promise<string> {
	try {
		const response = await authFetch('/api/config');
		const data = await response.json();
		return data.endpoint;
	} catch (error) {
		const fallback = 'http://192.168.0.30:3000';
		return fallback;
	}
}

export async function cargarRegimenes(): Promise<Regimen[]> {
	try {
		const response = await authFetch('/api/regimen');
		const data = await response.json();
		return data;
	} catch (error) {
		return [];
	}
}

export async function cargarPaises(): Promise<Pais[]> {
	try {
		const response = await authFetch('/api/paises');
		const data = await response.json();
		return data;
	} catch (error) {
		return [];
	}
}

export async function cargarAgentes(): Promise<Agente[]> {
	try {
		// Obtener organizacionId de la sesión del usuario
		const { obtenerOrganizacionId } = await import('$lib/auth');
		const organizacionId = await obtenerOrganizacionId();
		const response = await authFetch(`/api/agentes?organizacionId=${organizacionId}`);
		const data = await response.json();
		return data;
	} catch (error) {
		return [];
	}
}

export async function cargarEstados(paisId: number): Promise<Estado[]> {
	try {
		const response = await authFetch(`/api/estados?paisId=${paisId}`);
		const data = await response.json();
		return data;
	} catch (error) {
		return [];
	}
}

export async function cargarClientes(search: string = '', page: number = 1): Promise<{clientes: Cliente[], pagination: any}> {
	try {
		// Obtener organizacionId de la sesión del usuario
		const { obtenerOrganizacionId } = await import('$lib/auth');
		const organizacionId = await obtenerOrganizacionId();

		const params = new URLSearchParams({
			organizacionId: organizacionId.toString(),
			search: search,
			page: page.toString(),
			pageSize: '5'
		});

		const response = await authFetch(`/api/clientes?${params}`);

		if (!response.ok) {
			throw new Error(`Error ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();

		return {
			clientes: data.clientes || [],
			pagination: data.pagination || {}
		};
	} catch (error) {
		return { clientes: [], pagination: {} };
	}
}

export async function cargarClienteIndividual(clienteId: number, apiEndpoint: string): Promise<ClienteAPI> {
	// NOTA: Esta función ya no usa el endpoint externo, ahora carga desde la base de datos local
	// pero requiere organizacionId para funcionar correctamente

	// Obtener organizacionId del usuario actual
	const { obtenerOrganizacionId } = await import('$lib/auth');
	const organizacionId = await obtenerOrganizacionId();

	const response = await authFetch(`/api/clientes/${clienteId}?organizacionId=${organizacionId}`);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Error ${response.status}: ${errorText}`);
	}

	return await response.json();
}

export async function guardarClienteAPI(clienteData: any, apiEndpoint: string): Promise<any> {
	// PASO 1: Guardar cliente en el endpoint LOCAL
	const response = await authFetch('/api/clientes', {
		method: 'POST',
		body: JSON.stringify(clienteData)
	});

	if (!response.ok) {
		let errorMessage = `${response.status} ${response.statusText}`;
		try {
			const result = await response.text();
			if (result) {
				errorMessage += ` - ${result}`;
			}
		} catch (parseError) {
		}
		throw new Error(`Error al guardar cliente: ${errorMessage}`);
	}

	const result = await response.json();

	// PASO 2: Buscar el cliente recién creado por RFC y asignar agente
	if (result.message && clienteData.AgenteSeleccionado) {
		try {

			// Buscar el cliente por RFC en nuestro sistema local
			const buscarResponse = await authFetch(`/api/clientes/buscar-por-rfc?rfc=${clienteData.RFC}&organizacionId=${clienteData.OrganizacionId}`);

			if (!buscarResponse.ok) {
				return result;
			}

			const clienteEncontrado = await buscarResponse.json();
			const clienteId = clienteEncontrado.id;

			if (!clienteId) {
				return result;
			}


			// Llamada a tu API local para asignar agente
			const asignacionResponse = await authFetch('/api/clientes/asignar-agente', {
				method: 'POST',
				body: JSON.stringify({
					clienteId: clienteId,
					organizacionId: clienteData.OrganizacionId,
					usuarioId: clienteData.AgenteSeleccionado
				})
			});

			if (asignacionResponse.ok) {
				const asignacionResult = await asignacionResponse.json();
				result.agenteAsignado = asignacionResult.agenteId;
			}
		} catch (asignacionError) {
			// No lanzamos error para no fallar todo el proceso
		}
	}

	return result;
}

export async function actualizarClienteAPI(clienteId: number, clienteData: any, apiEndpoint: string): Promise<any> {
	// Actualizar cliente usando endpoint LOCAL
	const response = await authFetch(`/api/clientes/${clienteId}`, {
		method: 'PUT',
		body: JSON.stringify(clienteData)
	});

	if (!response.ok) {
		let errorMessage = `Error ${response.status}: ${response.statusText}`;
		try {
			const errorData = await response.text();
			if (errorData) {
				errorMessage += ` - ${errorData}`;
			}
		} catch (parseError) {
			console.error('❌ Error al parsear respuesta de error:', parseError);
		}
		throw new Error(errorMessage);
	}

	const result = await response.json();

	// PASO 2: Actualizar asignación de agente si se seleccionó uno
	if (clienteData.AgenteSeleccionado) {
		try {

			// Asignar el agente (se agrega sin eliminar existentes)
			const asignacionResponse = await authFetch('/api/clientes/asignar-agente', {
				method: 'POST',
				body: JSON.stringify({
					clienteId: clienteId,
					organizacionId: clienteData.OrganizacionId,
					usuarioId: clienteData.AgenteSeleccionado
				})
			});

			if (asignacionResponse.ok) {
				const asignacionResult = await asignacionResponse.json();
				result.agenteActualizado = asignacionResult.agenteId;
			}
		} catch (asignacionError) {
			// No lanzamos error para no fallar todo el proceso
		}
	}

	return result;
}

export async function eliminarClienteAPI(clienteId: number, apiEndpoint: string): Promise<void> {
	// Validar que el clienteId sea válido
	if (!clienteId || clienteId <= 0) {
		throw new Error(`ID de cliente inválido: ${clienteId}`);
	}

	// PASO 1: Eliminar todas las asignaciones de agente primero
	try {
		await authFetch('/api/clientes/remover-agente', {
			method: 'POST',
			body: JSON.stringify({
				clienteId: clienteId
			})
		});
	} catch (agentError) {
		// Continuamos con la eliminación del cliente aunque falle esto
	}

	// PASO 2: Eliminar cliente del endpoint LOCAL
	const response = await authFetch(`/api/clientes/${clienteId}`, {
		method: 'DELETE'
	});

	if (!response.ok) {
		let errorMessage = `Error ${response.status}: ${response.statusText}`;
		try {
			const errorData = await response.text();
			if (errorData) {
				errorMessage += ` - ${errorData}`;
			}
		} catch (parseError) {
			console.error('❌ Error al parsear respuesta de error:', parseError);
		}
		throw new Error(errorMessage);
	}
}

export async function descargarClientesExcel(apiEndpoint: string): Promise<Blob> {
	const token = obtenerToken();
	if (!token) {
		throw new Error('No se encontró token de autenticación');
	}

	// Usar la variable de entorno apiEndpoint
	const baseEndpoint = apiEndpoint || 'http://192.168.0.30:3000';
	const fullUrl = `${baseEndpoint}/api/clientes/`;
	

	// Obtener todos los datos de clientes desde la API
	const response = await fetch(fullUrl, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${token}`
		}
	});

	if (!response.ok) {
		throw new Error(`Error ${response.status}: ${response.statusText}`);
	}

	const data: ClienteAPI[] = await response.json();

	// Preparar datos para Excel con todos los campos
	const datosExcel = data.map((cliente: ClienteAPI) => ({
		'ID': cliente.Id || '',
		'Agente de Cobranza': cliente.AgenteDeCobranza || 'Sin asignar',
		'Nombre Comercial': cliente.NombreComercial || '',
		'Razón Social': cliente.RazonSocial || '',
		'RFC': cliente.RFC || '',
		'Régimen Fiscal': cliente.RegimenFiscal || '',
		'Condiciones de Pago': cliente.CondicionesPago || '',
		'Correo Principal': cliente.CorreoPrincipal || '',
		'País': cliente.Pais || '',
		'Código País': cliente.CodigoPais || '',
		'Teléfono': cliente.Telefono || '',
		'Estado': cliente.Estado || '',
		'Calle': cliente.Calle || '',
		'Número Exterior': cliente.NumeroExterior || '',
		'Número Interior': cliente.NumeroInterior || '',
		'Código Postal': cliente.CodigoPostal || '',
		'Colonia': cliente.Colonia || '',
		'Ciudad': cliente.Ciudad || '',
		'Cuentas MXN': parseFloat(cliente.CuentasMXN || '0') || 0,
		'Cuentas USD': parseFloat(cliente.CuentasUSD || '0') || 0
	}));

	// Crear CSV manualmente (compatible con Excel)
	const headers = Object.keys(datosExcel[0] || {});
	const csvContent = [
		headers.join(','),
		...datosExcel.map((row: any) => 
			headers.map(header => {
				const value = row[header];
				// Escapar comillas y envolver en comillas si es necesario
				const stringValue = String(value || '');
				return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
					? `"${stringValue.replace(/"/g, '""')}"`
					: stringValue;
			}).join(',')
		)
	].join('\n');

	// Agregar BOM para que Excel reconozca UTF-8
	const bom = '\uFEFF';
	const csvWithBom = bom + csvContent;

	return new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
}