<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authFetch } from '$lib/api';
	import { hoyLocal, fechaLocal } from '$lib/utils/date';
	import ModalConcepto from './ModalConcepto.svelte';
	import Swal from 'sweetalert2';

	interface Cliente {
		id: number;
		razonSocial: string;
		nombreComercial?: string;
		rfc: string;
		correo?: string;
		telefono?: string;
		telefonoWhatsApp?: string;
	}

	interface Concepto {
		id: string;
		nombre: string;
		descripcion?: string;
		productoServicio?: string;
		unidadMedida: string;
		monedaProducto: string;
		objetoImpuesto: string;
		precioUnitario: number;
		cantidad: number;
		impuestos: Array<{ tipo: string; tasa: number; monto: number }>;
		subtotal: number;
		totalImpuestos: number;
		total: number;
	}

	let clientes: Cliente[] = [];
	let clientesFiltrados: Cliente[] = [];
	let busquedaCliente = '';
	let clienteSeleccionado: Cliente | null = null;
	let mostrarListaClientes = false;

	// Datos de factura
	let fechaEmision = hoyLocal();
	let metodoPago = 'PPD'; // PUE o PPD según SAT (default: PPD)
	let formaPago = '99'; // Forma de pago según SAT
	let usoCfdi = 'G03'; // Uso CFDI según SAT (default: G03 - Gastos en general)
	let condicionesPago = '';
	let ordenCompra = '';
	let moneda = 'MXN';
	let tipoCambio = '1.00';
	let identificador = '';

	// Conceptos
	let conceptos: Concepto[] = [];
	let modalConceptoAbierto = false;
	let conceptoEditando: Concepto | null = null;
	let desglosarImpuestos = false;

	// Búsqueda de conceptos guardados
	let busquedaConceptoGuardado = '';
	let conceptosGuardados: any[] = [];
	let mostrarListaConceptosGuardados = false;
	let cargandoConceptosGuardados = false;
	let timeoutBusquedaConceptos: any = null;

	// Recurrencia
	let recurrenciaActiva = false;
	let ordenRecurrencia = '';
	let identificadorRecurrencia = '';
	let fechaInicioRecurrencia = '';
	let fechaPrimeraFactura = '';
	let periodoRecurrencia = 'mensual';
	let diaRecurrencia = '1';
	let cadaRecurrencia = '1';
	let finRecurrencia = 'nunca';
	let fechaFinRecurrencia = '';
	let numeroOcurrencias = 1;

	// Detectar si la fecha de emisión es distinta a hoy
	const hoyStr = hoyLocal();
	$: fechaEmisionEsFutura = fechaEmision !== hoyStr;

	// Preseleccionar fechas de recurrencia basadas en fecha de emisión
	$: if (fechaEmision && recurrenciaActiva) {
		// Si la fecha de emisión es distinta a hoy, forzar fecha de primera factura = fecha de emisión
		if (fechaEmisionEsFutura) {
			fechaPrimeraFactura = fechaEmision;
		}

		// Si no se ha seleccionado fecha de inicio, preseleccionar 1 mes después
		if (!fechaInicioRecurrencia) {
			const fecha = new Date(fechaEmision);
			fecha.setMonth(fecha.getMonth() + 1);
			fechaInicioRecurrencia = fecha.toISOString().split('T')[0];
		}
		
		// Si no se ha seleccionado fecha de primera factura, preseleccionar = fecha de emisión
		if (!fechaPrimeraFactura) {
			fechaPrimeraFactura = fechaEmision;
		}
	}

	// Si la fecha de inicio de recurrencia es anterior a la fecha de primera factura, corregirla
	$: if (fechaInicioRecurrencia && fechaPrimeraFactura && fechaInicioRecurrencia < fechaPrimeraFactura) {
		fechaInicioRecurrencia = fechaPrimeraFactura;
	}

	// Calcular fecha de próxima factura
	$: proximaFactura = calcularProximaFactura();

	// Formatear fechas para mostrar
	$: fechaInicioFormateada = formatearFecha(fechaInicioRecurrencia);
	$: fechaPrimeraFormateada = formatearFecha(fechaPrimeraFactura);

	function formatearFecha(fecha: string): string {
		if (!fecha) return '';
		try {
			const date = new Date(fecha + 'T00:00:00');
			const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
			const dia = date.getDate();
			const mes = meses[date.getMonth()];
			const año = date.getFullYear();
			return `${dia.toString().padStart(2, '0')} / ${mes} / ${año}`;
		} catch {
			return '';
		}
	}

	function abrirSelectorFecha(inputId: string) {
		const input = document.getElementById(inputId) as HTMLInputElement;
		if (input) {
			input.showPicker?.();
		}
	}

	// Notas
	let notasCliente = '';
	let notasInternas = '';

	// Opciones de envío
	let enviarPorCorreo = true;
	let enviarPorWhatsApp = false;

	// Agente IA Cobranza
	let agenteIAActivo = false;

	// Protección contra doble-envío
	let guardandoFactura = false;

	// Estado de WhatsApp de la organización
	let whatsappOrgConfigurado = false;
	let whatsappOrgTelefono = '';
	let verificandoWhatsApp = true;
	let whatsappBannerDismissed = false;

	// Verificar si el banner fue descartado previamente
	function checkWhatsAppBannerDismissed() {
		const orgId = sessionStorage.getItem('organizacionActualId');
		if (orgId) {
			whatsappBannerDismissed = localStorage.getItem(`wa_banner_dismissed_${orgId}`) === 'true';
		}
	}

	function dismissWhatsAppBanner() {
		const orgId = sessionStorage.getItem('organizacionActualId');
		if (orgId) {
			localStorage.setItem(`wa_banner_dismissed_${orgId}`, 'true');
		}
		whatsappBannerDismissed = true;
	}

	// Computed: WhatsApp habilitado solo si org tiene sesión activa Y cliente tiene teléfono
	$: whatsappHabilitado = whatsappOrgConfigurado && !!clienteSeleccionado?.telefonoWhatsApp;
	$: whatsappMotivoDeshabilitado = !whatsappOrgConfigurado
		? 'La organización no tiene WhatsApp conectado'
		: !clienteSeleccionado
			? 'Selecciona un cliente primero'
			: !clienteSeleccionado.telefonoWhatsApp
				? 'El cliente no tiene número de WhatsApp registrado'
				: '';

	// Plan de la organización (para restricciones de funciones)
	let planOrganizacion = 'free';
	let recurrenciaPermitida = false;

	// Si se deshabilita WhatsApp, desmarcar el check
	$: if (!whatsappHabilitado && enviarPorWhatsApp) {
		enviarPorWhatsApp = false;
	}

	// Si el plan no permite recurrencia, desactivarla
	$: if (!recurrenciaPermitida && recurrenciaActiva) {
		recurrenciaActiva = false;
	}

	// Si es PUE, desactivar recurrencia y agente IA (no aplican)
	$: if (metodoPago === 'PUE') {
		if (recurrenciaActiva) recurrenciaActiva = false;
		if (agenteIAActivo) agenteIAActivo = false;
		// Resetear condiciones de pago si exceden 30 días
		if (['45-dias', '60-dias', '90-dias'].includes(condicionesPago)) {
			condicionesPago = 'contado';
		}
	}

	onMount(async () => {
		checkWhatsAppBannerDismissed();
		await Promise.all([cargarClientes(), verificarWhatsAppOrg(), cargarPlanOrganizacion()]);
	});

	async function cargarPlanOrganizacion() {
		try {
			const response = await authFetch('/api/stripe/subscription');
			if (response.ok) {
				const data = await response.json();
				planOrganizacion = data.plan || 'free';
				if (data.estado === 'canceled' || data.estado === 'unpaid') {
					planOrganizacion = 'free';
				}
			}
		} catch {
			planOrganizacion = 'free';
		}
		recurrenciaPermitida = planOrganizacion !== 'free';
	}

	async function verificarWhatsAppOrg() {
		try {
			const organizacionId = sessionStorage.getItem('organizacionActualId');
			if (!organizacionId) {
				verificandoWhatsApp = false;
				return;
			}

			const response = await authFetch(`/api/whatsapp/status?organizacionId=${organizacionId}`);
			if (response.ok) {
				const data = await response.json();
				whatsappOrgConfigurado = data.configurado === true;
				whatsappOrgTelefono = data.telefono || '';
			} else if (response.status === 403) {
				whatsappOrgConfigurado = false;
			}
		} catch (err) {
			console.error('Error verificando WhatsApp org:', err);
		} finally {
			verificandoWhatsApp = false;
		}
	}

	async function cargarClientes() {
		const organizacionId = sessionStorage.getItem('organizacionActualId');
		if (!organizacionId) return;

		const response = await authFetch(`/api/clientes?organizacionId=${organizacionId}&all=true`);
		if (response.ok) {
			const data = await response.json();
			clientes = data.clientes || [];
			clientesFiltrados = clientes;
		}
	}

	function filtrarClientes() {
		if (!busquedaCliente.trim()) {
			clientesFiltrados = clientes;
			mostrarListaClientes = true;
			return;
		}

		const termino = busquedaCliente.toLowerCase();
		clientesFiltrados = clientes.filter(
			(c) =>
				c.razonSocial?.toLowerCase().includes(termino) ||
				c.nombreComercial?.toLowerCase().includes(termino) ||
				c.rfc?.toLowerCase().includes(termino)
		);
		mostrarListaClientes = true;
	}

	function seleccionarCliente(cliente: Cliente) {
		clienteSeleccionado = cliente;
		busquedaCliente = cliente.nombreComercial || cliente.razonSocial;
		mostrarListaClientes = false;

		// Limpiar búsqueda de conceptos al cambiar de cliente
		busquedaConceptoGuardado = '';
		conceptosGuardados = [];
		mostrarListaConceptosGuardados = false;
	}

	function abrirModalConcepto() {
		conceptoEditando = null;
		modalConceptoAbierto = true;
	}

	function editarConcepto(concepto: Concepto) {
		conceptoEditando = concepto;
		modalConceptoAbierto = true;
	}

	function handleGuardarConcepto(event: CustomEvent) {
		const nuevoConcepto = event.detail;

		// Si estamos editando, reemplazar el concepto existente
		if (conceptoEditando) {
			conceptos = conceptos.map((c) => (c.id === nuevoConcepto.id ? nuevoConcepto : c));
		} else {
			// Si es nuevo, agregarlo con cantidad 1
			conceptos = [...conceptos, { ...nuevoConcepto, cantidad: 1 }];
		}

		conceptoEditando = null;
	}

	function handleCerrarModal() {
		modalConceptoAbierto = false;
		conceptoEditando = null;
	}

	function eliminarConcepto(id: string) {
		conceptos = conceptos.filter((c) => c.id !== id);
	}

	function actualizarCantidad(id: string, cantidad: number) {
		conceptos = conceptos.map((c) => (c.id === id ? { ...c, cantidad } : c));
	}

	// Función para buscar conceptos guardados por cliente
	async function buscarConceptosGuardados() {
		if (!busquedaConceptoGuardado.trim()) {
			conceptosGuardados = [];
			mostrarListaConceptosGuardados = false;
			return;
		}

		// Solo buscar si hay un cliente seleccionado
		if (!clienteSeleccionado?.id) {
			conceptosGuardados = [];
			mostrarListaConceptosGuardados = false;
			return;
		}

		// Debounce: Esperar 300ms después de que el usuario deje de escribir
		clearTimeout(timeoutBusquedaConceptos);
		timeoutBusquedaConceptos = setTimeout(async () => {
			cargandoConceptosGuardados = true;
			try {
				const organizacionId = sessionStorage.getItem('organizacionActualId');
				if (!organizacionId) {
					console.error('No se encontró organizacionId');
					return;
				}

				const response = await authFetch(
					`/api/conceptos?search=${encodeURIComponent(busquedaConceptoGuardado)}&limit=20&organizacionId=${organizacionId}&clienteId=${clienteSeleccionado!.id}`
				);

				if (response.ok) {
					const data = await response.json();
					if (data.success) {
						conceptosGuardados = data.conceptos;
						mostrarListaConceptosGuardados = true;
					}
				}
			} catch (error) {
				console.error('Error al buscar conceptos guardados:', error);
			} finally {
				cargandoConceptosGuardados = false;
			}
		}, 300);
	}

	// Cargar concepto guardado seleccionado
	function cargarConceptoGuardado(conceptoGuardado: any) {
		// Crear nuevo concepto con datos del guardado
		const nuevoConcepto: Concepto = {
			id: crypto.randomUUID(),
			nombre: conceptoGuardado.nombre,
			descripcion: conceptoGuardado.descripcion,
			productoServicio: conceptoGuardado.claveProdServ,
			unidadMedida: conceptoGuardado.unidadMedida,
			monedaProducto: conceptoGuardado.monedaProducto || moneda,
			objetoImpuesto: conceptoGuardado.objetoImpuesto || '02',
			precioUnitario: conceptoGuardado.precioUnitario,
			cantidad: 1,
			impuestos: conceptoGuardado.impuestos || [],
			subtotal: conceptoGuardado.subtotal,
			totalImpuestos: conceptoGuardado.totalImpuestos,
			total: conceptoGuardado.total
		};

		// Agregar a la lista de conceptos
		conceptos = [...conceptos, nuevoConcepto];

		// Limpiar búsqueda
		busquedaConceptoGuardado = '';
		mostrarListaConceptosGuardados = false;
	}

	$: subtotalGeneral = conceptos.reduce((sum, c) => sum + c.subtotal * c.cantidad, 0);
	$: impuestoGeneral = conceptos.reduce((sum, c) => sum + c.totalImpuestos * c.cantidad, 0);
	$: totalGeneral = conceptos.reduce((sum, c) => sum + c.total * c.cantidad, 0);

	async function obtenerTipoCambio() {
		if (moneda === 'MXN') {
			tipoCambio = '1.00';
			return;
		}

		try {
			const response = await authFetch(`/api/tipo-cambio?moneda=${moneda}`);
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					tipoCambio = data.tipoCambio.toFixed(4);
				}
			}
		} catch (error) {
		}
	}

	// Obtener tipo de cambio automáticamente al cambiar moneda
	// Se ejecuta siempre que cambie la moneda (incluyendo cuando cambias a MXN)
	$: if (moneda) {
		obtenerTipoCambio();
	}

	async function guardarFactura() {
		// Protección contra doble-envío
		if (guardandoFactura) return;

		if (!clienteSeleccionado) {
			await Swal.fire({
				icon: 'warning',
				title: 'Cliente requerido',
				text: 'Debe seleccionar un cliente',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		if (conceptos.length === 0) {
			await Swal.fire({
				icon: 'warning',
				title: 'Conceptos requeridos',
				text: 'Debe agregar al menos un concepto',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		// Validar fecha de emisión
		if (!fechaEmision) {
			await Swal.fire({
				icon: 'warning',
				title: 'Fecha requerida',
				text: 'Debe seleccionar una fecha de emisión',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		// Validar que la fecha no sea anterior a 72 horas (margen SAT)
		const fechaSeleccionada = new Date(fechaEmision + 'T12:00:00');
		const hoy = new Date();
		const hace72h = new Date(hoy.getTime() - 72 * 60 * 60 * 1000);
		if (fechaSeleccionada < hace72h) {
			await Swal.fire({
				icon: 'warning',
				title: 'Fecha inválida',
				text: 'La fecha de emisión no puede ser anterior a 72 horas',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}
		// Limitar a 30 días en el futuro solo si la factura se va a timbrar (no programada)
		const esFacturaProgramada = recurrenciaActiva && fechaPrimeraFactura
			&& new Date(fechaPrimeraFactura + 'T12:00:00') > hoy;
		if (!esFacturaProgramada) {
			const en30dias = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
			if (fechaSeleccionada > en30dias) {
				await Swal.fire({
					icon: 'warning',
					title: 'Fecha inválida',
					text: 'La fecha de emisión no puede ser mayor a 30 días en el futuro',
					confirmButtonColor: '#3b82f6'
				});
				return;
			}
		}

		// Validar que todos los conceptos tengan precios y cantidades válidas
		for (const c of conceptos) {
			if (!c.cantidad || c.cantidad < 1) {
				await Swal.fire({
					icon: 'warning',
					title: 'Cantidad inválida',
					text: `El concepto "${c.nombre}" tiene una cantidad inválida`,
					confirmButtonColor: '#3b82f6'
				});
				return;
			}
			if (!c.precioUnitario || c.precioUnitario <= 0) {
				await Swal.fire({
					icon: 'warning',
					title: 'Precio inválido',
					text: `El concepto "${c.nombre}" tiene un precio inválido`,
					confirmButtonColor: '#3b82f6'
				});
				return;
			}
		}

		// Validar total positivo
		if (totalGeneral <= 0) {
			await Swal.fire({
				icon: 'warning',
				title: 'Total inválido',
				text: 'El total de la factura debe ser mayor a $0',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		// Validar tipo de cambio para moneda extranjera
		if (moneda !== 'MXN' && (!tipoCambio || parseFloat(tipoCambio) <= 0)) {
			await Swal.fire({
				icon: 'warning',
				title: 'Tipo de cambio requerido',
				text: 'Debe especificar un tipo de cambio válido para moneda extranjera',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		// Sanitizar campos de texto (eliminar scripts/HTML)
		const sanitizar = (text: string) => text.replace(/<[^>]*>/g, '').trim();
		notasCliente = sanitizar(notasCliente);
		notasInternas = sanitizar(notasInternas);
		if (ordenCompra) ordenCompra = sanitizar(ordenCompra).substring(0, 100);
		if (identificador) identificador = sanitizar(identificador).substring(0, 100);

		guardandoFactura = true;

		// Mostrar loading
		Swal.fire({
			title: 'Guardando factura...',
			html: 'Por favor espere mientras se procesa la factura',
			allowOutsideClick: false,
			allowEscapeKey: false,
			didOpen: () => {
				Swal.showLoading();
			}
		});

		try {
			// Obtener el ID del usuario logueado
			const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
			const usuarioCreadorId = userData.id;

			const payload = {
				clienteId: clienteSeleccionado!.id,
				fechaEmision,
				metodoPago,
				formaPago,
				usoCfdi,
				condicionesPago,
				ordenCompra,
				moneda,
				tipoCambio: parseFloat(tipoCambio),
				identificador,
				usuarioCreadorId,
				conceptos,
				recurrenciaActiva,
				recurrencia: recurrenciaActiva
					? {
							orden: ordenRecurrencia,
							identificador: identificadorRecurrencia,
							inicio: fechaInicioRecurrencia,
							fechaPrimeraFactura,
							periodo: periodoRecurrencia,
							dia: diaRecurrencia,
							cada: cadaRecurrencia,
							fin: finRecurrencia,
							fechaFin: fechaFinRecurrencia,
							ocurrencias: numeroOcurrencias
					  }
					: null,
				notasCliente,
				notasInternas,
				desglosarImpuestos,
				montoTotal: totalGeneral,
				agenteIAActivo,
				enviarPorCorreo,
				enviarPorWhatsApp: enviarPorWhatsApp && whatsappHabilitado
			};

			const response = await authFetch('/api/facturas', {
				method: 'POST',
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (result.success) {
				// Verificar si la factura fue timbrada o no
				if (result.timbrado && result.timbrado.success) {
					// Factura timbrada correctamente
					const facturaId = result.facturaId || result.id;
					const clienteEmail = clienteSeleccionado?.correo;
					const clienteWhatsApp = clienteSeleccionado?.telefonoWhatsApp;

					const debeEnviarCorreo = enviarPorCorreo && !!clienteEmail;
					const debeEnviarWhatsApp = enviarPorWhatsApp && !!clienteWhatsApp && whatsappHabilitado;

					if (debeEnviarCorreo || debeEnviarWhatsApp) {
						// Enviar automáticamente por los canales seleccionados
						const canales: string[] = [];
						if (debeEnviarCorreo) canales.push('correo');
						if (debeEnviarWhatsApp) canales.push('WhatsApp');

						Swal.fire({
							title: 'Enviando factura...',
							html: `Enviando por ${canales.join(' y ')}`,
							allowOutsideClick: false,
							allowEscapeKey: false,
							didOpen: () => { Swal.showLoading(); }
						});

						const resultadosEnvio: string[] = [];
						const erroresEnvio: string[] = [];

						// Enviar por correo
						if (debeEnviarCorreo) {
							try {
								const correoResp = await authFetch(`/api/facturas/${facturaId}/enviar-correo`, { method: 'POST' });
								if (correoResp.status === 403) {
									erroresEnvio.push('Correo no disponible en tu plan actual');
								} else {
									const correoResult = await correoResp.json();
									if (correoResult.success) {
										resultadosEnvio.push(`Correo enviado a ${clienteEmail}`);
									} else {
										erroresEnvio.push(`Error correo: ${correoResult.error || 'Error desconocido'}`);
									}
								}
							} catch {
								erroresEnvio.push('Error al enviar correo');
							}
						}

						// Enviar por WhatsApp
						if (debeEnviarWhatsApp) {
							try {
								const waResp = await authFetch(`/api/facturas/${facturaId}/enviar-whatsapp`, {
									method: 'POST',
									body: JSON.stringify({ incluirPDF: true })
								});
								if (waResp.status === 403) {
									const waErr = await waResp.json();
									erroresEnvio.push(`WhatsApp no disponible en tu plan actual`);
								} else {
									const waResult = await waResp.json();
									if (waResult.success) {
										resultadosEnvio.push(`WhatsApp enviado a ${clienteWhatsApp}`);
									} else {
										erroresEnvio.push(`Error WhatsApp: ${waResult.error || 'Error desconocido'}`);
									}
								}
							} catch {
								erroresEnvio.push('Error al enviar por WhatsApp');
							}
						}

						// Mostrar resultado final
						const hayExitos = resultadosEnvio.length > 0;
						const hayErrores = erroresEnvio.length > 0;

						await Swal.fire({
							icon: hayErrores ? (hayExitos ? 'warning' : 'error') : 'success',
							title: hayErrores
								? (hayExitos ? 'Factura timbrada (envío parcial)' : 'Factura timbrada (error de envío)')
								: '¡Factura timbrada y enviada!',
							html: `
								<div class="text-left">
									<p class="mb-2"><strong>Folio:</strong> ${result.timbrado.numeroFactura}</p>
									<p class="mb-2"><strong>UUID:</strong> ${result.timbrado.uuid}</p>
									${resultadosEnvio.length > 0 ? `
										<div class="mt-3 p-2 bg-green-50 rounded text-sm text-green-700">
											${resultadosEnvio.map(r => `<p class="mb-2">${r}</p>`).join('')}
										</div>
									` : ''}
									${erroresEnvio.length > 0 ? `
										<div class="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
											${erroresEnvio.map(e => `<p>${e}</p>`).join('')}
										</div>
									` : ''}
								</div>
							`,
							confirmButtonColor: '#3b82f6',
							confirmButtonText: 'Aceptar'
						});
					} else {
						// No hay envío seleccionado, solo mostrar éxito de timbrado
						await Swal.fire({
							icon: 'success',
							title: '¡Factura timbrada correctamente!',
							html: `
								<div class="text-left">
									<p class="mb-2"><strong>Folio:</strong> ${result.timbrado.numeroFactura}</p>
									<p class="mb-2"><strong>UUID:</strong> ${result.timbrado.uuid}</p>
									<p class="mt-4 text-sm text-gray-600">La factura ha sido guardada y timbrada exitosamente.</p>
								</div>
							`,
							confirmButtonColor: '#3b82f6',
							confirmButtonText: 'Aceptar'
						});
					}

				} else {
					// Factura guardada pero no timbrada
					const fechaActual = hoyLocal();
					const fechaEmisionFactura = fechaLocal(fechaEmision);
					const esMismaFecha = fechaEmisionFactura === fechaActual;

					// Verificar si se saltó el timbrado por fecha de primera factura de recurrencia
					const saltoPorRecurrencia = recurrenciaActiva && fechaPrimeraFactura
						&& fechaLocal(fechaPrimeraFactura) !== fechaActual;

					if (saltoPorRecurrencia) {
						// La factura se timbrará y enviará el día de la primera factura
						const opcionesEnvio: string[] = [];
						if (enviarPorCorreo) opcionesEnvio.push('correo electrónico');
						if (enviarPorWhatsApp && whatsappHabilitado) opcionesEnvio.push('WhatsApp');
						const textoEnvio = opcionesEnvio.length > 0
							? `<p class="mb-2">Se enviará por <strong>${opcionesEnvio.join(' y ')}</strong></p>`
							: '';

						await Swal.fire({
							icon: 'info',
							title: 'Factura guardada correctamente',
							html: `
								<div class="text-left">
									<p class="mb-2">Su factura ha sido guardada y se timbrará automáticamente el día programado.</p>
									<p class="mb-2"><strong>Fecha de primera factura:</strong> ${formatearFecha(fechaPrimeraFactura)}</p>
									${textoEnvio}
									<p class="text-sm text-gray-600 mt-4">La recurrencia está activa y se generará automáticamente según la configuración establecida.</p>
								</div>
							`,
							confirmButtonColor: '#3b82f6',
							confirmButtonText: 'Aceptar'
						});
					} else if (!esMismaFecha) {
						// La factura se timbrará el día de la fecha de emisión
						await Swal.fire({
							icon: 'info',
							title: 'Factura guardada',
							html: `
								<div class="text-left">
									<p class="mb-2">Su factura ha sido guardada correctamente.</p>
									<p class="mb-2"><strong>Se timbrará automáticamente el día de la fecha de emisión</strong></p>
									<p class="text-sm text-gray-600 mt-4">Fecha de emisión: ${fechaEmision}</p>
								</div>
							`,
							confirmButtonColor: '#3b82f6',
							confirmButtonText: 'Aceptar'
						});
					} else {
						// Falló el timbrado
						const detalleError = result.timbrado?.details;
						const mensajeError = typeof detalleError === 'string'
							? detalleError
							: detalleError?.message || '';
						await Swal.fire({
							icon: 'error',
							title: 'Falló el timbrado de su factura',
							html: `
								<div class="text-left">
									<p class="mb-2">La factura se guardó correctamente pero hubo un problema al timbrarla.</p>
									${mensajeError ? `<div class="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700"><strong>Detalle:</strong> ${mensajeError}</div>` : ''}
									<p class="text-sm text-gray-600 mt-4">Puede intentar timbrarla manualmente desde el listado de facturas</p>
								</div>
							`,
							confirmButtonColor: '#3b82f6',
							confirmButtonText: 'Aceptar'
						});
					}
				}

				goto('/dashboard/facturacion');
			} else {
				await Swal.fire({
					icon: 'error',
					title: 'Error al guardar factura',
					text: result.error || 'Ocurrió un error al guardar la factura',
					confirmButtonColor: '#3b82f6'
				});
			}
		} catch (error) {
			await Swal.fire({
				icon: 'error',
				title: 'Error',
				text: 'Ocurrió un error al guardar la factura',
				confirmButtonColor: '#3b82f6'
			});
		} finally {
			guardandoFactura = false;
		}
	}

	function cancelar() {
		goto('/dashboard/facturacion');
	}

	async function enviarFacturaPorCorreo(facturaId: number, clienteEmail?: string) {
		if (!clienteEmail) {
			await Swal.fire({
				icon: 'warning',
				title: 'Sin correo',
				text: 'El cliente no tiene correo configurado',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		Swal.fire({
			title: 'Enviando...',
			html: 'Enviando factura por correo',
			icon: 'info',
			allowOutsideClick: false,
			didOpen: () => {
				Swal.showLoading();
			}
		});

		try {
			const response = await authFetch(`/api/facturas/${facturaId}/enviar-correo`, {
				method: 'POST'
			});

			const result = await response.json();

			if (response.status === 403) {
				await Swal.fire({
					icon: 'warning',
					title: 'Función no disponible',
					html: `<p>${result.error}</p><p class="mt-2 text-sm text-gray-500">Actualiza tu plan para enviar correos.</p>`,
					confirmButtonText: 'Ver planes',
					showCancelButton: true,
					cancelButtonText: 'Cerrar',
					confirmButtonColor: '#7c3aed'
				}).then((r) => { if (r.isConfirmed) window.location.href = '/dashboard/configuracion'; });
			} else if (result.success) {
				await Swal.fire({
					icon: 'success',
					title: '¡Correo enviado!',
					text: `Correo enviado a: ${clienteEmail}`,
					confirmButtonColor: '#3b82f6'
				});
			} else {
				await Swal.fire({
					icon: 'error',
					title: 'Error',
					text: result.error || 'Error al enviar correo',
					confirmButtonColor: '#3b82f6'
				});
			}
		} catch (error) {
			await Swal.fire({
				icon: 'error',
				title: 'Error',
				text: 'Error al enviar correo',
				confirmButtonColor: '#3b82f6'
			});
		}
	}

	async function enviarFacturaPorWhatsApp(facturaId: number, telefonoWhatsApp?: string) {
		if (!telefonoWhatsApp) {
			await Swal.fire({
				icon: 'warning',
				title: 'Sin WhatsApp',
				text: 'El cliente no tiene teléfono WhatsApp configurado',
				confirmButtonColor: '#3b82f6'
			});
			return;
		}

		Swal.fire({
			title: 'Enviando...',
			html: 'Enviando factura por WhatsApp',
			icon: 'info',
			allowOutsideClick: false,
			didOpen: () => {
				Swal.showLoading();
			}
		});

		try {
			const response = await authFetch(`/api/facturas/${facturaId}/enviar-whatsapp`, {
				method: 'POST',
				body: JSON.stringify({ incluirPDF: true })
			});

			const result = await response.json();

			if (response.status === 403) {
				await Swal.fire({
					icon: 'warning',
					title: 'Función no disponible',
					html: `<p>${result.error}</p><p class="mt-2 text-sm text-gray-500">Actualiza tu plan para usar WhatsApp.</p>`,
					confirmButtonText: 'Ver planes',
					showCancelButton: true,
					cancelButtonText: 'Cerrar',
					confirmButtonColor: '#7c3aed'
				}).then((r) => { if (r.isConfirmed) window.location.href = '/dashboard/configuracion'; });
			} else if (result.success) {
				await Swal.fire({
					icon: 'success',
					title: '¡WhatsApp enviado!',
					text: `Mensaje enviado a: ${telefonoWhatsApp}`,
					confirmButtonColor: '#3b82f6'
				});
			} else {
				await Swal.fire({
					icon: 'error',
					title: 'Error',
					text: result.error || 'Error al enviar por WhatsApp',
					confirmButtonColor: '#3b82f6'
				});
			}
		} catch (error) {
			await Swal.fire({
				icon: 'error',
				title: 'Error',
				text: 'Error al enviar por WhatsApp',
				confirmButtonColor: '#3b82f6'
			});
		}
	}

	function calcularProximaFactura() {
		if (!fechaPrimeraFactura || !recurrenciaActiva) return '';

		try {
			const fecha = new Date(fechaPrimeraFactura + 'T00:00:00');
			const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
			const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

			const diaSemana = diasSemana[fecha.getDay()];
			const dia = fecha.getDate();
			const mes = meses[fecha.getMonth()];
			const año = fecha.getFullYear();

			return `${diaSemana} ${dia.toString().padStart(2, '0')} de ${mes} del ${año}`;
		} catch {
			return '';
		}
	}

	function descripcionPeriodo(): string {
		switch (periodoRecurrencia) {
			case 'diario': return 'diariamente';
			case 'semanal': return 'semanalmente';
			case 'mensual': return 'mensualmente';
			case 'personalizado': {
				const mesesNum = parseInt(cadaRecurrencia);
				return `cada día ${diaRecurrencia} de cada ${mesesNum === 1 ? 'mes' : mesesNum + ' meses'}`;
			}
			default: return '';
		}
	}
</script>

<div class="pb-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold text-gray-900">Nueva Factura</h1>
		<div class="flex gap-3">
			<button
				on:click={cancelar}
				disabled={guardandoFactura}
				class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Cancelar
			</button>
			<button
				on:click={guardarFactura}
				disabled={guardandoFactura}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{guardandoFactura ? 'Procesando...' : 'Guardar Factura'}
			</button>
		</div>
	</div>

	<!-- FACTURAR A -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">FACTURAR A:</h2>
		<div class="relative">
			<input
				type="text"
				bind:value={busquedaCliente}
				on:input={filtrarClientes}
				on:focus={filtrarClientes}
				placeholder="Buscar cliente por nombre, razón social o RFC..."
				class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
			{#if mostrarListaClientes && clientesFiltrados.length > 0}
				<div
					class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
				>
					{#each clientesFiltrados as cliente}
						<button
							type="button"
							on:click={() => seleccionarCliente(cliente)}
							class="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
						>
							<div class="font-medium text-gray-900">
								{cliente.nombreComercial || cliente.razonSocial}
							</div>
							<div class="text-sm text-gray-500">RFC: {cliente.rfc}</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		{#if clienteSeleccionado}
			<div class="mt-4 p-4 bg-blue-50 rounded-lg">
				<div class="font-medium text-gray-900">
					{clienteSeleccionado.nombreComercial || clienteSeleccionado.razonSocial}
				</div>
				<div class="text-sm text-gray-600 mt-1">RFC: {clienteSeleccionado.rfc}</div>
				{#if clienteSeleccionado.correo}
					<div class="text-sm text-gray-600">Email: {clienteSeleccionado.correo}</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- DATOS DE FACTURA -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">DATOS DE FACTURA</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<div>
				<label for="fecha-emision" class="block text-sm font-medium text-gray-700 mb-1"
					>Fecha de emisión</label
				>
				<input
					id="fecha-emision"
					type="date"
					bind:value={fechaEmision}
					on:change={() => { if (recurrenciaActiva) { fechaPrimeraFactura = fechaEmision; } }}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
			<div>
				<label for="metodo-pago" class="block text-sm font-medium text-gray-700 mb-1"
					>Método de pago</label
				>
				<select
					id="metodo-pago"
					bind:value={metodoPago}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="PUE">PUE - Pago en Una sola Exhibición</option>
					<option value="PPD">PPD - Pago en Parcialidades o Diferido</option>
				</select>
				{#if metodoPago === 'PUE'}
					<div class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<p class="text-xs text-amber-800"><strong>PUE</strong> — Una factura PUE (Pago en Una sola Exhibición) se emite únicamente cuando el pago se recibe al momento o dentro del mismo mes de facturación; no requiere ni permite complemento de pago. Si el pago se recibirá después o en parcialidades, usa <strong>PPD</strong> (Pago en Parcialidades o Diferido) y emite un complemento por cada pago.</p>
					</div>
				{/if}
			</div>
			<div>
				<label for="forma-pago" class="block text-sm font-medium text-gray-700 mb-1"
					>Forma de pago</label
				>
				<select
					id="forma-pago"
					bind:value={formaPago}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="01">01 - Efectivo</option>
					<option value="02">02 - Cheque nominativo</option>
					<option value="03">03 - Transferencia electrónica de fondos</option>
					<option value="04">04 - Tarjeta de crédito</option>
					<option value="05">05 - Monedero electrónico</option>
					<option value="06">06 - Dinero electrónico</option>
					<option value="08">08 - Vales de despensa</option>
					<option value="12">12 - Dación en pago</option>
					<option value="13">13 - Pago por subrogación</option>
					<option value="14">14 - Pago por consignación</option>
					<option value="15">15 - Condonación</option>
					<option value="17">17 - Compensación</option>
					<option value="23">23 - Novación</option>
					<option value="24">24 - Confusión</option>
					<option value="25">25 - Remisión de deuda</option>
					<option value="26">26 - Prescripción o caducidad</option>
					<option value="27">27 - A satisfacción del acreedor</option>
					<option value="28">28 - Tarjeta de débito</option>
					<option value="29">29 - Tarjeta de servicios</option>
					<option value="30">30 - Aplicación de anticipos</option>
					<option value="31">31 - Intermediario pagos</option>
					<option value="99">99 - Por definir</option>
				</select>
			</div>
			<div>
				<label for="uso-cfdi" class="block text-sm font-medium text-gray-700 mb-1"
					>Uso CFDI</label
				>
				<select
					id="uso-cfdi"
					bind:value={usoCfdi}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="G01">G01 - Adquisición de mercancías</option>
					<option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
					<option value="G03">G03 - Gastos en general</option>
					<option value="I01">I01 - Construcciones</option>
					<option value="I02">I02 - Mobiliario y equipo de oficina por inversiones</option>
					<option value="I03">I03 - Equipo de transporte</option>
					<option value="I04">I04 - Equipo de computo y accesorios</option>
					<option value="I05">I05 - Dados, troqueles, moldes, matrices y herramental</option>
					<option value="I06">I06 - Comunicaciones telefónicas</option>
					<option value="I07">I07 - Comunicaciones satelitales</option>
					<option value="I08">I08 - Otra maquinaria y equipo</option>
					<option value="D01">D01 - Honorarios médicos, dentales y gastos hospitalarios</option>
					<option value="D02">D02 - Gastos médicos por incapacidad o discapacidad</option>
					<option value="D03">D03 - Gastos funerales</option>
					<option value="D04">D04 - Donativos</option>
					<option value="D05">D05 - Intereses reales efectivamente pagados por créditos hipotecarios</option>
					<option value="D06">D06 - Aportaciones voluntarias al SAR</option>
					<option value="D07">D07 - Primas por seguros de gastos médicos</option>
					<option value="D08">D08 - Gastos de transportación escolar obligatoria</option>
					<option value="D09">D09 - Depósitos en cuentas para el ahorro</option>
					<option value="D10">D10 - Pagos por servicios educativos (colegiaturas)</option>
					<option value="S01">S01 - Sin efectos fiscales</option>
					<option value="CP01">CP01 - Pagos</option>
					<option value="CN01">CN01 - Nómina</option>
				</select>
			</div>
			<div>
				<label for="condiciones-pago" class="block text-sm font-medium text-gray-700 mb-1"
					>Condiciones de pago</label
				>
				<select
					id="condiciones-pago"
					bind:value={condicionesPago}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="">Seleccionar...</option>
					<option value="contado">De Contado</option>
					<option value="7-dias">7 días</option>
					<option value="15-dias">15 días</option>
					<option value="30-dias">30 días</option>
					{#if metodoPago !== 'PUE'}
						<option value="45-dias">45 días</option>
						<option value="60-dias">60 días</option>
						<option value="90-dias">90 días</option>
					{/if}
				</select>
				{#if metodoPago === 'PUE'}
					<p class="text-xs text-amber-600 mt-1">Facturas PUE solo permiten condiciones de pago de hasta 30 días.</p>
				{/if}
			</div>
			<div>
				<label for="orden-compra" class="block text-sm font-medium text-gray-700 mb-1"
					>Orden de compra</label
				>
				<input
					id="orden-compra"
					type="text"
					bind:value={ordenCompra}
					placeholder="Opcional"
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
			<div>
				<label for="moneda" class="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
				<select
					id="moneda"
					bind:value={moneda}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="MXN">MXN - Peso Mexicano</option>
					<option value="USD">USD - Dólar Americano</option>
					<option value="EUR">EUR - Euro</option>
				</select>
			</div>
			<div>
				<label for="tipo-cambio" class="block text-sm font-medium text-gray-700 mb-1"
					>Tipo de cambio</label
				>
				<input
					id="tipo-cambio"
					type="number"
					step="0.01"
					bind:value={tipoCambio}
					disabled={moneda === 'MXN'}
					placeholder={moneda === 'MXN' ? '1.00' : 'Ingrese tipo de cambio'}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
				/>
			</div>
			<div>
				<label for="identificador" class="block text-sm font-medium text-gray-700 mb-1"
					>Identificador</label
				>
				<input
					id="identificador"
					type="text"
					bind:value={identificador}
					placeholder="Opcional"
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
		</div>
	</div>

	<!-- CONCEPTOS -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold text-gray-900">CONCEPTOS</h2>
			<label class="flex items-center gap-2 text-sm text-gray-600">
				<input type="checkbox" bind:checked={desglosarImpuestos} class="rounded" />
				Desglosar impuestos
			</label>
		</div>

		<!-- Búsqueda de Conceptos Guardados -->
		<div class="relative mb-6">
			<input
				type="text"
				placeholder={clienteSeleccionado ? "🔍 Cargar concepto guardado - Busca por nombre, descripción o clave SAT..." : "Selecciona un cliente primero para cargar conceptos guardados"}
				bind:value={busquedaConceptoGuardado}
				on:input={buscarConceptosGuardados}
				on:focus={() => {
					if (conceptosGuardados.length > 0) mostrarListaConceptosGuardados = true;
				}}
				disabled={!clienteSeleccionado}
				class="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {clienteSeleccionado ? 'border-blue-400 bg-blue-50 placeholder-blue-400' : 'border-gray-300 bg-gray-50 placeholder-gray-400 cursor-not-allowed disabled:opacity-60'}"
			/>
			{#if cargandoConceptosGuardados}
				<div class="absolute right-3 top-3.5">
					<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
				</div>
			{/if}

			{#if mostrarListaConceptosGuardados && conceptosGuardados.length > 0}
				<div class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto z-10">
					{#each conceptosGuardados as concepto (concepto.id)}
						<button
							type="button"
							on:click={() => cargarConceptoGuardado(concepto)}
							class="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-200 last:border-b-0 transition-colors"
						>
							<div class="font-semibold text-gray-900">{concepto.nombre}</div>
							<div class="text-sm text-gray-600">{concepto.descripcion}</div>
							<div class="text-xs text-gray-500 mt-1">
								💰 ${parseFloat(concepto.precioUnitario).toFixed(2)} × {concepto.cantidad} = ${parseFloat(concepto.total).toFixed(2)}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tabla de conceptos -->
		{#if conceptos.length > 0}
			<div class="overflow-x-auto mb-4">
				<table class="w-full border-collapse">
					<thead>
						<tr class="border-b-2 border-gray-300">
							<th class="text-left py-3 px-3 text-sm font-semibold text-gray-700">Concepto</th>
							<th class="text-center py-3 px-3 text-sm font-semibold text-gray-700 w-24">Cantidad</th>
							<th class="text-left py-3 px-3 text-sm font-semibold text-gray-700 w-28">Unidad</th>
							<th class="text-right py-3 px-3 text-sm font-semibold text-gray-700 w-32">Precio</th>
							<th class="text-right py-3 px-3 text-sm font-semibold text-gray-700 w-32">Subtotal</th>
							{#if desglosarImpuestos}
								<th class="text-right py-3 px-3 text-sm font-semibold text-gray-700 w-28">Descuento</th>
							{/if}
							<th class="text-right py-3 px-3 text-sm font-semibold text-gray-700 w-28">Impuesto</th>
							<th class="text-right py-3 px-3 text-sm font-semibold text-gray-700 w-32">Total</th>
							<th class="text-center py-3 px-3 text-sm font-semibold text-gray-700 w-20">Editar</th>
							<th class="text-center py-3 px-3 text-sm font-semibold text-gray-700 w-20">Eliminar</th>
						</tr>
					</thead>
					<tbody>
						{#each conceptos as concepto, index (concepto.id)}
							<tr class="border-b border-gray-200 hover:bg-gray-50">
								<td class="py-3 px-3">
									<div class="text-sm font-medium text-gray-900">{index + 1}</div>
								</td>
								<td class="py-3 px-3">
									<input
										type="number"
										value={concepto.cantidad}
										on:input={(e) =>
											actualizarCantidad(concepto.id, parseInt(e.currentTarget.value) || 1)}
										min="1"
										class="w-full text-center px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
									/>
								</td>
								<td class="py-3 px-3 text-sm text-gray-600">{concepto.unidadMedida}</td>
								<td class="py-3 px-3 text-sm text-right text-gray-900">
									${concepto.precioUnitario.toFixed(2)}
								</td>
								<td class="py-3 px-3 text-sm text-right text-gray-900">
									${(concepto.subtotal * concepto.cantidad).toFixed(2)}
								</td>
								{#if desglosarImpuestos}
									<td class="py-3 px-3 text-sm text-right text-gray-600">$0</td>
								{/if}
								<td class="py-3 px-3 text-sm text-right text-gray-900">
									${(concepto.totalImpuestos * concepto.cantidad).toFixed(2)}
								</td>
								<td class="py-3 px-3 text-sm text-right font-medium text-gray-900">
									${(concepto.total * concepto.cantidad).toFixed(2)}
								</td>
								<td class="py-3 px-3 text-center">
									<button
										type="button"
										on:click={() => editarConcepto(concepto)}
										class="text-blue-600 hover:text-blue-800"
										aria-label="Editar concepto"
									>
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
											/>
										</svg>
									</button>
								</td>
								<td class="py-3 px-3 text-center">
									<button
										type="button"
										on:click={() => eliminarConcepto(concepto.id)}
										class="text-red-600 hover:text-red-800"
										aria-label="Eliminar concepto"
									>
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<!-- Input para agregar concepto (similar a la referencia) -->
		<div class="flex items-center gap-2 mb-6">
			<input
				type="text"
				placeholder="Pago"
				readonly
				class="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer"
				on:click={abrirModalConcepto}
			/>
			<button
				type="button"
				on:click={abrirModalConcepto}
				class="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
				aria-label="Agregar concepto"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
			</button>
			<button type="button" class="p-2 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Limpiar">
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Totales -->
		<div class="flex justify-end">
			<div class="w-80 space-y-2">
				<div class="flex justify-between text-sm">
					<span class="text-gray-600">Subtotal:</span>
					<span class="font-medium">${subtotalGeneral.toFixed(2)} {moneda}</span>
				</div>
				<div class="flex justify-between text-sm">
					<span class="text-gray-600">Impuestos:</span>
					<span class="font-medium">${impuestoGeneral.toFixed(2)} {moneda}</span>
				</div>
				<div class="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
					<span>Total:</span>
					<span>${totalGeneral.toFixed(2)} {moneda}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Modal de concepto -->
	<ModalConcepto
		bind:open={modalConceptoAbierto}
		concepto={conceptoEditando}
		monedaFactura={moneda}
		on:guardar={handleGuardarConcepto}
		on:cerrar={handleCerrarModal}
	/>

	<!-- RECURRENCIA -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 {metodoPago === 'PUE' ? 'opacity-50' : ''}">
		<div class="flex items-center justify-between mb-6">
			<h2 class="text-lg font-semibold text-gray-900">RECURRENCIA</h2>
			{#if metodoPago === 'PUE'}
				<span class="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full">No disponible para facturas PUE</span>
			{:else if recurrenciaPermitida}
				<label class="flex items-center cursor-pointer">
					<span class="me-3 text-sm font-medium text-gray-900"
						>{recurrenciaActiva ? 'ACTIVADA' : 'DESACTIVADA'}</span
					>
					<input type="checkbox" bind:checked={recurrenciaActiva} class="sr-only peer" />
					<div
						class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
					></div>
				</label>
			{:else}
				<span class="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Disponible desde plan Básico</span>
			{/if}
		</div>

		{#if recurrenciaActiva}
			<div class="space-y-6">
				<!-- Orden de compra e Identificador -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="orden-rec" class="block text-sm text-gray-600 mb-2"
							>Orden de compra (opcional)</label
						>
						<input
							id="orden-rec"
							type="text"
							bind:value={ordenRecurrencia}
							placeholder=""
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
					<div>
						<label for="identificador-rec" class="block text-sm text-gray-600 mb-2"
							>Identificador (opcional)
							<span class="relative inline-block ml-1 group">
								<svg
									class="w-4 h-4 inline text-blue-600 cursor-help"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span class="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg z-50 pointer-events-none">
									Este identificador se asignará a cada factura generada automáticamente por la recurrencia. Es diferente al identificador de la factura actual.
									<span class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></span>
								</span>
							</span>
						</label>
						<input
							id="identificador-rec"
							type="text"
							bind:value={identificadorRecurrencia}
							placeholder=""
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
				</div>

				<!-- Fechas -->
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="fecha-inicio-rec" class="block text-sm text-gray-600 mb-2"
							>Fecha de inicio</label
						>
						<input
							id="fecha-inicio-rec"
							type="date"
							bind:value={fechaInicioRecurrencia}
							min={fechaPrimeraFactura || fechaEmision}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
						<p class="text-xs text-gray-500 mt-1">
							En esta fecha la factura comenzará a emitirse automáticamente al cliente. No puede ser anterior a la fecha de la primer factura.
						</p>
					</div>
					<div>
						<label for="fecha-primera-rec" class="block text-sm text-gray-600 mb-2"
							>Fecha de la primer factura</label
						>
						<input
							id="fecha-primera-rec"
							type="date"
							bind:value={fechaPrimeraFactura}
							on:change={() => { if (fechaPrimeraFactura && !fechaEmisionEsFutura) fechaEmision = fechaPrimeraFactura; }}
							disabled={fechaEmisionEsFutura}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {fechaEmisionEsFutura ? 'bg-gray-100 cursor-not-allowed' : ''}"
						/>
						{#if fechaEmisionEsFutura}
							<p class="text-xs text-blue-600 mt-1">
								Bloqueada: se usa la fecha de emisión ({fechaEmision}) ya que es distinta al día actual
							</p>
						{:else}
							<p class="text-xs text-gray-500 mt-1">
								La fecha de emisión de esta factura se ajustará automáticamente a la fecha seleccionada
							</p>
						{/if}
					</div>
				</div>

				<!-- Periodo de factura -->
				<div>
					<span class="block text-sm text-gray-600 mb-2">Periodo de factura</span>
					<select
						bind:value={periodoRecurrencia}
						class="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						aria-label="Periodo de factura"
					>
						<option value="diario">Diario</option>
						<option value="semanal">Semanal</option>
						<option value="mensual">Mensual</option>
						<option value="personalizado">Personalizado</option>
					</select>

					{#if periodoRecurrencia === 'personalizado'}
						<div class="mt-3 flex items-center gap-2 flex-wrap">
							<span class="text-sm text-gray-600">Cada día</span>
							<select
								bind:value={diaRecurrencia}
								class="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
								aria-label="Día del mes"
							>
								{#each Array.from({ length: 31 }, (_, i) => i + 1) as d}
									<option value={d.toString()}>{d}</option>
								{/each}
							</select>
							<span class="text-sm text-gray-600">de cada</span>
							<select
								bind:value={cadaRecurrencia}
								class="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
								aria-label="Cada cuántos meses"
							>
								{#each Array.from({ length: 12 }, (_, i) => i + 1) as m}
									<option value={m.toString()}>{m}</option>
								{/each}
							</select>
							<span class="text-sm text-gray-600">{parseInt(cadaRecurrencia) === 1 ? 'mes' : 'meses'}</span>
						</div>
					{/if}
				</div>

				<!-- Finaliza -->
				<div>
					<span class="block text-sm text-gray-600 mb-2">Finaliza</span>
					<select
						bind:value={finRecurrencia}
						class="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						aria-label="Finalización de recurrencia"
					>
						<option value="nunca">Nunca</option>
						<option value="el-dia">El día</option>
						<option value="despues-de">Después de</option>
					</select>

					{#if finRecurrencia === 'el-dia'}
						<div class="mt-3 flex items-center gap-2">
							<span class="text-sm text-gray-600">Finaliza el</span>
							<input
								type="date"
								bind:value={fechaFinRecurrencia}
								class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
							{#if fechaFinRecurrencia}
								<span class="text-xs text-gray-500">({formatearFecha(fechaFinRecurrencia)})</span>
							{/if}
						</div>
					{:else if finRecurrencia === 'despues-de'}
						<div class="mt-3 flex items-center gap-2">
							<span class="text-sm text-gray-600">Después de</span>
							<input
								type="number"
								bind:value={numeroOcurrencias}
								min="1"
								max="999"
								class="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
							/>
							<span class="text-sm text-gray-600">{numeroOcurrencias === 1 ? 'ocurrencia' : 'ocurrencias'}</span>
						</div>
					{/if}
				</div>

				<!-- Envío automático con cada recurrencia -->
				<div class="mt-4 pt-4 border-t border-gray-200">
					<p class="text-sm font-medium text-gray-700 mb-3">Enviar automáticamente cada factura recurrente por:</p>
					<div class="space-y-2">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={enviarPorCorreo}
								class="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
							/>
							<span class="text-sm text-gray-700">Correo electrónico</span>
						</label>
						<div>
							<label class="flex items-center gap-3" class:cursor-pointer={whatsappHabilitado} class:cursor-not-allowed={!whatsappHabilitado}>
								<input
									type="checkbox"
									bind:checked={enviarPorWhatsApp}
									disabled={!whatsappHabilitado}
									class="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
								/>
								<span class="text-sm text-gray-700" class:opacity-50={!whatsappHabilitado}>
									💬 WhatsApp
									{#if whatsappHabilitado && clienteSeleccionado?.telefonoWhatsApp}
										<span class="text-xs text-green-600">({clienteSeleccionado.telefonoWhatsApp})</span>
									{/if}
								</span>
							</label>
							{#if !whatsappHabilitado && !verificandoWhatsApp}
								<p class="text-xs text-amber-600 ml-7 mt-1">{whatsappMotivoDeshabilitado}</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Mensaje informativo -->
				{#if proximaFactura}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
						<svg class="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
								clip-rule="evenodd"
							/>
						</svg>
						<div class="text-sm text-blue-800">
							<p>Tu próxima factura se enviará el día <strong>{proximaFactura}</strong></p>
							{#if descripcionPeriodo()}
								<p class="mt-1">Se repetirá <strong>{descripcionPeriodo()}</strong>{finRecurrencia === 'el-dia' && fechaFinRecurrencia ? ` hasta el ${formatearFecha(fechaFinRecurrencia)}` : finRecurrencia === 'despues-de' ? ` por ${numeroOcurrencias} ${numeroOcurrencias === 1 ? 'ocurrencia' : 'ocurrencias'}` : ''}</p>
							{/if}
							{#if enviarPorCorreo || (enviarPorWhatsApp && whatsappHabilitado)}
								<p class="mt-1">Se enviará por <strong>{[enviarPorCorreo ? 'correo' : '', (enviarPorWhatsApp && whatsappHabilitado) ? 'WhatsApp' : ''].filter(Boolean).join(' y ')}</strong></p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- NOTAS PARA EL CLIENTE -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">NOTAS PARA EL CLIENTE</h2>
		<textarea
			bind:value={notasCliente}
			rows="4"
			maxlength="1000"
			placeholder="Notas que aparecerán en la factura..."
			class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		></textarea>
		<p class="text-xs text-gray-400 text-right mt-1">{notasCliente.length}/1000</p>
	</div>

	<!-- NOTAS INTERNAS -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">NOTAS INTERNAS</h2>
		<textarea
			bind:value={notasInternas}
			rows="4"
			maxlength="1000"
			placeholder="Notas internas que no verá el cliente..."
			class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		></textarea>
		<p class="text-xs text-gray-400 text-right mt-1">{notasInternas.length}/1000</p>
	</div>

	<!-- OPCIONES DE ENVÍO -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">OPCIONES DE ENVÍO</h2>
		<p class="text-sm text-gray-600 mb-4">Selecciona cómo deseas enviar la factura al cliente:</p>
		<div class="space-y-3">
			<label class="flex items-center gap-3 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={enviarPorCorreo}
					class="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
				/>
				<span class="text-gray-700">Enviar por correo electrónico</span>
			</label>
			<div>
				<label class="flex items-center gap-3" class:cursor-pointer={whatsappHabilitado} class:cursor-not-allowed={!whatsappHabilitado}>
					<input
						type="checkbox"
						bind:checked={enviarPorWhatsApp}
						disabled={!whatsappHabilitado}
						class="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
					/>
					<span class="text-gray-700" class:opacity-50={!whatsappHabilitado}>
						💬 Enviar por WhatsApp
						{#if whatsappHabilitado && clienteSeleccionado?.telefonoWhatsApp}
							<span class="text-xs text-green-600">({clienteSeleccionado.telefonoWhatsApp})</span>
						{/if}
					</span>
				</label>
				{#if verificandoWhatsApp}
					<p class="text-xs text-gray-400 ml-7 mt-1">Verificando disponibilidad...</p>
				{:else if !whatsappHabilitado}
					<p class="text-xs text-amber-600 ml-7 mt-1">{whatsappMotivoDeshabilitado}</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- AGENTE IA COBRANZA -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 {metodoPago === 'PUE' ? 'opacity-50' : ''}">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">AGENTE IA COBRANZA</h2>
		{#if metodoPago === 'PUE'}
			<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
				<p class="text-xs text-amber-800">El Agente IA de cobranza no está disponible para facturas PUE ya que el pago se recibe al momento de la facturación.</p>
			</div>
		{:else}
			<p class="text-sm text-gray-600 mb-4">
				Al activar el agente IA, la cobranza de esta factura se gestionará de forma autónoma.
				Si lo desactivas, podrás gestionar la cobranza manualmente desde el detalle de la factura.
			</p>
			<label class="flex items-center gap-3 cursor-pointer">
				<div class="relative inline-flex items-center">
					<input type="checkbox" class="sr-only peer" bind:checked={agenteIAActivo}>
					<div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
				</div>
				<span class="text-gray-700 font-medium {agenteIAActivo ? 'text-blue-600' : ''}">
					{agenteIAActivo ? 'Agente IA Activado' : 'Agente IA Desactivado'}
				</span>
			</label>
			{#if agenteIAActivo}
				<div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
					<p class="text-xs text-blue-700">El agente IA gestionará la cobranza de esta factura de forma autónoma.</p>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Recordatorio WhatsApp -->
	{#if (enviarPorWhatsApp || agenteIAActivo) && !whatsappBannerDismissed}
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
		<!--	<span class="text-2xl flex-shrink-0">💡</span> -->
			<div class="flex-1">
				<h4 class="text-sm font-semibold text-blue-800">Recuerda validar tu conexión de WhatsApp</h4>
				<p class="text-sm text-blue-700 mt-1">
					Para que {agenteIAActivo && enviarPorWhatsApp ? 'el Cobrador IA y el envío por WhatsApp funcionen' : agenteIAActivo ? 'el Cobrador IA funcione' : 'el envío por WhatsApp funcione'} correctamente, accede a
					<a href="/dashboard/configuracion" class="font-medium underline hover:text-blue-900">Configuración → WhatsApp</a>
					y espera 30 segundos para validar tu conexión.
				</p>
			</div>
			<button
				on:click={dismissWhatsAppBanner}
				class="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
			>
				No volver a mostrar
			</button>
		</div>
	{/if}

	<!-- Botones finales -->
	<div class="flex justify-end gap-3">
		<button
			on:click={cancelar}
			disabled={guardandoFactura}
			class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Cancelar
		</button>
		<button
			on:click={guardarFactura}
			disabled={guardandoFactura}
			class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{guardandoFactura ? 'Procesando...' : 'Guardar Factura'}
		</button>
	</div>
</div>
