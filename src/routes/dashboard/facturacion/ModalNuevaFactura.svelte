<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Save, AlertCircle, FileText } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { hoyLocal } from '$lib/utils/date';

  export let abierto = false;

  const dispatch = createEventDispatcher();

  // Datos del formulario
  let formulario = {
    clienteId: '',
    numeroFactura: '',
    serie: '',
    folio: '',

    // Montos
    subtotal: '',
    iva: '',
    montoTotal: '',
    tasaIva: 16, // Default: 16%

    // Fechas
    fechaEmision: '',
    fechaVencimiento: '',

    // Datos SAT
    formaPagoId: 1, // Default: Efectivo
    metodoPagoId: 1, // Default: PUE
    usoCfdiId: 1, // Default: G03 - Gastos en general


    // Estados
    estadoId: 1, // Default: pendiente
    prioridadId: 2, // Default: media
    observaciones: ''
  };

  // Estado del formulario
  let guardando = false;
  let error = '';
  let clientes: any[] = [];
  let clienteSeleccionado: any = null;

  // Errores específicos por campo
  let erroresFormulario = {
    clienteId: '',
    subtotal: '',
    montoTotal: '',
    fechaVencimiento: ''
  };

  // Estados y prioridades
  let estados = [
    { id: 1, codigo: 'pendiente', nombre: 'Pendiente' },
    { id: 2, codigo: 'parcial', nombre: 'Pago Parcial' },
    { id: 3, codigo: 'pagada', nombre: 'Pagada' },
    { id: 4, codigo: 'vencida', nombre: 'Vencida' },
    { id: 5, codigo: 'incobrable', nombre: 'Incobrable' }
  ];

  let prioridades = [
    { id: 1, codigo: 'alta', nombre: 'Alta' },
    { id: 2, codigo: 'media', nombre: 'Media' },
    { id: 3, codigo: 'baja', nombre: 'Baja' }
  ];

  // Catálogos SAT
  let formasPago = [
    { id: 1, codigo: '01', descripcion: 'Efectivo' },
    { id: 2, codigo: '02', descripcion: 'Cheque nominativo' },
    { id: 3, codigo: '03', descripcion: 'Transferencia electrónica de fondos' },
    { id: 4, codigo: '04', descripcion: 'Tarjeta de crédito' },
    { id: 5, codigo: '28', descripcion: 'Tarjeta de débito' },
    { id: 6, codigo: '99', descripcion: 'Por definir' }
  ];

  let metodosPago = [
    { id: 1, codigo: 'PUE', descripcion: 'Pago en una sola exhibición' },
    { id: 2, codigo: 'PPD', descripcion: 'Pago en parcialidades o diferido' }
  ];

  let usosCfdi = [
    { id: 1, codigo: 'G01', descripcion: 'Adquisición de mercancías' },
    { id: 2, codigo: 'G02', descripcion: 'Devoluciones, descuentos o bonificaciones' },
    { id: 3, codigo: 'G03', descripcion: 'Gastos en general' },
    { id: 4, codigo: 'I01', descripcion: 'Construcciones' },
    { id: 5, codigo: 'I02', descripcion: 'Mobiliario y equipo de oficina por inversiones' },
    { id: 6, codigo: 'I03', descripcion: 'Equipo de transporte' },
    { id: 7, codigo: 'I04', descripcion: 'Equipo de computo y accesorios' },
    { id: 8, codigo: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios' },
    { id: 9, codigo: 'D02', descripcion: 'Gastos médicos por incapacidad o discapacidad' },
    { id: 10, codigo: 'D03', descripcion: 'Gastos funerales' },
    { id: 11, codigo: 'D04', descripcion: 'Donativos' },
    { id: 12, codigo: 'D07', descripcion: 'Primas por seguros de gastos médicos' },
    { id: 13, codigo: 'D08', descripcion: 'Gastos de transportación escolar obligatoria' },
    { id: 14, codigo: 'D10', descripcion: 'Pagos por servicios educativos (colegiaturas)' },
    { id: 15, codigo: 'S01', descripcion: 'Sin efectos fiscales' },
    { id: 16, codigo: 'CP01', descripcion: 'Pagos' },
    { id: 17, codigo: 'CN01', descripcion: 'Nómina' }
  ];

  
  // Función para cerrar modal
  function cerrar() {
    abierto = false;
    dispatch('cerrar');
    limpiarFormulario();
  }

  function limpiarFormulario() {
    formulario = {
      clienteId: '',
      numeroFactura: '',
      serie: '',
      folio: '',

      // Montos
      subtotal: '',
      iva: '',
      montoTotal: '',
      tasaIva: 16, // Default: 16%

      // Fechas
      fechaEmision: '',
      fechaVencimiento: '',

      // Datos SAT
      formaPagoId: 1, // Default: Efectivo
      metodoPagoId: 1, // Default: PUE
      usoCfdiId: 3, // Default: G03 - Gastos en general


      // Estados
      estadoId: 1, // Default: pendiente
      prioridadId: 2, // Default: media
      observaciones: ''
    };
    clienteSeleccionado = null;
    error = '';
    guardando = false;
    erroresFormulario = {
      clienteId: '',
      subtotal: '',
      montoTotal: '',
      fechaVencimiento: ''
    };
  }

  // Cargar clientes cuando se abre el modal
  async function cargarClientes() {
    try {
      // Obtener organizacionId del usuario logueado
      let organizacionId = null;
      if (typeof window !== 'undefined') {
        try {
          const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
          organizacionId = userData.organizacionId;
        } catch (error) {
        }
      }

      // Si no tenemos organizacionId, intentar obtenerlo del API
      if (!organizacionId) {
        try {
          const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
          if (userData.id) {
            const orgResponse = await authFetch(`/api/usuario/${userData.id}/organizacion`);
            if (orgResponse.ok) {
              const orgData = await orgResponse.json();
              organizacionId = orgData.organizacionId;
              // Actualizar sessionStorage con el organizacionId
              userData.organizacionId = organizacionId;
              sessionStorage.setItem('userData', JSON.stringify(userData));
            }
          }
        } catch (error) {
        }
      }

      if (!organizacionId) {
        error = 'No se pudo cargar la información de la organización';
        return;
      }

      const response = await authFetch(`/api/clientes?all=true&organizacionId=${organizacionId}`);
      const data = await response.json();

      if (data.clientes) {
        clientes = data.clientes;
      } else {
        error = data.error || 'Error cargando clientes';
      }
    } catch (err) {
      error = 'Error al cargar los clientes';
    }
  }

  // Seleccionar cliente
  function seleccionarCliente() {
    if (clienteSeleccionado) {
      formulario.clienteId = clienteSeleccionado.id.toString();
    }
  }

  // Calcular IVA y total automáticamente
  function calcularMontos() {
    const subtotalNum = parseFloat(formulario.subtotal) || 0;
    const tasaIva = formulario.tasaIva / 100; // Convertir porcentaje a decimal

    const ivaCalculado = subtotalNum * tasaIva;
    const totalCalculado = subtotalNum + ivaCalculado;

    formulario.iva = ivaCalculado.toFixed(2);
    formulario.montoTotal = totalCalculado.toFixed(2);
  }

  // Función para calcular fecha de vencimiento (15 días después de emisión)
  function calcularFechaVencimiento() {
    if (formulario.fechaEmision) {
      const fechaEmision = new Date(formulario.fechaEmision);
      fechaEmision.setDate(fechaEmision.getDate() + 15);
      formulario.fechaVencimiento = fechaEmision.toISOString().split('T')[0];
    }
  }

  // Función para enfocar un campo específico
  function enfocarCampo(campoId: string) {
    setTimeout(() => {
      const campo = document.getElementById(campoId);
      if (campo) {
        campo.focus();
        if (campo.tagName === 'SELECT') {
          campo.click();
        }
      }
    }, 100);
  }

  // Validar formulario con errores específicos
  function validarFormulario(): boolean {
    // Limpiar errores previos
    erroresFormulario = {
      clienteId: '',
      subtotal: '',
      montoTotal: '',
      fechaVencimiento: ''
    };
    error = '';

    let hayErrores = false;
    let primerCampoConError = '';

    // Validar cliente
    if (!formulario.clienteId) {
      erroresFormulario.clienteId = 'Debe seleccionar un cliente';
      hayErrores = true;
      if (!primerCampoConError) primerCampoConError = 'cliente-select';
    }

    // Validar subtotal
    if (!formulario.subtotal || parseFloat(formulario.subtotal) <= 0) {
      erroresFormulario.subtotal = 'El subtotal debe ser mayor a 0';
      hayErrores = true;
      if (!primerCampoConError) primerCampoConError = 'subtotal';
    }

    // Validar monto total
    if (!formulario.montoTotal || parseFloat(formulario.montoTotal) <= 0) {
      erroresFormulario.montoTotal = 'El monto total debe ser mayor a 0';
      hayErrores = true;
      if (!primerCampoConError) primerCampoConError = 'monto-total';
    }

    // Validar fecha de vencimiento
    if (!formulario.fechaVencimiento) {
      erroresFormulario.fechaVencimiento = 'La fecha de vencimiento es requerida';
      hayErrores = true;
      if (!primerCampoConError) primerCampoConError = 'fecha-vencimiento';
    }

    // Si hay errores, enfocar el primer campo con error
    if (hayErrores && primerCampoConError) {
      enfocarCampo(primerCampoConError);
    }

    return !hayErrores;
  }

  // Guardar factura
  async function guardarFactura() {
    if (!validarFormulario()) {
      return;
    }

    guardando = true;
    error = '';

    try {
      const datosParaEnviar = {
        clienteId: parseInt(formulario.clienteId),
        numeroFactura: formulario.numeroFactura || undefined,
        montoTotal: parseFloat(formulario.montoTotal),
        fechaEmision: formulario.fechaEmision || hoyLocal(),
        fechaVencimiento: formulario.fechaVencimiento,
        estadoId: formulario.estadoId,
        prioridadId: formulario.prioridadId,
        observaciones: formulario.observaciones || null
      };

      const response = await authFetch('/api/facturas', {
        method: 'POST',
        body: JSON.stringify(datosParaEnviar)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        dispatch('facturaCreada', { factura: result.factura });
        cerrar();
      } else {
        error = result.error || 'Error al crear la factura';
      }
    } catch (err) {
      error = 'Error al conectar con el servidor';
    } finally {
      guardando = false;
    }
  }

  // Cargar clientes cuando se abre el modal
  $: if (abierto && clientes.length === 0) {
    cargarClientes();
  }

  // Generar fecha de emisión por defecto (hoy) y calcular vencimiento
  $: if (abierto && !formulario.fechaEmision) {
    formulario.fechaEmision = hoyLocal();
    calcularFechaVencimiento();
  }

  // Recalcular montos cuando cambia subtotal o tasa IVA
  $: if (formulario.subtotal || formulario.tasaIva) {
    calcularMontos();
  }

  // Recalcular fecha de vencimiento cuando cambia fecha de emisión
  $: if (formulario.fechaEmision) {
    calcularFechaVencimiento();
  }
</script>

{#if abierto}
  <!-- Overlay -->
  <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <!-- Modal -->
    <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
      <!-- Header mejorado -->
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-blue-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="p-2 bg-blue-600 rounded-lg mr-3">
              <FileText class="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 class="text-xl font-bold text-gray-900">Nueva Factura</h2>
              <p class="text-sm text-gray-600">Crear una nueva factura</p>
            </div>
          </div>
          <button
            on:click={cerrar}
            class="p-2 hover:bg-white/50 rounded-xl transition-colors"
          >
            <X class="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <!-- Contenido -->
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">

        <form on:submit|preventDefault={guardarFactura} class="space-y-8">
          <!-- Información del Cliente -->
          <div class="bg-gray-50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <div class="w-2 h-6 bg-blue-600 rounded mr-3"></div>
              Información del Cliente
            </h3>

            <div>
              <label for="cliente-select" class="block text-sm font-medium text-gray-700 mb-2">
                Cliente *
              </label>
              <select
                id="cliente-select"
                bind:value={clienteSeleccionado}
                on:change={seleccionarCliente}
                class="w-full px-3 py-2 border {erroresFormulario.clienteId ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-lg focus:ring-2"
                required
              >
                <option value={null}>Seleccionar cliente...</option>
                {#each clientes as cliente}
                  <option value={cliente}>
                    {cliente.razonSocial} ({cliente.rfc})
                  </option>
                {/each}
              </select>

              {#if erroresFormulario.clienteId}
                <div class="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle class="w-4 h-4 mr-1" />
                  {erroresFormulario.clienteId}
                </div>
              {/if}

              {#if clienteSeleccionado}
                <div class="mt-2 p-3 bg-gray-50 rounded-lg">
                  <div class="text-sm">
                    <div class="font-medium">{clienteSeleccionado.razonSocial}</div>
                    <div class="text-gray-600">RFC: {clienteSeleccionado.rfc}</div>
                    {#if clienteSeleccionado.cliente && clienteSeleccionado.cliente !== clienteSeleccionado.razonSocial}
                      <div class="text-gray-600">Nombre comercial: {clienteSeleccionado.cliente}</div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Datos del CFDI -->
          <div class="bg-blue-50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <div class="w-2 h-6 bg-blue-600 rounded mr-3"></div>
              Datos del CFDI
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="serie" class="block text-sm font-medium text-gray-700 mb-2">
                  Serie
                </label>
                <input
                  id="serie"
                  type="text"
                  bind:value={formulario.serie}
                  placeholder="A"
                  maxlength="10"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label for="folio" class="block text-sm font-medium text-gray-700 mb-2">
                  Folio
                </label>
                <input
                  id="folio"
                  type="text"
                  bind:value={formulario.folio}
                  placeholder="1001"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <!-- Datos SAT -->
          <div class="bg-orange-50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <div class="w-2 h-6 bg-orange-600 rounded mr-3"></div>
              Configuración SAT
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label for="forma-pago" class="block text-sm font-medium text-gray-700 mb-2">
                  Forma de Pago
                </label>
                <select
                  id="forma-pago"
                  bind:value={formulario.formaPagoId}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {#each formasPago as forma}
                    <option value={forma.id}>{forma.codigo} - {forma.descripcion}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label for="metodo-pago" class="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  id="metodo-pago"
                  bind:value={formulario.metodoPagoId}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {#each metodosPago as metodo}
                    <option value={metodo.id}>{metodo.codigo} - {metodo.descripcion}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label for="uso-cfdi" class="block text-sm font-medium text-gray-700 mb-2">
                  Uso de CFDI
                </label>
                <select
                  id="uso-cfdi"
                  bind:value={formulario.usoCfdiId}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {#each usosCfdi as uso}
                    <option value={uso.id}>{uso.codigo} - {uso.descripcion}</option>
                  {/each}
                </select>
              </div>
            </div>
          </div>

          <!-- Información Fiscal -->
          <div class="bg-green-50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <div class="w-2 h-6 bg-green-600 rounded mr-3"></div>
              Información Fiscal
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label for="subtotal" class="block text-sm font-medium text-gray-700 mb-2">
                  Subtotal *
                </label>
                <input
                  id="subtotal"
                  type="number"
                  step="0.01"
                  min="0.01"
                  bind:value={formulario.subtotal}
                  on:input={calcularMontos}
                  placeholder="0.00"
                  class="w-full px-3 py-2 border {erroresFormulario.subtotal ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-lg focus:ring-2"
                  required
                />
                {#if erroresFormulario.subtotal}
                  <div class="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle class="w-4 h-4 mr-1" />
                    {erroresFormulario.subtotal}
                  </div>
                {/if}
              </div>

              <div>
                <label for="tasa-iva" class="block text-sm font-medium text-gray-700 mb-2">
                  Tasa de IVA
                </label>
                <select
                  id="tasa-iva"
                  bind:value={formulario.tasaIva}
                  on:change={calcularMontos}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={8}>8% IVA</option>
                  <option value={16}>16% IVA</option>
                </select>
              </div>

              <div>
                <label for="iva" class="block text-sm font-medium text-gray-700 mb-2">
                  IVA ({formulario.tasaIva}%)
                </label>
                <input
                  id="iva"
                  type="number"
                  step="0.01"
                  bind:value={formulario.iva}
                  readonly
                  placeholder="0.00"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                />
              </div>
            </div>

            <div class="mt-4">
              <label for="monto-total" class="block text-sm font-medium text-gray-700 mb-2">
                Total *
              </label>
              <input
                id="monto-total"
                type="number"
                step="0.01"
                bind:value={formulario.montoTotal}
                readonly
                placeholder="0.00"
                class="w-full px-3 py-2 border {erroresFormulario.montoTotal ? 'border-red-300' : 'border-gray-300'} rounded-lg bg-gray-50 cursor-not-allowed font-bold text-lg"
              />
              {#if erroresFormulario.montoTotal}
                <div class="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle class="w-4 h-4 mr-1" />
                  {erroresFormulario.montoTotal}
                </div>
              {/if}
            </div>
          </div>

          <!-- Información Adicional -->
          <div class="bg-gray-50 rounded-xl p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <div class="w-2 h-6 bg-gray-600 rounded mr-3"></div>
              Información Adicional
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="fecha-emision" class="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Emisión
                </label>
                <input
                  id="fecha-emision"
                  type="date"
                  bind:value={formulario.fechaEmision}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label for="fecha-vencimiento" class="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Vencimiento *
                </label>
                <input
                  id="fecha-vencimiento"
                  type="date"
                  bind:value={formulario.fechaVencimiento}
                  class="w-full px-3 py-2 border {erroresFormulario.fechaVencimiento ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'} rounded-lg focus:ring-2"
                  required
                />
                {#if erroresFormulario.fechaVencimiento}
                  <div class="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle class="w-4 h-4 mr-1" />
                    {erroresFormulario.fechaVencimiento}
                  </div>
                {/if}
              </div>

              <div>
                <label for="estado" class="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  id="estado"
                  bind:value={formulario.estadoId}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {#each estados as estado}
                    <option value={estado.id}>{estado.nombre}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label for="prioridad" class="block text-sm font-medium text-gray-700 mb-2">
                  Prioridad
                </label>
                <select
                  id="prioridad"
                  bind:value={formulario.prioridadId}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {#each prioridades as prioridad}
                    <option value={prioridad.id}>{prioridad.nombre}</option>
                  {/each}
                </select>
              </div>
            </div>

            <div class="mt-4">
              <label for="observaciones" class="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                id="observaciones"
                bind:value={formulario.observaciones}
                rows="3"
                placeholder="Observaciones adicionales..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>
          </div>

          <!-- Botones al final del formulario -->
          <div class="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 mt-6 border-t border-gray-300">
            <button
              type="button"
              on:click={cerrar}
              disabled={guardando}
              class="w-full sm:w-auto px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-all duration-200 font-semibold text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              on:click={guardarFactura}
              disabled={guardando}
              class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold text-sm shadow-lg hover:shadow-xl"
            >
              <Save class="w-5 h-5 mr-2" />
              {guardando ? 'Creando Factura...' : 'Crear Factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}