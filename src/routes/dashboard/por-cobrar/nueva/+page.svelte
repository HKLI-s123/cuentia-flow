<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authFetch } from '$lib/api';
	import ModalConcepto from './ModalConcepto.svelte';
	import Swal from 'sweetalert2';

	interface Cliente {
		id: number;
		razonSocial: string;
		nombreComercial?: string;
		rfc: string;
		correo?: string;
		telefono?: string;
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
	let fechaEmision = new Date().toISOString().split('T')[0];
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

	// Recurrencia
	let recurrenciaActiva = false;
	let ordenRecurrencia = '';
	let identificadorRecurrencia = '';
	let fechaInicioRecurrencia = new Date().toISOString().split('T')[0];
	let fechaPrimeraFactura = '';
	let periodoRecurrencia = 'mensual';
	let diaRecurrencia = '1';
	let cadaRecurrencia = 'mes';
	let finRecurrencia = 'nunca';
	let fechaFinRecurrencia = '';
	let numeroOcurrencias = 1;

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

	onMount(async () => {
		await cargarClientes();
	});

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
	$: if (moneda && moneda !== 'MXN') {
		obtenerTipoCambio();
	}

	async function guardarFactura() {
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
				clienteId: clienteSeleccionado.id,
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
				montoTotal: totalGeneral
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
					await Swal.fire({
						icon: 'success',
						title: '¡Factura timbrada correctamente!',
						html: `
							<div class="text-left">
								<p class="mb-2"><strong>Folio:</strong> ${result.timbrado.numeroFactura}</p>
								<p class="mb-2"><strong>UUID:</strong> ${result.timbrado.uuid}</p>
								<p class="mt-4 text-sm text-gray-600">La factura ha sido guardada y timbrada exitosamente</p>
							</div>
						`,
						confirmButtonColor: '#3b82f6',
						confirmButtonText: 'Aceptar'
					});
				} else {
					// Factura guardada pero no timbrada
					const fechaActual = new Date().toISOString().split('T')[0];
					const fechaEmisionFactura = new Date(fechaEmision).toISOString().split('T')[0];
					const esMismaFecha = fechaEmisionFactura === fechaActual;

					if (!esMismaFecha) {
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
						await Swal.fire({
							icon: 'error',
							title: 'Falló el timbrado de su factura',
							html: `
								<div class="text-left">
									<p class="mb-2">La factura se guardó correctamente pero hubo un problema al timbrarla.</p>
									<p class="text-sm text-gray-600 mt-4">Puede intentar timbrarla manualmente desde el listado de facturas</p>
								</div>
							`,
							confirmButtonColor: '#3b82f6',
							confirmButtonText: 'Aceptar'
						});
					}
				}

				goto('/dashboard/por-cobrar');
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
		}
	}

	function cancelar() {
		goto('/dashboard/por-cobrar');
	}

	function calcularProximaFactura() {
		if (!fechaPrimeraFactura || !recurrenciaActiva) return '';

		try {
			const fecha = new Date(fechaPrimeraFactura);
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
</script>

<div class="pb-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-3xl font-bold text-gray-900">Nueva Factura</h1>
		<div class="flex gap-3">
			<button
				on:click={cancelar}
				class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
			>
				Cancelar
			</button>
			<button
				on:click={guardarFactura}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
			>
				Guardar Factura
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
					<option value="45-dias">45 días</option>
					<option value="60-dias">60 días</option>
					<option value="90-dias">90 días</option>
				</select>
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
		on:guardar={handleGuardarConcepto}
		on:cerrar={handleCerrarModal}
	/>

	<!-- RECURRENCIA -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<div class="flex items-center justify-between mb-6">
			<h2 class="text-lg font-semibold text-gray-900">RECURRENCIA</h2>
			<label class="flex items-center cursor-pointer">
				<span class="me-3 text-sm font-medium text-gray-900"
					>{recurrenciaActiva ? 'ACTIVADA' : 'DESACTIVADA'}</span
				>
				<input type="checkbox" bind:checked={recurrenciaActiva} class="sr-only peer" />
				<div
					class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
				></div>
			</label>
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
							<button type="button" class="ml-1 text-blue-600 hover:text-blue-700" aria-label="Información sobre identificador">
								<svg
									class="w-4 h-4 inline"
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
							</button>
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
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
					<div>
						<label for="fecha-primera-rec" class="block text-sm text-gray-600 mb-2"
							>Fecha de la primer factura</label
						>
						<input
							id="fecha-primera-rec"
							type="date"
							bind:value={fechaPrimeraFactura}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						/>
					</div>
				</div>

				<!-- Periodo de factura -->
				<div>
					<span class="block text-sm text-gray-600 mb-2">Periodo de factura</span>
					<div class="flex flex-wrap items-center gap-2">
						<select
							bind:value={periodoRecurrencia}
							class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							aria-label="Periodo de factura"
						>
							<option value="semanal">Semanal</option>
							<option value="mensual">Mensual</option>
						</select>
						<span class="text-gray-700">el día</span>
						<select
							bind:value={diaRecurrencia}
							class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							aria-label="Día del periodo"
						>
							{#each Array.from({ length: 28 }, (_, i) => i + 1) as dia}
								<option value={dia.toString()}>{dia}</option>
							{/each}
							<option value="ultimo">Último</option>
						</select>
						<span class="text-gray-700">de cada</span>
						<select
							bind:value={cadaRecurrencia}
							class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							aria-label="Frecuencia"
						>
							<option value="mes">mes</option>
							{#each Array.from({ length: 11 }, (_, i) => i + 2) as meses}
								<option value={`${meses}-meses`}>{meses} meses</option>
							{/each}
						</select>
					</div>
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
						<p class="text-sm text-blue-800">
							Tu próxima factura se enviará el día <strong>{proximaFactura}</strong>
						</p>
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
			placeholder="Notas que aparecerán en la factura..."
			class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		></textarea>
	</div>

	<!-- NOTAS INTERNAS -->
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
		<h2 class="text-lg font-semibold text-gray-900 mb-4">NOTAS INTERNAS</h2>
		<textarea
			bind:value={notasInternas}
			rows="4"
			placeholder="Notas internas que no verá el cliente..."
			class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		></textarea>
	</div>

	<!-- Botones finales -->
	<div class="flex justify-end gap-3">
		<button
			on:click={cancelar}
			class="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
		>
			Cancelar
		</button>
		<button
			on:click={guardarFactura}
			class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
		>
			Guardar Factura
		</button>
	</div>
</div>
