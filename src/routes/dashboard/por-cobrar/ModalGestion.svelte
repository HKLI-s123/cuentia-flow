<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Clock, Phone, Mail, MessageSquare, FileText, Calendar, DollarSign } from 'lucide-svelte';
  import type { Factura, DatosGestion } from './types';
  import { TIPOS_GESTION, RESULTADOS_GESTION } from './types';
  import { formatearMoneda, validarDatosGestion, obtenerFechaProximaGestion } from './utils';

  export let factura: Factura | null = null;
  export let abierto = false;

  const dispatch = createEventDispatcher();

  // Estado del formulario
  let formData: DatosGestion = {
    facturaId: 0,
    tipoGestion: '',
    resultado: '',
    descripcion: '',
    fechaGestion: new Date().toISOString().split('T')[0],
    fechaProximaGestion: '',
    promesaPagoFecha: '',
    promesaPagoMonto: 0,
    requiereSeguimiento: false
  };

  let errores: string[] = [];
  let cargando = false;

  // Mapeo de iconos para tipos de gestión
  const iconosGestion: Record<string, any> = {
    'llamada': Phone,
    'email': Mail,
    'whatsapp': MessageSquare,
    'visita': FileText,
    'carta': FileText
  };

  // Resetear formulario cuando se abra el modal
  $: if (abierto && factura) {
    formData = {
      facturaId: factura.id,
      tipoGestion: '',
      resultado: '',
      descripcion: '',
      fechaGestion: new Date().toISOString().split('T')[0],
      fechaProximaGestion: '',
      promesaPagoFecha: '',
      promesaPagoMonto: 0,
      requiereSeguimiento: false
    };
    errores = [];
  }

  // Actualizar fecha de próxima gestión según el resultado
  $: if (formData.resultado) {
    const fechaSugerida = obtenerFechaProximaGestion(formData.resultado);
    if (fechaSugerida) {
      formData.fechaProximaGestion = fechaSugerida.toISOString().split('T')[0];
      formData.requiereSeguimiento = true;
    } else {
      formData.fechaProximaGestion = '';
      formData.requiereSeguimiento = false;
    }
  }

  function cerrarModal() {
    dispatch('cerrar');
  }

  function aplicarMontoCompleto() {
    if (factura) {
      formData.promesaPagoMonto = factura.saldoPendiente || 0;
    }
  }

  async function guardarGestion() {
    if (!factura) return;

    // Validar datos
    const validacion = validarDatosGestion(formData);
    if (!validacion.valido) {
      errores = validacion.errores;
      return;
    }

    cargando = true;
    errores = [];

    try {
      // Aquí irá la llamada al API
      // Simular llamada API
      await new Promise(resolve => setTimeout(resolve, 1000));

      dispatch('gestionGuardada', {
        ...formData,
        factura
      });

      cerrarModal();
    } catch (error) {
      errores = ['Error al registrar la gestión. Intente nuevamente.'];
    } finally {
      cargando = false;
    }
  }

  // Obtener icono del tipo de gestión seleccionado
  $: IconoGestion = formData.tipoGestion ? iconosGestion[formData.tipoGestion] || Clock : Clock;

  // Mostrar campos de promesa de pago
  $: mostrarPromesaPago = formData.resultado === 'promesa_pago' || formData.resultado === 'acuerdo_pago';
</script>

{#if abierto && factura}
  <!-- Overlay -->
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <!-- Modal -->
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-blue-100 rounded-lg">
            <svelte:component this={IconoGestion} class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Nueva Gestión de Cobranza</h2>
            <p class="text-sm text-gray-600">Factura: {factura.numero_factura}</p>
          </div>
        </div>
        <button
          on:click={cerrarModal}
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Información de la factura -->
      <div class="p-6 bg-gray-50">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-gray-600">Cliente:</span>
            <p class="font-medium text-gray-900">{factura.cliente?.razonSocial || 'N/A'}</p>
          </div>
          <div>
            <span class="text-gray-600">Saldo Pendiente:</span>
            <p class="font-bold text-red-600">{formatearMoneda(factura.saldoPendiente || 0)}</p>
          </div>
          <div>
            <span class="text-gray-600">Días Vencida:</span>
            <p class="font-medium {(factura.diasVencido || 0) > 0 ? 'text-red-600' : 'text-green-600'}">
              {(factura.diasVencido || 0) > 0 ? `${factura.diasVencido} días` : 'Al corriente'}
            </p>
          </div>
          <div>
            <span class="text-gray-600">Última Gestión:</span>
            <p class="font-medium text-gray-900">
              {factura.ultimaGestion ? new Date(factura.ultimaGestion).toLocaleDateString('es-MX') : 'Nunca'}
            </p>
          </div>
        </div>
      </div>

      <!-- Formulario -->
      <div class="p-6 space-y-4">
        <!-- Errores -->
        {#if errores.length > 0}
          <div class="bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="flex items-start">
              <div class="text-red-600 text-sm">
                <ul class="list-disc list-inside space-y-1">
                  {#each errores as error}
                    <li>{error}</li>
                  {/each}
                </ul>
              </div>
            </div>
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Tipo de gestión -->
          <div>
            <label for="tipoGestion" class="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Gestión *
            </label>
            <select
              id="tipoGestion"
              bind:value={formData.tipoGestion}
              class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={cargando}
            >
              <option value="">Seleccione un tipo</option>
              {#each TIPOS_GESTION as tipo}
                <option value={tipo.value}>{tipo.label}</option>
              {/each}
            </select>
          </div>

          <!-- Fecha de gestión -->
          <div>
            <label for="fechaGestion" class="block text-sm font-medium text-gray-700 mb-2">
              Fecha de Gestión *
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar class="w-4 h-4 text-gray-400" />
              </div>
              <input
                id="fechaGestion"
                type="date"
                bind:value={formData.fechaGestion}
                max={new Date().toISOString().split('T')[0]}
                class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={cargando}
              />
            </div>
          </div>
        </div>

        <!-- Resultado de la gestión -->
        <div>
          <label for="resultado" class="block text-sm font-medium text-gray-700 mb-2">
            Resultado de la Gestión
          </label>
          <select
            id="resultado"
            bind:value={formData.resultado}
            class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={cargando}
          >
            <option value="">Seleccione un resultado</option>
            {#each RESULTADOS_GESTION as resultado}
              <option value={resultado.value}>{resultado.label}</option>
            {/each}
          </select>
        </div>

        <!-- Descripción -->
        <div>
          <label for="descripcion" class="block text-sm font-medium text-gray-700 mb-2">
            Descripción de la Gestión *
          </label>
          <textarea
            id="descripcion"
            rows="4"
            bind:value={formData.descripcion}
            class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Describa detalladamente lo ocurrido en la gestión..."
            disabled={cargando}
          ></textarea>
        </div>

        <!-- Campos de promesa de pago (condicionales) -->
        {#if mostrarPromesaPago}
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
            <h3 class="text-sm font-medium text-yellow-800 flex items-center">
              <DollarSign class="w-4 h-4 mr-1" />
              Promesa de Pago
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Fecha de promesa -->
              <div>
                <label for="promesaPagoFecha" class="block text-sm font-medium text-gray-700 mb-2">
                  Fecha Comprometida
                </label>
                <input
                  id="promesaPagoFecha"
                  type="date"
                  bind:value={formData.promesaPagoFecha}
                  min={new Date().toISOString().split('T')[0]}
                  class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={cargando}
                />
              </div>

              <!-- Monto de promesa -->
              <div>
                <label for="promesaPagoMonto" class="block text-sm font-medium text-gray-700 mb-2">
                  Monto Comprometido
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign class="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    id="promesaPagoMonto"
                    type="number"
                    step="0.01"
                    min="0"
                    max={factura.saldoPendiente || 0}
                    bind:value={formData.promesaPagoMonto}
                    class="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    disabled={cargando}
                  />
                  <button
                    type="button"
                    on:click={aplicarMontoCompleto}
                    class="absolute inset-y-0 right-0 px-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    disabled={cargando}
                  >
                    Total
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Seguimiento -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <h3 class="text-sm font-medium text-blue-800 flex items-center">
            <Clock class="w-4 h-4 mr-1" />
            Seguimiento
          </h3>

          <!-- Requiere seguimiento -->
          <div class="flex items-center">
            <input
              id="requiereSeguimiento"
              type="checkbox"
              bind:checked={formData.requiereSeguimiento}
              class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={cargando}
            />
            <label for="requiereSeguimiento" class="ml-2 text-sm text-gray-700">
              Requiere seguimiento
            </label>
          </div>

          <!-- Fecha de próxima gestión -->
          {#if formData.requiereSeguimiento}
            <div>
              <label for="fechaProximaGestion" class="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Próxima Gestión
              </label>
              <input
                id="fechaProximaGestion"
                type="date"
                bind:value={formData.fechaProximaGestion}
                min={new Date().toISOString().split('T')[0]}
                class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={cargando}
              />
            </div>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <button
          type="button"
          on:click={cerrarModal}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          disabled={cargando}
        >
          Cancelar
        </button>
        <button
          type="button"
          on:click={guardarGestion}
          class="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
          disabled={cargando}
        >
          {#if cargando}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Guardando...
          {:else}
            <Clock class="w-4 h-4 mr-1" />
            Registrar Gestión
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}