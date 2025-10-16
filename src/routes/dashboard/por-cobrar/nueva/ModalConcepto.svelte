<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { X } from 'lucide-svelte';
	import { authFetch } from '$lib/api';

	export let open = false;
	export let concepto: any = null;

	const dispatch = createEventDispatcher();

	// Datos del producto
	let nombre = '';
	let descripcion = '';
	let productoServicio = '';
	let unidadMedida = '';
	let monedaProducto = 'MXN';
	let objetoImpuesto = '01';

	// Búsqueda de productos SAT
	let busquedaProductoSAT = '';
	let productosSATFiltrados: any[] = [];
	let mostrarListaProductosSAT = false;
	let cargandoProductosSAT = false;

	// Tarifas
	let totalConImpuestos = 0; // Total final con IVA incluido (lo que ingresa el usuario)
	let impuestos: Array<{ tipo: string; tasa: number; monto: number }> = [];
	let nuevoImpuestoTipo = '';

	// Switch para desglosar impuestos
	let desglosarImpuestos = false;

	// Opciones - Catálogo SAT de unidades de medida
	const unidadesMedida = [
		{ value: 'H87', label: 'H87 - Pieza' },
		{ value: 'EA', label: 'EA - Elemento' },
		{ value: 'E48', label: 'E48 - Unidad de servicio' },
		{ value: 'ACT', label: 'ACT - Actividad' },
		{ value: 'KGM', label: 'KGM - Kilogramo' },
		{ value: 'E51', label: 'E51 - Trabajo' },
		{ value: 'A9', label: 'A9 - Tarifa' },
		{ value: 'MTR', label: 'MTR - Metro' },
		{ value: 'AB', label: 'AB - Paquete a granel' },
		{ value: 'BB', label: 'BB - Caja base' },
		{ value: 'KT', label: 'KT - KIT' },
		{ value: 'SET', label: 'SET - Conjunto' },
		{ value: 'LTR', label: 'LTR - Litro' },
		{ value: 'XBX', label: 'XBX - Caja' },
		{ value: 'MON', label: 'MON - Mes' },
		{ value: 'HUR', label: 'HUR - Hora' },
		{ value: 'MTK', label: 'MTK - Metro Cuadrado' },
		{ value: '11', label: '11 - Equipos' },
		{ value: 'MGM', label: 'MGM - Miligramo' },
		{ value: 'XPK', label: 'XPK - Paquete' },
		{ value: 'XKI', label: 'XKI - Kit (Conjunto de piezas)' },
		{ value: 'AS', label: 'AS - Variedad' },
		{ value: 'GRM', label: 'GRM - Gramo' },
		{ value: 'PR', label: 'PR - Par' },
		{ value: 'DPC', label: 'DPC - Docenas de piezas' },
		{ value: 'XUN', label: 'XUN - Unidad' },
		{ value: 'DAY', label: 'DAY - Día' },
		{ value: 'XLT', label: 'XLT - Lote' },
		{ value: '10', label: '10 - Grupos' },
		{ value: 'MLT', label: 'MLT - Mililitro' },
		{ value: 'E54', label: 'E54 - Viaje' }
	];

	const objetosImpuesto = [
		{ value: '01', label: '01 - No objeto de impuesto' },
		{ value: '02', label: '02 - Sí objeto de impuesto' },
		{ value: '03', label: '03 - Sí objeto del impuesto y no obligado al desglose' }
	];

	const tiposImpuesto = [
		// IVA (Traslado) - Estos son impuestos que se cobran al cliente
		{ value: 'IVA 0%', tasa: 0, label: 'IVA 0%' },
		{ value: 'IVA 16%', tasa: 0.16, label: 'IVA 16%' },
		{ value: 'IVA 8%', tasa: 0.08, label: 'IVA 8%' },
		{ value: 'IVA Exento 0%', tasa: 0, label: 'IVA Exento 0%' },
		// ISR Retenido - El ISR es SIEMPRE una retención que se hace al proveedor
		{ value: 'ISR Retenido 1.25%', tasa: 0.0125, label: 'ISR Retenido 1.25%' },
		{ value: 'ISR Retenido 2%', tasa: 0.02, label: 'ISR Retenido 2%' },
		{ value: 'ISR Retenido 10%', tasa: 0.10, label: 'ISR Retenido 10%' },
		{ value: 'ISR Retenido 10.666%', tasa: 0.10666, label: 'ISR Retenido 10.666%' },
		{ value: 'ISR Retenido 20%', tasa: 0.20, label: 'ISR Retenido 20%' },
		// IVA Retenido - Retención que se hace al proveedor
		{ value: 'IVA Retenido 0%', tasa: 0, label: 'IVA Retenido 0%' },
		{ value: 'IVA Retenido 0.2%', tasa: 0.002, label: 'IVA Retenido 0.2%' },
		{ value: 'IVA Retenido 0.5%', tasa: 0.005, label: 'IVA Retenido 0.5%' },
		{ value: 'IVA Retenido 0.7%', tasa: 0.007, label: 'IVA Retenido 0.7%' },
		{ value: 'IVA Retenido 10%', tasa: 0.10, label: 'IVA Retenido 10%' },
		{ value: 'IVA Retenido 10.6%', tasa: 0.106, label: 'IVA Retenido 10.6%' },
		{ value: 'IVA Retenido 10.66%', tasa: 0.1066, label: 'IVA Retenido 10.66%' },
		{ value: 'IVA Retenido 10.6666%', tasa: 0.106666, label: 'IVA Retenido 10.6666%' },
		{ value: 'IVA Retenido 10.6667%', tasa: 0.106667, label: 'IVA Retenido 10.6667%' },
		{ value: 'IVA Retenido 10.6668%', tasa: 0.106668, label: 'IVA Retenido 10.6668%' },
		{ value: 'IVA Retenido 10.67%', tasa: 0.1067, label: 'IVA Retenido 10.67%' },
		{ value: 'IVA Retenido 16%', tasa: 0.16, label: 'IVA Retenido 16%' },
		{ value: 'IVA Retenido 2%', tasa: 0.02, label: 'IVA Retenido 2%' },
		{ value: 'IVA Retenido 2.5%', tasa: 0.025, label: 'IVA Retenido 2.5%' },
		{ value: 'IVA Retenido 4%', tasa: 0.04, label: 'IVA Retenido 4%' },
		{ value: 'IVA Retenido 5%', tasa: 0.05, label: 'IVA Retenido 5%' },
		{ value: 'IVA Retenido 5.333%', tasa: 0.05333, label: 'IVA Retenido 5.333%' },
		{ value: 'IVA Retenido 6%', tasa: 0.06, label: 'IVA Retenido 6%' },
		{ value: 'IVA Retenido 8%', tasa: 0.08, label: 'IVA Retenido 8%' },
		// IEPS (solo tasas válidas según catálogo SAT)
		{ value: 'IEPS 0%', tasa: 0, label: 'IEPS 0%' },
		{ value: 'IEPS 3%', tasa: 0.03, label: 'IEPS 3%' },
		{ value: 'IEPS 6%', tasa: 0.06, label: 'IEPS 6%' },
		{ value: 'IEPS 7%', tasa: 0.07, label: 'IEPS 7%' },
		{ value: 'IEPS 8%', tasa: 0.08, label: 'IEPS 8%' },
		{ value: 'IEPS 9%', tasa: 0.09, label: 'IEPS 9%' },
		{ value: 'IEPS 25%', tasa: 0.25, label: 'IEPS 25%' },
		{ value: 'IEPS 26.5%', tasa: 0.265, label: 'IEPS 26.5%' },
		{ value: 'IEPS 30%', tasa: 0.3, label: 'IEPS 30%' },
		{ value: 'IEPS 30.4%', tasa: 0.304, label: 'IEPS 30.4%' },
		{ value: 'IEPS 50%', tasa: 0.5, label: 'IEPS 50%' },
		{ value: 'IEPS 53%', tasa: 0.53, label: 'IEPS 53%' },
		{ value: 'IEPS 160%', tasa: 1.6, label: 'IEPS 160%' },
		{ value: 'IEPS 5.333%', tasa: 0.05333, label: 'IEPS 5.333%' },
		{ value: 'IEPS 8%', tasa: 0.08, label: 'IEPS 8%' }
	];

	// Claves de productos/servicios SAT más comunes
	const clavesSAT = [
		// Honorarios Profesionales
		{ value: '84111506', label: '84111506 - Servicios de consultoría de negocios y administración corporativa' },
		{ value: '84111505', label: '84111505 - Servicios de apoyo administrativo' },
		{ value: '84111507', label: '84111507 - Servicios de contabilidad' },
		{ value: '84111508', label: '84111508 - Servicios jurídicos' },
		{ value: '84111510', label: '84111510 - Servicios de auditoría' },
		{ value: '84111511', label: '84111511 - Servicios de administración de proyectos' },
		// Servicios de TI
		{ value: '81112200', label: '81112200 - Servicios de asesoría y consultoría en informática' },
		{ value: '72151500', label: '72151500 - Servicios de desarrollo de software' },
		{ value: '81161700', label: '81161700 - Servicios de diseño de páginas web' },
		{ value: '81112100', label: '81112100 - Servicios de consultoría en sistemas' },
		// Capacitación y Publicidad
		{ value: '78101800', label: '78101800 - Servicios de capacitación' },
		{ value: '80141600', label: '80141600 - Servicios de publicidad' },
		{ value: '80101500', label: '80101500 - Servicios de diseño gráfico' },
		// Productos
		{ value: '43231500', label: '43231500 - Equipo de cómputo' },
		{ value: '43211500', label: '43211500 - Computadoras' },
		{ value: '44101500', label: '44101500 - Muebles de oficina' },
		// Otros Servicios
		{ value: '93151500', label: '93151500 - Servicios de limpieza' },
		{ value: '76111500', label: '76111500 - Servicios de mantenimiento' },
		{ value: '50202200', label: '50202200 - Alimentos preparados' },
		{ value: '78111800', label: '78111800 - Arrendamiento de bienes inmuebles' }
	];

	// Calcular tasa total de impuestos
	$: tasaTotal = impuestos.reduce((sum, imp) => sum + imp.tasa, 0);

	// Calcular subtotal (sin IVA) según fórmula del SAT México:
	// Subtotal = Total / (1 + tasa_total)
	$: subtotal = tasaTotal > 0 ? totalConImpuestos / (1 + tasaTotal) : totalConImpuestos;

	// Calcular precio unitario sin IVA
	$: precioUnitario = subtotal;

	// Recalcular montos de impuestos sobre el subtotal (sin IVA)
	$: impuestosRecalculados = impuestos.map(imp => ({
		...imp,
		monto: subtotal * imp.tasa
	}));

	$: totalImpuestos = impuestosRecalculados.reduce((sum, imp) => sum + imp.monto, 0);
	$: total = subtotal + totalImpuestos;

	function agregarImpuesto() {
		if (!nuevoImpuestoTipo) return;

		const impuestoSeleccionado = tiposImpuesto.find((i) => i.value === nuevoImpuestoTipo);
		if (!impuestoSeleccionado) return;

		// Verificar si el impuesto ya existe
		if (impuestos.some(imp => imp.tipo === impuestoSeleccionado.label)) {
			alert('Este impuesto ya ha sido agregado');
			return;
		}

		// El monto se calculará automáticamente en impuestosRecalculados
		impuestos = [
			...impuestos,
			{
				tipo: impuestoSeleccionado.label,
				tasa: impuestoSeleccionado.tasa,
				monto: 0 // Se recalculará automáticamente
			}
		];

		nuevoImpuestoTipo = '';
	}

	function eliminarImpuesto(index: number) {
		impuestos = impuestos.filter((_, i) => i !== index);
	}

	let guardando = false;

	async function guardar() {
		if (guardando) return;
		guardando = true;

		if (!nombre || nombre.trim() === '') {
			alert('El nombre del concepto es requerido');
			guardando = false;
			return;
		}

		if (!productoServicio || productoServicio.trim() === '') {
			alert('Debe seleccionar una clave de producto/servicio SAT de la lista.\n\nNo se permite escribir directamente, debe buscar y seleccionar de las opciones.');
			guardando = false;
			return;
		}

		// Validar que sea una clave válida (8 dígitos)
		if (!/^\d{8}$/.test(productoServicio)) {
			alert('La clave de producto/servicio debe tener 8 dígitos.\n\nPor favor, seleccione una opción válida de la lista.');
			guardando = false;
			return;
		}

		if (!unidadMedida) {
			alert('La unidad de medida es requerida');
			guardando = false;
			return;
		}

		if (!totalConImpuestos || totalConImpuestos <= 0) {
			alert('El total debe ser mayor a 0');
			guardando = false;
			return;
		}

		const nuevoConcepto = {
			id: concepto?.id || crypto.randomUUID(),
			nombre,
			descripcion,
			productoServicio,
			unidadMedida,
			monedaProducto,
			objetoImpuesto,
			precioUnitario,
			cantidad: concepto?.cantidad || 1,
			impuestos: [...impuestosRecalculados],
			subtotal,
			totalImpuestos,
			total
		};

		dispatch('guardar', nuevoConcepto);

		// Esperar un momento antes de cerrar
		setTimeout(() => {
			cerrar();
			guardando = false;
		}, 100);
	}

	function cerrar() {
		limpiarFormulario();
		dispatch('cerrar');
	}

	function limpiarFormulario() {
		nombre = '';
		descripcion = '';
		productoServicio = '';
		busquedaProductoSAT = '';
		productosSATFiltrados = [];
		mostrarListaProductosSAT = false;
		unidadMedida = '';
		monedaProducto = 'MXN';
		objetoImpuesto = '01';
		totalConImpuestos = 0;
		impuestos = [];
		nuevoImpuestoTipo = '';
		desglosarImpuestos = false;
	}

	// Cargar datos si estamos editando
	let ultimoConceptoCargado: any = null;

	$: if (open && concepto && concepto !== ultimoConceptoCargado) {
		nombre = concepto.nombre || '';
		descripcion = concepto.descripcion || '';
		productoServicio = concepto.productoServicio || '';
		busquedaProductoSAT = concepto.productoServicio || '';
		unidadMedida = concepto.unidadMedida || '';
		monedaProducto = concepto.monedaProducto || 'MXN';
		objetoImpuesto = concepto.objetoImpuesto || '01';
		totalConImpuestos = concepto.total || 0;
		impuestos = concepto.impuestos ? [...concepto.impuestos] : [];
		ultimoConceptoCargado = concepto;
	}

	// Limpiar cuando se cierra el modal
	$: if (!open) {
		ultimoConceptoCargado = null;
	}

	// Función para buscar productos SAT desde Facturapi
	let timeoutBusqueda: any = null;
	async function buscarProductosSAT() {
		if (!busquedaProductoSAT.trim()) {
			productosSATFiltrados = [];
			mostrarListaProductosSAT = false;
			return;
		}

		// Debounce: Esperar 300ms después de que el usuario deje de escribir
		clearTimeout(timeoutBusqueda);
		timeoutBusqueda = setTimeout(async () => {
			cargandoProductosSAT = true;
			try {
				// Obtener organizacionId desde sessionStorage
				const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
				const organizacionId = userData.organizacionId;

				if (!organizacionId) {
					console.error('No se encontró organizacionId');
					return;
				}

				const response = await authFetch(`/api/catalogs/productos-sat?q=${encodeURIComponent(busquedaProductoSAT)}&limit=20&organizacionId=${organizacionId}`);
				if (response.ok) {
					const data = await response.json();
					productosSATFiltrados = data.data || [];
					mostrarListaProductosSAT = true;
				}
			} catch (error) {
				console.error('Error al buscar productos SAT:', error);
			} finally {
				cargandoProductosSAT = false;
			}
		}, 300);
	}

	function seleccionarProductoSAT(producto: any) {
		productoServicio = producto.key;
		busquedaProductoSAT = `${producto.key} - ${producto.description}`;
		mostrarListaProductosSAT = false;
	}

	// Validar que el usuario no intente pegar o escribir directamente
	function validarInputProductoSAT() {
		// Si el usuario borra todo, limpiar también productoServicio
		if (!busquedaProductoSAT.trim()) {
			productoServicio = '';
			return;
		}

		// Si el texto no coincide con el formato "XXXXXXXX - descripción", limpiar productoServicio
		const regex = /^\d{8}\s-\s/;
		if (!regex.test(busquedaProductoSAT)) {
			// El usuario está escribiendo, limpiar productoServicio para forzar selección
			productoServicio = '';
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
				<h2 class="text-xl font-semibold text-gray-900">Agregar concepto</h2>
				<div class="flex items-center gap-3">
					<button
						on:click={guardar}
						class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
					>
						GUARDAR
					</button>
					<button
						on:click={cerrar}
						class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
					>
						<X class="w-5 h-5 text-gray-500" />
					</button>
				</div>
			</div>

			<!-- Body -->
			<div class="p-6 space-y-6">
				<!-- Datos del producto -->
				<div>
					<button
						class="w-full flex items-center justify-between text-left mb-4"
						on:click={() => {}}
					>
						<h3 class="text-lg font-semibold text-blue-600">Datos del producto</h3>
						<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					<div class="space-y-4">
						<div>
							<label for="nombre-concepto" class="block text-sm text-gray-600 mb-1"
								>Nombre del concepto</label
							>
							<input
								id="nombre-concepto"
								type="text"
								bind:value={nombre}
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							/>
						</div>

						<div>
							<label for="descripcion-concepto" class="block text-sm text-gray-600 mb-1"
								>Descripción del concepto</label
							>
							<textarea
								id="descripcion-concepto"
								bind:value={descripcion}
								rows="2"
								class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							></textarea>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="producto-servicio" class="block text-sm text-gray-600 mb-1"
									>Clave producto/servicio SAT
									{#if productoServicio}
										<span class="text-green-600 text-xs ml-2">✓ Seleccionado</span>
									{:else}
										<span class="text-red-600 text-xs ml-2">* Requerido</span>
									{/if}
								</label>
								<div class="relative">
									<input
										id="producto-servicio"
										type="text"
										bind:value={busquedaProductoSAT}
										on:input={() => {
											validarInputProductoSAT();
											buscarProductosSAT();
										}}
										on:focus={buscarProductosSAT}
										on:blur={validarInputProductoSAT}
										placeholder="Buscar por clave o descripción..."
										class="w-full px-4 py-2 border {productoServicio ? 'border-green-500 bg-green-50' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									/>
									{#if cargandoProductosSAT}
										<div class="absolute right-3 top-1/2 -translate-y-1/2">
											<svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
										</div>
									{/if}
									{#if mostrarListaProductosSAT && productosSATFiltrados.length > 0}
										<div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
											{#each productosSATFiltrados as producto}
												<button
													type="button"
													on:click={() => seleccionarProductoSAT(producto)}
													class="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
												>
													<div class="font-medium text-gray-900 text-sm">
														{producto.key}
													</div>
													<div class="text-xs text-gray-500 mt-1">
														{producto.description}
													</div>
												</button>
											{/each}
										</div>
									{/if}
								</div>
								<p class="text-xs mt-1 {productoServicio ? 'text-green-600' : 'text-amber-600'}">
									{#if productoServicio}
										✓ Clave válida seleccionada: {productoServicio}
									{:else}
										⚠️ Busque y SELECCIONE de la lista. No escriba directamente.
									{/if}
								</p>
							</div>

							<div>
								<label for="unidad-medida" class="block text-sm text-gray-600 mb-1"
									>Unidad de medida</label
								>
								<select
									id="unidad-medida"
									bind:value={unidadMedida}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								>
									<option value="">Seleccionar...</option>
									{#each unidadesMedida as unidad}
										<option value={unidad.value}>{unidad.label}</option>
									{/each}
								</select>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="moneda-producto" class="block text-sm text-gray-600 mb-1">Moneda</label>
								<select
									id="moneda-producto"
									bind:value={monedaProducto}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								>
									<option value="MXN">MXN - Peso mexicano</option>
									<option value="USD">USD - Dólar americano</option>
									<option value="EUR">EUR - Euro</option>
								</select>
							</div>

							<div>
								<label for="objeto-impuesto" class="block text-sm text-gray-600 mb-1"
									>Objeto de impuesto</label
								>
								<select
									id="objeto-impuesto"
									bind:value={objetoImpuesto}
									class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								>
									{#each objetosImpuesto as objeto}
										<option value={objeto.value}>{objeto.label}</option>
									{/each}
								</select>
							</div>
						</div>
					</div>
				</div>

				<!-- Tarifas del producto -->
				<div>
					<button
						class="w-full flex items-center justify-between text-left mb-4"
						on:click={() => {}}
					>
						<h3 class="text-lg font-semibold text-blue-600">Tarifas del producto</h3>
						<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					<div class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="total-con-impuestos" class="block text-sm text-gray-600 mb-1"
									>Total (con impuestos incluidos)</label
								>
								<div class="relative">
									<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
									<input
										id="total-con-impuestos"
										type="number"
										step="0.01"
										bind:value={totalConImpuestos}
										class="w-full pl-8 pr-16 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									/>
									<span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
										>{monedaProducto}</span
									>
								</div>
							</div>

							<div>
								<label for="agregar-impuesto" class="block text-sm text-gray-600 mb-1"
									>Agregar Impuesto</label
								>
								<div class="flex gap-2">
									<select
										id="agregar-impuesto"
										bind:value={nuevoImpuestoTipo}
										disabled={objetoImpuesto === '01'}
										size="1"
										class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed overflow-y-auto"
										style="height: 42px;"
									>
										<option value="">Seleccionar...</option>
										{#each tiposImpuesto as impuesto}
											<option value={impuesto.value}>{impuesto.label}</option>
										{/each}
									</select>
									<button
										on:click={agregarImpuesto}
										disabled={!nuevoImpuestoTipo || objetoImpuesto === '01'}
										class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
									>
										+
									</button>
								</div>
								{#if objetoImpuesto === '01'}
									<p class="text-xs text-blue-600 mt-1">No incluye impuestos</p>
								{/if}
							</div>
						</div>

						<!-- Lista de impuestos agregados -->
						{#if impuestos.length > 0}
							<div class="space-y-2">
								<p class="text-sm font-medium text-gray-700">Impuestos</p>
								<div class="grid grid-cols-3 gap-2 text-xs font-medium text-gray-600 px-2">
									<span>Impuestos</span>
									<span>Valor</span>
									<span>Monto</span>
								</div>
								{#each impuestosRecalculados as impuesto, index}
									<div
										class="grid grid-cols-3 gap-2 items-center bg-gray-50 p-2 rounded-lg text-sm"
									>
										<span class="text-blue-600">{impuesto.tipo}</span>
										<span>{(impuesto.tasa * 100).toFixed(0)}%</span>
										<div class="flex items-center justify-between">
											<span>${impuesto.monto.toFixed(2)} {monedaProducto}</span>
											<button
												on:click={() => eliminarImpuesto(index)}
												class="text-red-600 hover:text-red-800"
											>
												<X class="w-4 h-4" />
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Resumen de costo -->
						<div class="border-t border-gray-200 pt-4">
							<p class="text-sm font-semibold text-gray-700 mb-3">COSTO TOTAL DEL PRODUCTO</p>
							<div class="space-y-2">
								<div class="flex justify-between text-sm">
									<span class="text-gray-600">Subtotal</span>
									<span class="font-medium"
										>${(subtotal || 0).toFixed(2)}
										{monedaProducto}</span
									>
								</div>
								{#if impuestosRecalculados.length > 0}
									{#each impuestosRecalculados as impuesto}
										<div class="flex justify-between text-sm">
											<span class="text-gray-600">{impuesto.tipo}</span>
											<span class="font-medium"
												>${(impuesto.monto || 0).toFixed(2)}
												{monedaProducto}</span
											>
										</div>
									{/each}
								{/if}
								<div class="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
									<span>Total</span>
									<span>${(total || 0).toFixed(2)} {monedaProducto}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
