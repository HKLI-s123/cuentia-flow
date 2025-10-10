<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Badge, Input, Modal } from '$lib/components/ui';
	import type { Cliente, Regimen, Pais, Estado, Agente, ValidationErrors } from './types.js';
	import Swal from 'sweetalert2';
	import { UserPlus, Edit2, Trash2, Download, Search } from 'lucide-svelte';
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
	const pageSize = 20;

	// ========================================
	// VARIABLES DE ESTADO - TABLA CLIENTES
	// ========================================
	let clientes: Cliente[] = [];
	let search: string = '';
	let currentPage: number = 1;
	let clienteEditando: Cliente | null = null;
	let cargandoClientes: boolean = false;
	let modoEdicion: boolean = false;

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
	let searchTimeout: ReturnType<typeof setTimeout>;
	function onSearchChange() {
		if (searchTimeout) clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			currentPage = 1;
			cargarClientesLocal();
		}, 500);
	}

	function cambiarPagina(newPage: number) {
		if (newPage < 1 || newPage > totalPages) return;
		currentPage = newPage;
		cargarClientesLocal();
	}

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
				const pdfjsLib = await import('pdfjs-dist');
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
		for (let i = 1; i <= pdf.numPages; i++) {
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();
			const pageText = textContent.items.map((item: any) => item.str).join(' ');
			fullText += pageText + '\n';
		}
		return fullText;
	}

	function procesarDatosPDF(fullText: string) {
		const esPersonaFisica = /Nombre \(s\):|Primer Apellido:|Segundo Apellido:/i.test(fullText);
		const esEmpresa = /Denominación\/Razón Social:/i.test(fullText);

		if (esPersonaFisica) {
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

			if (rfcMatch) rfc = rfcMatch[1].trim();

			let nombreCompleto = '';
			if (nombresMatch) nombreCompleto += nombresMatch[1].trim();
			if (primerApellidoMatch) nombreCompleto += ' ' + primerApellidoMatch[1].trim();
			if (segundoApellidoMatch) nombreCompleto += ' ' + segundoApellidoMatch[1].trim();

			if (nombreCompleto) {
				nombreComercial = nombreCompleto.trim();
				razonSocial = nombreCompleto.trim();
			}

			if (nombreComercialMatch && nombreComercialMatch[1].trim()) {
				nombreComercial = nombreComercialMatch[1].trim();
			}

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

			if (rfcMatch) rfc = rfcMatch[1].trim();
			if (razonMatch) razonSocial = razonMatch[1].trim();
			if (regimenMatch) regimen = regimenMatch[1].trim();
			if (nombreComercialMatch) nombreComercial = nombreComercialMatch[1].trim();

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

			const agenteEncontrado = agentes.find(a => a.text === cliente.agente);
			agenteSeleccionado = agenteEncontrado ? agenteEncontrado.value : null;

			paisSeleccionado = clienteCompleto.PaisId || null;
			estadoSeleccionado = clienteCompleto.EstadoId || null;
			regimen = clienteCompleto.RegimenFiscalId ? clienteCompleto.RegimenFiscalId.toString() : '';

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
				clientes = clientes.filter(c => c.id !== clienteId);

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
		nombreComercial = '';
		razonSocial = '';
		rfc = '';
		regimen = '';
		condicionesPago = '';
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
		agenteSeleccionado = null;
		cuentasMXN = null;
		cuentasUSD = null;
	}

	function establecerDefaults() {
		if (paises.length > 0) {
			const mexico = paises.find(p => p.NombrePais.toLowerCase().includes('méxico') || p.NombrePais.toLowerCase().includes('mexico'));
			if (mexico) {
				paisSeleccionado = mexico.ID;
				actualizarCodigoLocal();
			}
		}
	}

	function actualizarCodigoLocal() {
		codigoPais = actualizarCodigoPais(paisSeleccionado);
	}

	function limpiarErrores() {
		errors = {};
	}

	function validarCampoLocal(campo: string, valor: any) {
		errors = validarCampo(campo, valor, errors);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<p class="text-gray-600">
				{#if totalRecords > 0}
					{totalRecords} cliente{totalRecords !== 1 ? 's' : ''} registrado{totalRecords !== 1 ? 's' : ''}
				{:else}
					Administra los clientes del sistema
				{/if}
			</p>
		</div>

		<div class="flex gap-3">
			<Button
				variant="secondary"
				size="md"
				on:click={descargarExcel}
				disabled={cargandoClientes || clientes.length === 0}
			>
				<Download class="w-4 h-4" />
				Descargar Excel
			</Button>

			<Button
				variant="primary"
				size="md"
				on:click={() => {
					modoEdicion = false;
					clienteEditando = null;
					limpiarFormulario();
					establecerDefaults();
					showModal = true;
				}}
			>
				<UserPlus class="w-4 h-4" />
				Agregar Cliente
			</Button>
		</div>
	</div>

	<!-- Búsqueda -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
		<div class="relative">
			<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
			<input
				type="text"
				placeholder="Buscar por ID, agente, cliente, RFC, razón social, condiciones de pago o montos..."
				bind:value={search}
				on:input={onSearchChange}
				class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
		</div>
		{#if search}
			<p class="text-sm text-gray-600 mt-2">
				Mostrando {clientes.length} de {totalRecords} clientes (filtrados)
			</p>
		{/if}
	</div>

	<!-- Tabla -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
		{#if cargandoClientes}
			<div class="flex items-center justify-center h-64">
				<div class="flex flex-col items-center space-y-4">
					<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
					<p class="text-gray-600">Cargando clientes...</p>
				</div>
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50 sticky top-0 z-10">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">ID</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Agente</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Cliente</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">RFC</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Razón Social</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Condiciones</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">MXN</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">USD</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Acciones</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each clientes as cliente}
						<tr class="hover:bg-gray-50">
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cliente.id}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{cliente.agente}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cliente.cliente}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{cliente.rfc}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{cliente.razonSocial}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{cliente.condiciones}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
								{cliente.cuentasMXN.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
								{cliente.cuentasUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<div class="flex items-center justify-end gap-2">
									<button
										on:click={() => editarCliente(cliente)}
										class="text-blue-600 hover:text-blue-900 p-1 rounded"
										aria-label="Editar cliente {cliente.cliente}"
									>
										<Edit2 class="w-4 h-4" />
									</button>
									<button
										on:click={() => eliminarCliente(cliente.id)}
										class="text-red-600 hover:text-red-900 p-1 rounded"
										aria-label="Eliminar cliente {cliente.cliente}"
									>
										<Trash2 class="w-4 h-4" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if !cargandoClientes && clientes.length === 0 && totalRecords === 0}
						<tr>
							<td colspan="9" class="text-center py-12">
								<div class="flex flex-col items-center space-y-3">
									<UserPlus class="h-12 w-12 text-gray-300" />
									<p class="font-medium text-gray-900">No hay clientes registrados</p>
									<p class="text-sm text-gray-500">Agrega tu primer cliente haciendo clic en "Agregar Cliente"</p>
								</div>
							</td>
						</tr>
					{:else if !cargandoClientes && clientes.length === 0 && totalRecords > 0}
						<tr>
							<td colspan="9" class="text-center py-12">
								<div class="flex flex-col items-center space-y-3">
									<Search class="h-12 w-12 text-gray-300" />
									<p class="font-medium text-gray-900">No se encontraron resultados</p>
									<p class="text-sm text-gray-500">Intenta con otros términos de búsqueda</p>
								</div>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
			</div>
		{/if}
	</div>

	<!-- Paginación -->
	{#if !cargandoClientes && clientes.length > 0 && totalPages > 1}
		<div>
			<div class="text-sm text-gray-600 text-center mb-4">
				Mostrando {Math.min((currentPage - 1) * pageSize + 1, totalRecords)} - {Math.min(currentPage * pageSize, totalRecords)} de {totalRecords} clientes
				{#if search}(filtrados){/if}
			</div>

			<div class="flex justify-center">
				<!-- Vista móvil -->
				<div class="flex items-center gap-2 md:hidden">
					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(1)}
						disabled={currentPage === 1}
						title="Primera página"
					>
						«
					</Button>
					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(currentPage - 1)}
						disabled={currentPage === 1}
					>
						‹
					</Button>
					<span class="px-3 py-2 text-sm font-medium">{currentPage} / {totalPages}</span>
					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(currentPage + 1)}
						disabled={currentPage === totalPages}
					>
						›
					</Button>
					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(totalPages)}
						disabled={currentPage === totalPages}
						title="Última página"
					>
						»
					</Button>
				</div>

				<!-- Vista desktop -->
				<div class="hidden md:flex items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(1)}
						disabled={currentPage === 1}
					>
						Primera
					</Button>
					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(currentPage - 1)}
						disabled={currentPage === 1}
					>
						Anterior
					</Button>

					{#each Array(Math.min(totalPages, 7)) as _, i}
						{@const pageNumber = Math.max(1, Math.min(totalPages - 6, currentPage - 3)) + i}
						{#if pageNumber <= totalPages}
							<Button
								variant={currentPage === pageNumber ? 'primary' : 'secondary'}
								size="sm"
								on:click={() => cambiarPagina(pageNumber)}
							>
								{pageNumber}
							</Button>
						{/if}
					{/each}

					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(currentPage + 1)}
						disabled={currentPage === totalPages}
					>
						Siguiente
					</Button>
					<Button
						variant="secondary"
						size="sm"
						on:click={() => cambiarPagina(totalPages)}
						disabled={currentPage === totalPages}
					>
						Última
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Modal -->
<Modal
	bind:open={showModal}
	title={modoEdicion ? `Editar Cliente - ${clienteEditando?.cliente || clienteEditando?.razonSocial || 'Sin nombre'}` : 'Agregar Cliente'}
	size="lg"
	on:close={cancelarModal}
>
	<svelte:fragment slot="header-icon">
		<UserPlus class="w-6 h-6 text-blue-600" />
	</svelte:fragment>

	<div class="space-y-6">
		<!-- Datos Fiscales -->
		<div class="border border-gray-200 rounded-lg overflow-hidden">
			<button
				class="w-full flex justify-between items-center px-6 py-4 bg-gray-50 text-left font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
				on:click={() => (fiscalOpen = !fiscalOpen)}
			>
				<span class="text-base">Datos Fiscales</span>
				<span class="text-gray-500">{fiscalOpen ? '▲' : '▼'}</span>
			</button>
			{#if fiscalOpen}
				<div class="p-6 space-y-6 bg-white">
					<!-- Subir PDF -->
					<div
						class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
						role="button"
						tabindex="0"
						on:click={() => pdfInput.click()}
						on:keydown={(e) => e.key === 'Enter' && pdfInput.click()}
					>
						<p class="font-medium">
							Para un llenado rápido, carga la <span class="text-blue-600">Constancia de Situación Fiscal</span>
						</p>
						<p class="text-sm text-gray-500 mt-1">Formatos válidos: PDF</p>
						<input
							type="file"
							accept="application/pdf"
							class="hidden"
							bind:this={pdfInput}
							on:change={handlePDF}
						/>
					</div>

					<!-- Campos -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Input
							id="nombreComercial"
							label="Nombre comercial"
							type="text"
							bind:value={nombreComercial}
							error={errors.nombreComercial}
							required
							on:input={() => validarCampoLocal('nombreComercial', nombreComercial)}
						/>

						<Input
							id="razonSocial"
							label="Razón social"
							type="text"
							bind:value={razonSocial}
							error={errors.razonSocial}
							required
							on:input={() => validarCampoLocal('razonSocial', razonSocial)}
						/>

						<Input
							id="rfc"
							label="RFC"
							type="text"
							bind:value={rfc}
							placeholder="Ej: ABC123456789"
							error={errors.rfc}
							required
							on:input={() => validarCampoLocal('rfc', rfc)}
						/>

						<!-- Regimen -->
						<div>
							<label for="regimen" class="block text-sm font-medium text-gray-700 mb-2">
								Régimen Fiscal <span class="text-red-500">*</span>
							</label>
							<select
								id="regimen"
								bind:value={regimen}
								on:change={() => validarCampoLocal('regimen', regimen)}
								class="w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 {errors.regimen ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
							>
								<option value="">Seleccionar régimen</option>
								{#each regimenes as { ID_Regimen, Codigo, Descripcion }}
									<option value={ID_Regimen.toString()}>
										{Codigo} - {Descripcion}
									</option>
								{/each}
							</select>
							{#if errors.regimen}
								<p class="mt-1 text-sm text-red-600">{errors.regimen}</p>
							{/if}
						</div>

						<!-- Condiciones de pago -->
						<div>
							<label for="condiciones" class="block text-sm font-medium text-gray-700 mb-2">
								Condiciones de pago <span class="text-red-500">*</span>
							</label>
							<select
								id="condiciones"
								bind:value={condicionesPago}
								on:change={() => validarCampoLocal('condicionesPago', condicionesPago)}
								class="w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 {errors.condicionesPago ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
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
								<p class="mt-1 text-sm text-red-600">{errors.condicionesPago}</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Datos de Contacto -->
		<div class="border border-gray-200 rounded-lg overflow-hidden">
			<button
				class="w-full flex justify-between items-center px-6 py-4 bg-gray-50 text-left font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
				on:click={() => (contactoOpen = !contactoOpen)}
			>
				<span class="text-base">Datos de Contacto</span>
				<span class="text-gray-500">{contactoOpen ? '▲' : '▼'}</span>
			</button>
			{#if contactoOpen}
				<div class="p-6 space-y-6 bg-white">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Input
							id="correo"
							label="Correo Principal"
							type="email"
							bind:value={correoPrincipal}
							placeholder="ejemplo@correo.com"
							error={errors.correoPrincipal}
							required
							on:input={() => validarCampoLocal('correoPrincipal', correoPrincipal)}
						/>

						<!-- País -->
						<div>
							<label for="pais" class="block text-sm font-medium text-gray-700 mb-2">
								País <span class="text-red-500">*</span>
							</label>
							<select
								id="pais"
								bind:value={paisSeleccionado}
								on:change={() => { actualizarCodigoLocal(); validarCampoLocal('paisSeleccionado', paisSeleccionado); }}
								class="w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 {errors.paisSeleccionado ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
							>
								<option value={null}>Seleccionar país</option>
								{#each paises as pais}
									<option value={pais.ID}>
										{pais.NombrePais}
									</option>
								{/each}
							</select>
							{#if errors.paisSeleccionado}
								<p class="mt-1 text-sm text-red-600">{errors.paisSeleccionado}</p>
							{/if}
						</div>

						<!-- Código de país -->
						<div>
							<label for="codigoPais" class="block text-sm font-medium text-gray-700 mb-2">
								Código de país
							</label>
							<select
								id="codigoPais"
								bind:value={codigoPais}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							>
								<option value="+52">+52 (México)</option>
								<option value="+1">+1 (Estados Unidos)</option>
							</select>
						</div>

						<Input
							id="telefono"
							label="Teléfono"
							type="text"
							bind:value={telefono}
							placeholder="Ej: 5512345678"
							error={errors.telefono}
							required
							on:input={(e) => {
								const target = e.target as HTMLInputElement;
								const soloNumeros = target.value.replace(/\D/g, '');
								telefono = soloNumeros.slice(0, 10);
								validarCampoLocal('telefono', telefono);
							}}
						/>

						<!-- Estado -->
						<div>
							<label for="estado" class="block text-sm font-medium text-gray-700 mb-2">
								Estado <span class="text-red-500">*</span>
							</label>
							<select
								id="estado"
								bind:value={estadoSeleccionado}
								on:change={() => validarCampoLocal('estadoSeleccionado', estadoSeleccionado)}
								disabled={!paisSeleccionado || estados.length === 0}
								class="w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500 {errors.estadoSeleccionado ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
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
								<p class="mt-1 text-sm text-red-600">{errors.estadoSeleccionado}</p>
							{/if}
						</div>

						<Input
							id="calle"
							label="Calle"
							type="text"
							bind:value={calle}
							placeholder="Ej: Av. Insurgentes Sur"
							error={errors.calle}
							required
							on:input={() => validarCampoLocal('calle', calle)}
						/>

						<Input
							id="numInterior"
							label="Número interior"
							type="text"
							bind:value={numInterior}
						/>

						<Input
							id="numExterior"
							label="Número exterior"
							type="text"
							bind:value={numExterior}
							placeholder="Ej: 123"
							error={errors.numExterior}
							required
							on:input={(e) => {
								const target = e.target as HTMLInputElement;
								numExterior = target.value.replace(/\D/g, '');
								validarCampoLocal('numExterior', numExterior);
							}}
						/>

						<Input
							id="codigoPostal"
							label="Código Postal"
							type="text"
							bind:value={codigoPostal}
							placeholder="Ej: 06100"
							on:input={(e) => {
								const target = e.target as HTMLInputElement;
								codigoPostal = target.value.replace(/\D/g, '').slice(0, 5);
							}}
						/>

						<Input
							id="colonia"
							label="Colonia"
							type="text"
							bind:value={colonia}
							placeholder="Ej: Roma Norte"
						/>

						<Input
							id="ciudad"
							label="Ciudad"
							type="text"
							bind:value={ciudad}
							placeholder="Ej: Ciudad de México"
						/>
					</div>
				</div>
			{/if}
		</div>

		<!-- Agente de Cobranza -->
		<div class="border border-gray-200 rounded-lg overflow-hidden">
			<button
				class="w-full flex justify-between items-center px-6 py-4 bg-gray-50 text-left font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
				on:click={() => (agenteCobranzaOpen = !agenteCobranzaOpen)}
			>
				<span class="text-base">Agente de Cobranza Asignado</span>
				<span class="text-gray-500">{agenteCobranzaOpen ? '▲' : '▼'}</span>
			</button>

			{#if agenteCobranzaOpen}
				<div class="p-6 bg-white">
					<div>
						<label for="agenteCobranza" class="block text-sm font-medium text-gray-700 mb-2">
							Agente de Cobranza <span class="text-red-500">*</span>
						</label>
						<select
							id="agenteCobranza"
							bind:value={agenteSeleccionado}
							on:change={() => validarCampoLocal('agenteSeleccionado', agenteSeleccionado)}
							class="w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 {errors.agenteSeleccionado ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}"
						>
							<option value={null}>Seleccionar agente</option>
							{#each agentes as agente}
								<option value={agente.value}>
									{agente.text}
								</option>
							{/each}
						</select>
						{#if errors.agenteSeleccionado}
							<p class="mt-1 text-sm text-red-600">{errors.agenteSeleccionado}</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>

	<svelte:fragment slot="footer">
		<div class="flex gap-3 justify-end">
			<Button
				variant="secondary"
				size="md"
				on:click={cancelarModal}
			>
				Cancelar
			</Button>
			<Button
				variant={modoEdicion ? 'primary' : 'success'}
				size="md"
				on:click={modoEdicion ? actualizarCliente : agregarCliente}
				disabled={isSubmitting}
				loading={isSubmitting}
			>
				{modoEdicion ? 'Actualizar' : 'Guardar'}
			</Button>
		</div>
	</svelte:fragment>
</Modal>
