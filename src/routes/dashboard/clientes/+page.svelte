<script lang="ts">
	import { onMount } from 'svelte';
	import type { Cliente, Regimen, Pais, Estado, Agente, ValidationErrors } from './types.js';
	import Swal from 'sweetalert2';
	import { 
		cargarConfiguracion,
		cargarRegimenes, 
		cargarPaises, 
		cargarAgentes, 
		cargarEstados, 
		cargarClientes,
		cargarClienteIndividual,
		guardarClienteAPI,
		actualizarClienteAPI,
		eliminarClienteAPI,
		descargarClientesExcel
	} from './api.js';
	import {
		validarFormulario,
		validarCampo,
		obtenerCodigoCondicionesPago,
		actualizarCodigoPais,
		mapearClienteParaAPI,
		descargarArchivo,
		generarNombreArchivoExcel
	} from './utils.js';

	// ========================================
	// CONFIGURACIÓN
	// ========================================
	// Configurar el worker de PDF.js
	// Configuración PDF se hace dinámicamente

	const pageSize = 5;

	// ========================================
	// VARIABLES DE ESTADO - TABLA CLIENTES
	// ========================================
	let clientes: Cliente[] = [];
	let search: string = '';
	let currentPage: number = 1;
	let clienteEditando: Cliente | null = null;
	let cargandoClientes: boolean = false;
	let modoEdicion: boolean = false; // true = editando, false = agregando

	// Variables de paginación del servidor
	let totalPages: number = 1;
	let totalRecords: number = 0;

	// ========================================
	// VARIABLES DE ESTADO - MODAL
	// ========================================
	let showModal: boolean = false;
	let fiscalOpen = true;
	let contactoOpen = true;
	let agenteCobranzaOpen = true;

	// ========================================
	// VARIABLES - DATOS FISCALES
	// ========================================
	let nombreComercial = '';
	let razonSocial = '';
	let rfc = '';
	let regimen = '';
	let regimenes: Regimen[] = [];
	let condicionesPago = '';

	// ========================================
	// VARIABLES - DATOS DE CONTACTO
	// ========================================
	let correoPrincipal = '';
	let paises: Pais[] = [];
	let estados: Estado[] = [];
	let paisSeleccionado: number | null = null;
	let estadoSeleccionado: number | null = null;
	let codigoPais = '+52';
	let telefono = '';
	let calle = '';
	let numExterior = '';
	let numInterior = '';
	let codigoPostal = '';
	let colonia = '';
	let ciudad = '';

	// ========================================
	// VARIABLES - AGENTE DE COBRANZA
	// ========================================
	let agentes: Agente[] = [];
	let agenteSeleccionado: number | null = null;

	// ========================================
	// VARIABLES DE VALIDACIÓN
	// ========================================
	let errors: ValidationErrors = {};
	let isSubmitting = false;

	// ========================================
	// VARIABLES DE CONFIGURACIÓN
	// ========================================
	let apiEndpoint = '';
	let cuentasMXN: number | null = null;
	let cuentasUSD: number | null = null;

	// ========================================
	// VARIABLES - UTILIDADES
	// ========================================
	let pdfInput: HTMLInputElement;

	// ========================================
	// COMPUTED PROPERTIES (REACTIVIDAD)
	// ========================================
	// Función para manejar cambio de búsqueda con debounce
	let searchTimeout: ReturnType<typeof setTimeout>;
	function onSearchChange() {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			currentPage = 1; // Reset página al buscar
			cargarClientesLocal();
		}, 500);
	}

	// Función para manejar cambio de página
	function cambiarPagina(newPage: number) {
		if (newPage < 1 || newPage > totalPages) return;
		currentPage = newPage;
		cargarClientesLocal();
	}

	// Cargar estados cuando cambie el país seleccionado
	$: if (paisSeleccionado) {
		cargarEstadosLocal(paisSeleccionado);
	}

	// ========================================
	// FUNCIONES DE INICIALIZACIÓN
	// ========================================
	onMount(async () => {
		apiEndpoint = await cargarConfiguracion();
		await Promise.all([
			cargarRegimenesLocal(),
			cargarPaisesLocal(), 
			cargarAgentesLocal(), 
			cargarClientesLocal()
		]);
	});

	async function cargarRegimenesLocal() {
		regimenes = await cargarRegimenes();
	}

	async function cargarPaisesLocal() {
		paises = await cargarPaises();
		// Seleccionar México por defecto si no hay país seleccionado
		if (!paisSeleccionado && paises.length > 0) {
			const mexico = paises.find(p => p.NombrePais.toLowerCase().includes('méxico') || p.NombrePais.toLowerCase().includes('mexico'));
			if (mexico) {
				paisSeleccionado = mexico.ID;
				actualizarCodigoLocal();
			}
		}
	}

	async function cargarAgentesLocal() {
		agentes = await cargarAgentes();
	}

	async function cargarEstadosLocal(paisId: number) {
		estados = await cargarEstados(paisId);
		estadoSeleccionado = null;
	}

	async function cargarClientesLocal() {
		cargandoClientes = true;
		try {
			const resultado = await cargarClientes(search, currentPage);
			clientes = resultado.clientes;
			// Actualizar información de paginación del servidor
			if (resultado.pagination) {
				totalPages = resultado.pagination.totalPages || 1;
				totalRecords = resultado.pagination.totalRecords || 0;
			}
		} catch (error) {
			Swal.fire({
				title: 'Error',
				text: `No se pudieron cargar los clientes: ${error instanceof Error ? error.message : 'Error desconocido'}`,
				icon: 'error',
				confirmButtonColor: '#dc2626',
				confirmButtonText: 'Entendido'
			});
			clientes = [];
		} finally {
			cargandoClientes = false;
		}
	}

	// ========================================
	// FUNCIONES DE PROCESAMIENTO PDF
	// ========================================
	async function handlePDF(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;


		const fileReader = new FileReader();
		fileReader.onload = async function () {
			const typedarray = new Uint8Array(this.result as ArrayBuffer);

			try {
				// Importación dinámica de PDF.js solo en el cliente
				const pdfjsLib = await import('pdfjs-dist');

				// Configurar el worker desde CDN con la misma versión
				pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

				const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
				const fullText = await extraerTextoPDF(pdf);
				procesarDatosPDF(fullText);
			} catch (error) {
				Swal.fire({
					title: 'Error',
					text: `Error al procesar el archivo PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`,
					icon: 'error',
					confirmButtonColor: '#dc2626'
				});
			}
		};

		fileReader.readAsArrayBuffer(file);
	}

	async function extraerTextoPDF(pdf: any): Promise<string> {
		let fullText = '';

		// Leer página por página
		for (let i = 1; i <= pdf.numPages; i++) {
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();
			const pageText = textContent.items.map((item: any) => item.str).join(' ');
			fullText += pageText + '\n';
		}

		return fullText;
	}

	function procesarDatosPDF(fullText: string) {
		// Detectar si es persona física o empresa
		const esPersonaFisica = /Nombre \(s\):|Primer Apellido:|Segundo Apellido:/i.test(fullText);
		const esEmpresa = /Denominación\/Razón Social:/i.test(fullText);

		if (esPersonaFisica) {
			// Expresiones regulares para persona física
			const expresionesPersonaFisica = {
				nombres: /Nombre \(s\)[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Primer Apellido[:])/i,
				primerApellido: /Primer Apellido[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Segundo Apellido[:])/i,
				segundoApellido: /Segundo Apellido[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Fecha inicio de operaciones[:])/i,
				nombreComercial: /Nombre Comercial[:\s]*([A-ZÑÁÉÍÓÚ&.\s]+?)(?=\s+Datos del domicilio|Fecha)/i,
				rfc: /RFC[:\s]*([A-Z&Ñ0-9]{12,13})/i,
				codigoPostal: /Código Postal:\s*([0-9]{5})/i,
				tipoVialidad: /Tipo de Vialidad[:\s]*([A-ZÑÁÉÍÓÚ\s]+)/i,
				nombreVialidad: /Nombre de Vialidad[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Número Exterior[:])/i,
				numExterior: /Número Exterior[:\s]*([A-Z0-9]+)/i,
				numInterior: /Número Interior[:\s]*([A-Z0-9\s]*?)(?=\s+Nombre de la Colonia[:])/i,
				colonia: /Nombre de la Colonia[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Nombre de la Localidad[:])/i,
				ciudad: /Nombre de la Localidad[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Nombre del Municipio)/i
			};

			// Extraer datos de persona física
			const nombresMatch = fullText.match(expresionesPersonaFisica.nombres);
			const primerApellidoMatch = fullText.match(expresionesPersonaFisica.primerApellido);
			const segundoApellidoMatch = fullText.match(expresionesPersonaFisica.segundoApellido);
			const nombreComercialMatch = fullText.match(expresionesPersonaFisica.nombreComercial);
			const rfcMatch = fullText.match(expresionesPersonaFisica.rfc);
			const cpMatch = fullText.match(expresionesPersonaFisica.codigoPostal);
			const tipoVialidadMatch = fullText.match(expresionesPersonaFisica.tipoVialidad);
			const nombreVialidadMatch = fullText.match(expresionesPersonaFisica.nombreVialidad);
			const numExteriorMatch = fullText.match(expresionesPersonaFisica.numExterior);
			const numInteriorMatch = fullText.match(expresionesPersonaFisica.numInterior);
			const coloniaMatch = fullText.match(expresionesPersonaFisica.colonia);
			const ciudadMatch = fullText.match(expresionesPersonaFisica.ciudad);

			// Asignar valores extraídos para persona física
			if (rfcMatch) rfc = rfcMatch[1].trim();

			// Construir nombre completo y razón social
			let nombreCompleto = '';
			if (nombresMatch) nombreCompleto += nombresMatch[1].trim();
			if (primerApellidoMatch) nombreCompleto += ' ' + primerApellidoMatch[1].trim();
			if (segundoApellidoMatch) nombreCompleto += ' ' + segundoApellidoMatch[1].trim();

			if (nombreCompleto) {
				nombreComercial = nombreCompleto.trim();
				razonSocial = nombreCompleto.trim(); // Para persona física, ambos son el mismo
			}

			// Si hay nombre comercial específico, usarlo
			if (nombreComercialMatch && nombreComercialMatch[1].trim()) {
				nombreComercial = nombreComercialMatch[1].trim();
			}

			// Construir dirección
			if (tipoVialidadMatch && nombreVialidadMatch) {
				calle = `${tipoVialidadMatch[1].trim()} ${nombreVialidadMatch[1].trim()}`;
			} else if (nombreVialidadMatch) {
				calle = nombreVialidadMatch[1].trim();
			}

			if (cpMatch) codigoPostal = cpMatch[1].trim();
			if (numExteriorMatch) numExterior = numExteriorMatch[1].trim();
			if (numInteriorMatch && numInteriorMatch[1].trim()) numInterior = numInteriorMatch[1].trim();
			if (coloniaMatch) colonia = coloniaMatch[1].trim();
			if (ciudadMatch) ciudad = ciudadMatch[1].trim();

		} else if (esEmpresa) {
			// Expresiones regulares para empresa (código original)
			const expresionesEmpresa = {
				razon: /Denominación\/Razón Social[:\s]*([A-ZÑÁÉÍÓÚ&.\s]+?)(?=\s+Régimen Capital[:])/i,
				regimen: /Régimen Capital[:\s]*([A-ZÑÁÉÍÓÚ&.\s]+?)(?=\s+Nombre Comercial[:])/i,
				nombreComercial: /Nombre Comercial[:\s]*([A-ZÑÁÉÍÓÚ&.\s]+?)(?=\s+Fecha inicio de operaciones[:])/i,
				rfc: /RFC[:\s]*([A-Z&Ñ0-9]{12,13})/i,
				codigoPostal: /Código Postal:\s*([0-9]{5})/i,
				tipoVialidad: /Tipo de Vialidad[:\s]*([A-ZÑÁÉÍÓÚ\s]+)/i,
				nombreVialidad: /Nombre de Vialidad[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Número Exterior[:])/i,
				numExterior: /Número Exterior[:\s]*([A-Z0-9]+)/i,
				numInterior: /Número Interior[:\s]*([A-Z0-9\s]*?)(?=\s+Nombre de la Colonia[:])/i,
				colonia: /Nombre de la Colonia[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Nombre de la Localidad[:])/i,
				ciudad: /Nombre de la Localidad[:\s]*([A-ZÑÁÉÍÓÚ\s]+?)(?=\s+Nombre del Municipio)/i
			};

			// Extraer datos de empresa
			const razonMatch = fullText.match(expresionesEmpresa.razon);
			const regimenMatch = fullText.match(expresionesEmpresa.regimen);
			const nombreComercialMatch = fullText.match(expresionesEmpresa.nombreComercial);
			const rfcMatch = fullText.match(expresionesEmpresa.rfc);
			const cpMatch = fullText.match(expresionesEmpresa.codigoPostal);
			const tipoVialidadMatch = fullText.match(expresionesEmpresa.tipoVialidad);
			const nombreVialidadMatch = fullText.match(expresionesEmpresa.nombreVialidad);
			const numExteriorMatch = fullText.match(expresionesEmpresa.numExterior);
			const numInteriorMatch = fullText.match(expresionesEmpresa.numInterior);
			const coloniaMatch = fullText.match(expresionesEmpresa.colonia);
			const ciudadMatch = fullText.match(expresionesEmpresa.ciudad);

			// Asignar valores extraídos para empresa
			if (rfcMatch) rfc = rfcMatch[1].trim();
			if (razonMatch) razonSocial = razonMatch[1].trim();
			if (regimenMatch) regimen = regimenMatch[1].trim();
			if (nombreComercialMatch) nombreComercial = nombreComercialMatch[1].trim();

			// Construir dirección
			if (tipoVialidadMatch && nombreVialidadMatch) {
				calle = `${tipoVialidadMatch[1].trim()} ${nombreVialidadMatch[1].trim()}`;
			} else if (nombreVialidadMatch) {
				calle = nombreVialidadMatch[1].trim();
			}

			if (cpMatch) codigoPostal = cpMatch[1].trim();
			if (numExteriorMatch) numExterior = numExteriorMatch[1].trim();
			if (numInteriorMatch && numInteriorMatch[1].trim()) numInterior = numInteriorMatch[1].trim();
			if (coloniaMatch) colonia = coloniaMatch[1].trim();
			if (ciudadMatch) ciudad = ciudadMatch[1].trim();
		}

		// Mostrar notificación de éxito con el tipo detectado
		const tipoDetectado = esPersonaFisica ? 'Persona Física' : esEmpresa ? 'Empresa' : 'Desconocido';
		Swal.fire({
			title: '¡PDF procesado exitosamente!',
			text: `Se detectó: ${tipoDetectado}. Los datos han sido cargados automáticamente.`,
			icon: 'success',
			confirmButtonColor: '#059669',
			timer: 3000,
			showConfirmButton: false
		});
	}

	// ========================================
	// FUNCIONES DE GESTIÓN DE CLIENTES
	// ========================================
	async function descargarExcel() {
		try {
			Swal.fire({
				title: 'Generando archivo Excel...',
				text: 'Por favor espera',
				icon: 'info',
				allowOutsideClick: false,
				allowEscapeKey: false,
				showConfirmButton: false,
				didOpen: () => {
					Swal.showLoading();
				}
			});

			const blob = await descargarClientesExcel(apiEndpoint);
			const nombreArchivo = generarNombreArchivoExcel();
			descargarArchivo(blob, nombreArchivo);

			Swal.fire({
				title: '¡Descarga exitosa!',
				text: 'Archivo CSV descargado exitosamente',
				icon: 'success',
				confirmButtonColor: '#059669',
				timer: 3000,
				showConfirmButton: false
			});

		} catch (error) {
			Swal.fire({
				title: 'Error',
				text: `No se pudo generar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`,
				icon: 'error',
				confirmButtonColor: '#dc2626'
			});
		}
	}
	async function editarCliente(cliente: Cliente) {
		try {
			clienteEditando = { ...cliente };
			
			Swal.fire({
				title: 'Cargando datos del cliente...',
				text: 'Por favor espera',
				icon: 'info',
				allowOutsideClick: false,
				allowEscapeKey: false,
				showConfirmButton: false,
				didOpen: () => {
					Swal.showLoading();
				}
			});

			const clienteCompleto = await cargarClienteIndividual(cliente.id, apiEndpoint);

			Swal.close();

			// Cargar todos los datos en el formulario
			nombreComercial = clienteCompleto.NombreComercial || '';
			razonSocial = clienteCompleto.RazonSocial || '';
			rfc = clienteCompleto.RFC || '';
			condicionesPago = obtenerCodigoCondicionesPago(clienteCompleto.CondicionesPago || '');
			correoPrincipal = clienteCompleto.CorreoPrincipal || '';
			codigoPais = clienteCompleto.CodigoPais ? `+${clienteCompleto.CodigoPais}` : '+52';
			telefono = clienteCompleto.Telefono || '';
			calle = clienteCompleto.Calle || '';
			numExterior = clienteCompleto.NumeroExterior || '';
			numInterior = clienteCompleto.NumeroInterior || '';
			codigoPostal = clienteCompleto.CodigoPostal || '';
			colonia = clienteCompleto.Colonia || '';
			ciudad = clienteCompleto.Ciudad || '';
			cuentasMXN = cliente.cuentasMXN || 0;
			cuentasUSD = cliente.cuentasUSD || 0;
			
			// Buscar el agente correspondiente
			const agenteEncontrado = agentes.find(a => a.text === cliente.agente);
			agenteSeleccionado = agenteEncontrado ? agenteEncontrado.value : null;
			
			// Usar los IDs directamente que vienen de la BD
			paisSeleccionado = clienteCompleto.PaisId || null;
			estadoSeleccionado = clienteCompleto.EstadoId || null;
			regimen = clienteCompleto.RegimenFiscalId ? clienteCompleto.RegimenFiscalId.toString() : '';

			// Cargar estados del país seleccionado si existe
			if (paisSeleccionado) {
				estados = await cargarEstados(paisSeleccionado);
			}
			
			modoEdicion = true;
			showModal = true;

		} catch (error) {
			Swal.fire({
				title: 'Error',
				text: `No se pudieron cargar los datos del cliente: ${error instanceof Error ? error.message : 'Error desconocido'}`,
				icon: 'error',
				confirmButtonColor: '#dc2626'
			});
			
			// Fallback: usar datos básicos disponibles
			clienteEditando = { ...cliente };
			nombreComercial = cliente.cliente || '';
			razonSocial = cliente.razonSocial || '';
			rfc = cliente.rfc || '';
			condicionesPago = obtenerCodigoCondicionesPago(cliente.condiciones);
			cuentasMXN = cliente.cuentasMXN || 0;
			cuentasUSD = cliente.cuentasUSD || 0;
			
			const agenteEncontrado = agentes.find(a => a.text === cliente.agente);
			agenteSeleccionado = agenteEncontrado ? agenteEncontrado.value : null;
			
			modoEdicion = true;
			showModal = true;
		}
	}


	async function eliminarCliente(clienteId: number) {
		const resultado = await Swal.fire({
			title: '¿Estás seguro?',
			text: 'Esta acción no se puede deshacer',
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#dc2626',
			cancelButtonColor: '#6b7280',
			confirmButtonText: 'Sí, eliminar',
			cancelButtonText: 'Cancelar'
		});

		if (resultado.isConfirmed) {
			Swal.fire({
				title: 'Eliminando cliente...',
				text: 'Por favor espera',
				icon: 'info',
				allowOutsideClick: false,
				allowEscapeKey: false,
				showConfirmButton: false,
				didOpen: () => {
					Swal.showLoading();
				}
			});

			try {
				await eliminarClienteAPI(clienteId, apiEndpoint);
				
				// Eliminar cliente de la lista local
				clientes = clientes.filter(c => c.id !== clienteId);
				
				// Ajustar página actual si es necesario
				if (clientes.length === 1 && currentPage > 1) {
					currentPage = currentPage - 1;
				}
				
				Swal.fire({
					title: '¡Eliminado!',
					text: 'El cliente ha sido eliminado exitosamente',
					icon: 'success',
					confirmButtonColor: '#059669',
					timer: 2000,
					showConfirmButton: false
				});
			} catch (error) {
				Swal.fire({
					title: 'Error',
					text: `No se pudo eliminar el cliente: ${error instanceof Error ? error.message : 'Error desconocido'}`,
					icon: 'error',
					confirmButtonColor: '#dc2626',
					confirmButtonText: 'Entendido'
				});
			}
		}
	}

	async function actualizarCliente() {
		if (!clienteEditando) return;
		
		// Validar formulario antes de enviar
		const validacion = validarFormulario(
			nombreComercial, razonSocial, rfc, regimen, condicionesPago,
			correoPrincipal, paisSeleccionado, telefono, estadoSeleccionado,
			calle, numExterior, agenteSeleccionado
		);
		
		if (!validacion.esValido) {
			errors = validacion.errores;
			Swal.fire({
				title: 'Formulario Incompleto',
				text: 'Por favor completa todos los campos requeridos',
				icon: 'warning',
				confirmButtonColor: '#f59e0b'
			});
			return;
		}

		isSubmitting = true;
		
		Swal.fire({
			title: 'Actualizando cliente...',
			text: 'Por favor espera',
			icon: 'info',
			allowOutsideClick: false,
			allowEscapeKey: false,
			showConfirmButton: false,
			didOpen: () => {
				Swal.showLoading();
			}
		});

		try {
			if (!clienteEditando) {
				throw new Error('No hay cliente seleccionado para editar');
			}

			const clienteData = mapearClienteParaAPI(
				nombreComercial, razonSocial, rfc, regimen, condicionesPago,
				correoPrincipal, paisSeleccionado, codigoPais, telefono,
				estadoSeleccionado, calle, numExterior, numInterior,
				codigoPostal, colonia, ciudad, agenteSeleccionado,
				paises, estados, regimenes, agentes
			);


			await actualizarClienteAPI(clienteEditando.id, clienteData, apiEndpoint);
			
			// Actualizar cliente en la lista local
			const clienteActualizado: Cliente = {
				...clienteEditando,
				agente: 'Asignado automáticamente',
				cliente: clienteData.NombreComercial || clienteData.RazonSocial,
				razonSocial: clienteData.RazonSocial,
				rfc: clienteData.RFC,
				condiciones: clienteData.CondicionesPago,
				cuentasMXN: cuentasMXN ?? 0,
				cuentasUSD: cuentasUSD ?? 0
			};
			
			clientes = clientes.map(c => c.id === clienteEditando?.id ? clienteActualizado : c);
			
			limpiarFormulario();
			clienteEditando = null;
			showModal = false;
			
			Swal.fire({
				title: '¡Éxito!',
				text: 'Cliente actualizado exitosamente',
				icon: 'success',
				confirmButtonColor: '#059669',
				timer: 2000,
				showConfirmButton: false
			});
		} catch (error) {
			Swal.fire({
				title: 'Error',
				text: 'Error al actualizar el cliente',
				icon: 'error',
				confirmButtonColor: '#dc2626'
			});
		} finally {
			isSubmitting = false;
		}
	}

	function cancelarModal() {
		clienteEditando = null;
		modoEdicion = false;
		showModal = false;
		limpiarFormulario();
	}
	async function agregarCliente() {
		// Validar formulario antes de enviar
		const validacion = validarFormulario(
			nombreComercial, razonSocial, rfc, regimen, condicionesPago,
			correoPrincipal, paisSeleccionado, telefono, estadoSeleccionado,
			calle, numExterior, agenteSeleccionado
		);
		
		if (!validacion.esValido) {
			errors = validacion.errores;
			Swal.fire({
				title: 'Formulario Incompleto',
				text: 'Por favor completa todos los campos requeridos',
				icon: 'warning',
				confirmButtonColor: '#f59e0b'
			});
			return;
		}

		isSubmitting = true;

		Swal.fire({
			title: 'Guardando cliente...',
			text: 'Por favor espera',
			icon: 'info',
			allowOutsideClick: false,
			allowEscapeKey: false,
			showConfirmButton: false,
			didOpen: () => {
				Swal.showLoading();
			}
		});

		try {
			const clienteData = mapearClienteParaAPI(
				nombreComercial, razonSocial, rfc, regimen, condicionesPago,
				correoPrincipal, paisSeleccionado, codigoPais, telefono,
				estadoSeleccionado, calle, numExterior, numInterior,
				codigoPostal, colonia, ciudad, agenteSeleccionado,
				paises, estados, regimenes, agentes
			);
			
			await guardarClienteAPI(clienteData, apiEndpoint);
			agregarClienteLocal(clienteData);
			limpiarFormulario();
			showModal = false;
			
			Swal.fire({
				title: '¡Éxito!',
				text: 'Cliente creado exitosamente',
				icon: 'success',
				confirmButtonColor: '#059669',
				timer: 2000,
				showConfirmButton: false
			});
		} catch (error) {
			Swal.fire({
				title: 'Error',
				text: error instanceof Error ? error.message : 'Error al crear el cliente',
				icon: 'error',
				confirmButtonColor: '#dc2626'
			});
		} finally {
			isSubmitting = false;
		}
	}

	function agregarClienteLocal(clienteData: any) {
		cargarClientesLocal();
	}

	function limpiarFormulario() {
		// Limpiar datos fiscales
		nombreComercial = '';
		razonSocial = '';
		rfc = '';
		regimen = '';
		condicionesPago = '';

		// Limpiar datos de contacto
		correoPrincipal = '';
		paisSeleccionado = null;
		estadoSeleccionado = null;
		codigoPais = '+52';
		telefono = '';
		calle = '';
		numExterior = '';
		numInterior = '';
		codigoPostal = '';
		colonia = '';
		ciudad = '';

		// Limpiar agente de cobranza
		agenteSeleccionado = null;

		// Limpiar datos financieros
		cuentasMXN = null;
		cuentasUSD = null;
	}

	function establecerDefaults() {
		// Establecer México por defecto
		if (paises.length > 0) {
			const mexico = paises.find(p => p.NombrePais.toLowerCase().includes('méxico') || p.NombrePais.toLowerCase().includes('mexico'));
			if (mexico) {
				paisSeleccionado = mexico.ID;
				actualizarCodigoLocal();
			}
		}
	}

	// ========================================
	// FUNCIONES DE UTILIDAD
	// ========================================

	function actualizarCodigoLocal() {
		codigoPais = actualizarCodigoPais(paisSeleccionado);
	}

	// ========================================
	// FUNCIONES DE VALIDACIÓN
	// ========================================
	
	function limpiarErrores() {
		errors = {};
	}
	
	function validarCampoLocal(campo: string, valor: any) {
		errors = validarCampo(campo, valor, errors);
	}
</script>

<div class="flex flex-col h-screen p-2">
	<!-- Encabezado y botones -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-4">
			<h1 class="text-2xl font-bold text-gray-800">Clientes</h1>
			{#if totalRecords > 0}
				<span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
					{totalRecords} cliente{totalRecords !== 1 ? 's' : ''}
				</span>
			{/if}
		</div>
		<div class="flex gap-2">
			<button
				class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
				on:click={cargarClientesLocal}
				disabled={cargandoClientes}
				title="Recargar datos de clientes"
			>
				{#if cargandoClientes}
					<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				{:else}
					🔄
				{/if}
				Recargar
			</button>
			<button
				class="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
				on:click={descargarExcel}
				disabled={cargandoClientes || clientes.length === 0}
				title="Descargar clientes en Excel"
			>
				📄 Descargar Excel
			</button>
			<button
				class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
				on:click={() => { modoEdicion = false; clienteEditando = null; limpiarFormulario(); establecerDefaults(); showModal = true; }}
			>
				Agregar Cliente
			</button>
		</div>
	</div>

	<!-- Búsqueda Unificada -->
	<div class="mb-4">
		<div class="relative">
			<input
				type="text"
				placeholder="Buscar por ID, agente, cliente, RFC, razón social, condiciones de pago o montos..."
				bind:value={search}
				on:input={onSearchChange}
				class="border border-gray-300 rounded-lg px-4 py-3 w-full pl-10 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
			/>
			<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
				<svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
				</svg>
			</div>
		</div>
		{#if search}
			<p class="text-sm text-gray-600 mt-2">
				Mostrando {clientes.length} de {totalRecords} clientes (filtrados)
			</p>
		{/if}
	</div>

	<!-- Contenedor de tabla que ocupa todo el espacio restante -->
	<div class="flex-1 overflow-auto border rounded shadow">
		{#if cargandoClientes}
			<!-- Indicador de carga -->
			<div class="flex items-center justify-center h-64">
				<div class="flex flex-col items-center space-y-4">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
					<p class="text-gray-600">Cargando clientes...</p>
				</div>
			</div>
		{:else}
			<table class="min-w-full divide-y divide-gray-200 h-full">
				<thead class="bg-gray-100 sticky top-0 z-10">
					<tr>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">ID</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Agente Cobranza</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Cliente</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">RFC</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Razón Social</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Condición de Pago</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Cuenta MXN</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Cuenta USD</th>
						<th class="px-4 py-2 text-left text-sm font-medium text-gray-600">Acciones</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200">
					{#each clientes as cliente}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-2">{cliente.id}</td>
							<td class="px-4 py-2">{cliente.agente}</td>
							<td class="px-4 py-2">{cliente.cliente}</td>
							<td class="px-4 py-2">{cliente.rfc}</td>
							<td class="px-4 py-2">{cliente.razonSocial}</td>
							<td class="px-4 py-2">{cliente.condiciones}</td>
							<td class="px-4 py-2"
								>{cliente.cuentasMXN.toLocaleString('es-MX', {
									style: 'currency',
									currency: 'MXN'
								})}</td
							>
							<td class="px-4 py-2"
								>{cliente.cuentasUSD.toLocaleString('en-US', {
									style: 'currency',
									currency: 'USD'
								})}</td
							>
							<td class="px-4 py-2">
								<div class="flex gap-2">
									<button
										class="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
										on:click={() => editarCliente(cliente)}
										title="Editar cliente"
									>
										✏️
									</button>
									<button
										class="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
										on:click={() => eliminarCliente(cliente.id)}
										title="Eliminar cliente"
									>
										🗑️
									</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if !cargandoClientes && clientes.length === 0 && totalRecords === 0}
						<tr>
							<td colspan="9" class="text-center py-8 text-gray-500">
								<div class="flex flex-col items-center space-y-2">
									<svg class="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
									</svg>
									<p class="font-medium">No hay clientes registrados</p>
									<p class="text-sm">Agrega tu primer cliente haciendo clic en "Agregar Cliente"</p>
								</div>
							</td>
						</tr>
					{:else if !cargandoClientes && clientes.length === 0 && totalRecords > 0}
						<tr>
							<td colspan="9" class="text-center py-8 text-gray-500">
								<div class="flex flex-col items-center space-y-2">
									<svg class="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
									</svg>
									<p class="font-medium">No se encontraron resultados</p>
									<p class="text-sm">Intenta con otros términos de búsqueda</p>
								</div>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Paginación Responsive -->
	{#if !cargandoClientes && clientes.length > 0 && totalPages > 1}
	<div class="mt-4">
		<!-- Info de paginación -->
		<div class="text-sm text-gray-600 text-center mb-3">
			Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalRecords)} - {Math.min(currentPage * pageSize, totalRecords)} de {totalRecords} clientes
			{#if search}
				(filtrados)
			{/if}
		</div>
		
		<!-- Controles de paginación -->
		<div class="flex justify-center">
			<!-- Vista móvil (pantallas pequeñas) -->
			<div class="flex items-center gap-2 md:hidden">
				<button class="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50" on:click={() => cambiarPagina(currentPage - 1)} disabled={currentPage === 1}>‹</button>
				<span class="px-3 py-2 text-sm font-medium">{currentPage} / {totalPages}</span>
				<button class="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50" on:click={() => cambiarPagina(currentPage + 1)} disabled={currentPage === totalPages}>›</button>
			</div>
			
			<!-- Vista desktop (pantallas medianas y grandes) -->
			<div class="hidden md:flex items-center gap-1">
				<button class="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50" on:click={() => cambiarPagina(currentPage - 1)} disabled={currentPage === 1}>Anterior</button>
				
				<!-- Mostrar solo las páginas relevantes -->
				{#each Array(Math.min(totalPages, 7)) as _, i}
					{@const pageNumber = Math.max(1, Math.min(totalPages - 6, currentPage - 3)) + i}
					{#if pageNumber <= totalPages}
						<button
							class="px-3 py-2 rounded text-sm {currentPage === pageNumber ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
							on:click={() => cambiarPagina(pageNumber)}
						>
							{pageNumber}
						</button>
					{/if}
				{/each}
				
				<button class="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50" on:click={() => cambiarPagina(currentPage + 1)} disabled={currentPage === totalPages}>Siguiente</button>
			</div>
		</div>
	</div>
	{/if}
</div>

<!-- Modal para agregar cliente -->
{#if showModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white rounded-lg w-[900px] max-h-[90vh] overflow-y-auto shadow-2xl">
			<!-- Header -->
			<div class="flex justify-between items-center border-b px-8 py-4">
				<h2 class="text-2xl font-semibold text-gray-800">
					{modoEdicion ? `Editar Cliente - ${clienteEditando?.cliente || clienteEditando?.razonSocial || 'Sin nombre'}` : 'Agregar Cliente'}
				</h2>
				<button class="text-gray-500 hover:text-gray-700" on:click={cancelarModal}
					>✕</button
				>
			</div>

			<!-- Contenido -->
			<div class="p-8 space-y-8">
				<!-- Datos Fiscales -->
				<div class="border rounded-lg">
					<button
						class="w-full flex justify-between items-center px-6 py-4 bg-gray-100 border-b text-left font-semibold text-gray-700 hover:bg-gray-200"
						on:click={() => (fiscalOpen = !fiscalOpen)}
					>
						Datos Fiscales
						<span>{fiscalOpen ? '▲' : '▼'}</span>
					</button>
					{#if fiscalOpen}
						<div class="p-6 space-y-6">
							<!-- Subir PDF -->
							<div
								class="border-2 border-dashed rounded-lg p-8 text-center text-gray-600 hover:bg-gray-50 cursor-pointer transition-all ease-in-out"
								role="button"
								tabindex="0"
								on:click={() => pdfInput.click()}
								on:keydown={(e) => e.key === 'Enter' && pdfInput.click()}
							>
								<p>
									Para un llenado rápido, carga la <span class="font-semibold"
										>Constancia de Situación Fiscal</span
									>
								</p>
								<p class="text-sm text-gray-500">Formatos válidos: PDF</p>
								<input
									type="file"
									accept="application/pdf"
									class="hidden"
									bind:this={pdfInput}
									on:change={handlePDF}
								/>
							</div>

							<!-- Campos -->
							<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
								<div>
									<label for="nombreComercial" class="text-sm font-medium text-gray-700"
										>Nombre comercial <span class="text-red-500">*</span></label
									>
									<input
										id="nombreComercial"
										type="text"
										bind:value={nombreComercial}
										on:input={() => validarCampoLocal('nombreComercial', nombreComercial)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.nombreComercial ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									/>
									{#if errors.nombreComercial}
										<p class="text-red-500 text-sm mt-1">{errors.nombreComercial}</p>
									{/if}
								</div>
								<div>
									<label for="razonSocial" class="text-sm font-medium text-gray-700"
										>Razón social <span class="text-red-500">*</span></label
									>
									<input
										id="razonSocial"
										type="text"
										bind:value={razonSocial}
										on:input={() => validarCampoLocal('razonSocial', razonSocial)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.razonSocial ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									/>
									{#if errors.razonSocial}
										<p class="text-red-500 text-sm mt-1">{errors.razonSocial}</p>
									{/if}
								</div>
								<div>
									<label for="rfc" class="text-sm font-medium text-gray-700">RFC <span class="text-red-500">*</span></label>
									<input
										id="rfc"
										type="text"
										bind:value={rfc}
										placeholder="Ej: ABC123456789"
										on:input={() => validarCampoLocal('rfc', rfc)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.rfc ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									/>
									{#if errors.rfc}
										<p class="text-red-500 text-sm mt-1">{errors.rfc}</p>
									{/if}
								</div>

								<!-- Regimen -->
								<div>
									<label for="regimen" class="text-sm font-medium text-gray-700"
										>Régimen Fiscal <span class="text-red-500">*</span></label
									>
									<select
										id="regimen"
										bind:value={regimen}
										on:change={() => validarCampoLocal('regimen', regimen)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.regimen ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									>
										<option value="">Seleccionar régimen</option>
										{#each regimenes as { ID_Regimen, Codigo, Descripcion }}
											<option value={ID_Regimen.toString()}>
												{Codigo} - {Descripcion}
											</option>
										{/each}
									</select>
									{#if errors.regimen}
										<p class="text-red-500 text-sm mt-1">{errors.regimen}</p>
									{/if}
								</div>
								<div>
									<label for="condiciones" class="text-sm font-medium text-gray-700"
										>Condiciones de pago <span class="text-red-500">*</span></label
									>
									<select
										id="condiciones"
										bind:value={condicionesPago}
										on:change={() => validarCampoLocal('condicionesPago', condicionesPago)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.condicionesPago ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									>
										<option value="">Seleccionar condición</option>
										<option value="1">De Contado</option>
										<option value="2">7 Días</option>
										<option value="3">15 Días</option>
										<option value="4">30 Días</option>
										<option value="5">45 Días</option>
										<option value="6">60 Días</option>
										<option value="7">90 Días</option>
									</select>
									{#if errors.condicionesPago}
										<p class="text-red-500 text-sm mt-1">{errors.condicionesPago}</p>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Datos de Contacto -->
				<div class="border rounded-lg">
					<button
						class="w-full flex justify-between items-center px-6 py-4 bg-gray-100 border-b text-left font-semibold text-gray-700 hover:bg-gray-200"
						on:click={() => (contactoOpen = !contactoOpen)}
					>
						Datos de Contacto
						<span>{contactoOpen ? '▲' : '▼'}</span>
					</button>
					{#if contactoOpen}
						<div class="p-6 space-y-6">
							<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
								<div>
									<label for="correo" class="text-sm font-medium text-gray-700"
										>Correo Principal <span class="text-red-500">*</span></label
									>
									<input
										id="correo"
										type="email"
										bind:value={correoPrincipal}
										placeholder="ejemplo@correo.com"
										on:input={() => validarCampoLocal('correoPrincipal', correoPrincipal)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.correoPrincipal ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									/>
									{#if errors.correoPrincipal}
										<p class="text-red-500 text-sm mt-1">{errors.correoPrincipal}</p>
									{/if}
								</div>

								<div>
									<label for="pais" class="text-sm font-medium text-gray-700">País <span class="text-red-500">*</span></label>
									<select
										id="pais"
										bind:value={paisSeleccionado}
										on:change={() => { actualizarCodigoLocal(); validarCampoLocal('paisSeleccionado', paisSeleccionado); }}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.paisSeleccionado ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									>
										<option value={null}>Seleccionar país</option>
										{#each paises as pais}
											<option value={pais.ID}>
												{pais.NombrePais}
											</option>
										{/each}
									</select>
									{#if errors.paisSeleccionado}
										<p class="text-red-500 text-sm mt-1">{errors.paisSeleccionado}</p>
									{/if}
								</div>

								<div>
									<label for="codigoPais" class="text-sm font-medium text-gray-700"
										>Código de país</label
									>
									<select
										id="codigoPais"
										bind:value={codigoPais}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value="+52">+52 (México)</option>
										<option value="+1">+1 (Estados Unidos)</option>
									</select>
								</div>

								<div>
									<label for="telefono" class="text-sm font-medium text-gray-700">Teléfono <span class="text-red-500">*</span></label>
									<input
										id="telefono"
										type="text"
										inputmode="numeric"
										pattern="[0-9]*"
										bind:value={telefono}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.telefono ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
										placeholder="Ej: 5512345678 (exactamente 10 dígitos)"
										maxlength="10"
										on:input={(e) => {
											const target = e.target as HTMLInputElement;
											const soloNumeros = target.value.replace(/\D/g, '');
											telefono = soloNumeros.slice(0, 10); // Limitar a máximo 10 dígitos
											validarCampoLocal('telefono', telefono);
										}}
									/>
									{#if errors.telefono}
										<p class="text-red-500 text-sm mt-1">{errors.telefono}</p>
									{/if}
								</div>
								<!-- ESTADO -->
								<div>
									<label for="estado" class="text-sm font-medium text-gray-700">Estado <span class="text-red-500">*</span></label>
									<select
										id="estado"
										bind:value={estadoSeleccionado}
										on:change={() => validarCampoLocal('estadoSeleccionado', estadoSeleccionado)}
										disabled={!paisSeleccionado || estados.length === 0}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.estadoSeleccionado ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'} disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
									>
										<option value={null}>
											{!paisSeleccionado
												? 'Primero selecciona un país'
												: estados.length === 0
													? 'Cargando estados...'
													: 'Seleccionar estado'}
										</option>
										{#each estados as estado}
											<option value={estado.ID}>
												{estado.NombreEstado}
											</option>
										{/each}
									</select>
									{#if errors.estadoSeleccionado}
										<p class="text-red-500 text-sm mt-1">{errors.estadoSeleccionado}</p>
									{/if}
								</div>

								<div>
									<label for="calle" class="text-sm font-medium text-gray-700">Calle <span class="text-red-500">*</span></label>
									<input
										id="calle"
										type="text"
										bind:value={calle}
										placeholder="Ej: Av. Insurgentes Sur"
										on:input={() => validarCampoLocal('calle', calle)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.calle ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									/>
									{#if errors.calle}
										<p class="text-red-500 text-sm mt-1">{errors.calle}</p>
									{/if}
								</div>
								<div>
									<label for="numInterior" class="text-sm font-medium text-gray-700"
										>Número interior</label
									>
									<input
										id="numInterior"
										type="text"
										bind:value={numInterior}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
									/>
								</div>
								<div>
									<label for="numExterior" class="text-sm font-medium text-gray-700"
										>Número exterior <span class="text-red-500">*</span></label
									>
									<input
										id="numExterior"
										type="text"
										bind:value={numExterior}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.numExterior ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
										placeholder="Ej: 123"
										on:input={(e) => {
											const target = e.target as HTMLInputElement;
											numExterior = target.value.replace(/\D/g, '');
											validarCampoLocal('numExterior', numExterior);
										}}
									/>
									{#if errors.numExterior}
										<p class="text-red-500 text-sm mt-1">{errors.numExterior}</p>
									{/if}
								</div>
								<div>
									<label for="codigoPostal" class="text-sm font-medium text-gray-700">
										Código Postal <span class="text-red-500">*</span>
									</label>
									<input
										id="codigoPostal"
										type="text"
										bind:value={codigoPostal}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Ej: 06100"
										maxlength="5"
										on:input={(e) => {
											const target = e.target as HTMLInputElement;
											codigoPostal = target.value.replace(/\D/g, '').slice(0, 5);
										}}
									/>
								</div>
								<div>
									<label for="colonia" class="text-sm font-medium text-gray-700">
										Colonia <span class="text-red-500">*</span>
									</label>
									<input
										id="colonia"
										type="text"
										bind:value={colonia}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Ej: Roma Norte"
									/>
								</div>
								<div>
									<label for="ciudad" class="text-sm font-medium text-gray-700">
										Ciudad <span class="text-red-500">*</span>
									</label>
									<input
										id="ciudad"
										type="text"
										bind:value={ciudad}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Ej: Ciudad de México"
									/>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!--AGENTE DE COBRANZA ASIGNADO -->
				<div class="border rounded-lg">
					<button
						class="w-full flex justify-between items-center px-6 py-4 bg-gray-100 border-b text-left font-semibold text-gray-700 hover:bg-gray-200"
						on:click={() => (agenteCobranzaOpen = !agenteCobranzaOpen)}
					>
						Agente de Cobranza Asignado
						<span>{agenteCobranzaOpen ? '▲' : '▼'}</span>
					</button>

					{#if agenteCobranzaOpen}
						<div class="p-6 space-y-6">
							<div class="grid grid-cols-1 gap-8">
								<!-- Cambié a grid-cols-1 para que ocupe toda la fila -->
								<div class="w-full">
									<label for="agenteCobranza" class="text-sm font-medium text-gray-700"
										>Agente de Cobranza <span class="text-red-500">*</span></label
									>
									<select
										id="agenteCobranza"
										bind:value={agenteSeleccionado}
										on:change={() => validarCampoLocal('agenteSeleccionado', agenteSeleccionado)}
										class="mt-1 block w-full border rounded-md px-4 py-3 text-gray-800 focus:outline-none focus:ring-2 {errors.agenteSeleccionado ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
									>
										<option value={null}>Seleccionar agente</option>
										{#each agentes as agente}
											<option value={agente.value}>
												{agente.text}
											</option>
										{/each}
									</select>
									{#if errors.agenteSeleccionado}
										<p class="text-red-500 text-sm mt-1">{errors.agenteSeleccionado}</p>
									{/if}
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
			<!-- Footer -->
			<div class="flex justify-end gap-4 border-t px-8 py-4">
				<button
					class="px-6 py-3 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700"
					on:click={cancelarModal}
				>
					Cancelar
				</button>
				<button
					class="px-6 py-3 rounded-md {modoEdicion ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'} text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
					on:click={modoEdicion ? actualizarCliente : agregarCliente}
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						{modoEdicion ? 'Actualizando...' : 'Guardando...'}
					{:else}
						{modoEdicion ? 'Actualizar' : 'Guardar'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
