<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, DollarSign, Calendar, CreditCard, FileText } from 'lucide-svelte';
  import type { Factura, DatosPago } from './types';
  import { METODOS_PAGO } from './types';
  import { formatearMoneda, validarDatosPago } from './utils';
  import { hoyLocal } from '$lib/utils/date';

  export let factura: Factura | null = null;
  export let abierto = false;

  const dispatch = createEventDispatcher();

  // Estado del formulario
  let formData: DatosPago = {
    facturaId: 0,
    monto: 0,
    fechaPago: hoyLocal(),
    metodo: '',
    referencia: '',
    notas: ''
  };

  let errores: string[] = [];
  let cargando = false;

  // Resetear formulario cuando se abra el modal
  $: if (abierto && factura) {
    formData = {
      facturaId: factura.id,
      monto: factura.saldoPendiente || 0,
      fechaPago: hoyLocal(),
      metodo: '',
      referencia: '',
      notas: ''
    };
    errores = [];
  }

  function cerrarModal() {
    dispatch('cerrar');
  }

  function aplicarMontoCompleto() {
    if (factura) {
      formData.monto = factura.saldoPendiente || 0;
    }
  }

  async function guardarPago() {
    if (!factura) return;

    // Validar datos
    const validacion = validarDatosPago(formData);
    if (!validacion.valido) {
      errores = validacion.errores;
      return;
    }

    // Validar que el monto no exceda el saldo
    if (formData.monto > (factura.saldoPendiente || 0)) {
      errores = ['El monto no puede ser mayor al saldo pendiente'];
      return;
    }

    cargando = true;
    errores = [];

    try {
      // Aquí irá la llamada al API
      // Simular llamada API
      await new Promise(resolve => setTimeout(resolve, 1000));

      dispatch('pagoGuardado', {
        ...formData,
        factura
      });

      cerrarModal();
    } catch (error) {
      errores = ['Error al registrar el pago. Intente nuevamente.'];
    } finally {
      cargando = false;
    }
  }

  // Calcular nuevo saldo después del pago
  $: nuevoSaldo = factura ? (factura.saldoPendiente || 0) - formData.monto : 0;
  $: pagoCompleto = nuevoSaldo <= 0;
</script>

{#if abierto && factura}
  <!-- Overlay -->
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <!-- Modal -->
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md my-8 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-green-100 rounded-lg">
            <CreditCard class="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Registrar Pago</h2>
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
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-gray-600">Cliente:</span>
            <p class="font-medium text-gray-900">{factura.cliente?.razonSocial || 'N/A'}</p>
          </div>
          <div>
            <span class="text-gray-600">Monto Total:</span>
            <p class="font-medium text-gray-900">{formatearMoneda(factura.montoTotal)}</p>
          </div>
          <div>
            <span class="text-gray-600">Saldo Pendiente:</span>
            <p class="font-bold text-blue-600">{formatearMoneda(factura.saldoPendiente || 0)}</p>
          </div>
          <div>
            <span class="text-gray-600">Días Vencida:</span>
            <p class="font-medium {(factura.diasVencido || 0) > 0 ? 'text-red-600' : 'text-green-600'}">
              {(factura.diasVencido || 0) > 0 ? `${factura.diasVencido} días` : 'Al corriente'}
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

        <!-- Monto del pago -->
        <div>
          <label for="monto" class="block text-sm font-medium text-gray-700 mb-2">
            Monto del Pago *
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <DollarSign class="w-4 h-4 text-gray-400" />
            </div>
            <input
              id="monto"
              type="number"
              step="0.01"
              min="0"
              max={factura.saldoPendiente || 0}
              bind:value={formData.monto}
              class="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="0.00"
              disabled={cargando}
            />
            <button
              type="button"
              on:click={aplicarMontoCompleto}
              class="absolute inset-y-0 right-0 px-3 text-sm text-green-600 hover:text-green-700 font-medium"
              disabled={cargando}
            >
              Total
            </button>
          </div>
          {#if nuevoSaldo >= 0}
            <p class="text-xs text-gray-500 mt-1">
              Nuevo saldo: <span class="font-medium">{formatearMoneda(nuevoSaldo)}</span>
              {#if pagoCompleto}
                <span class="text-green-600 font-medium ml-1">✓ Pago completo</span>
              {/if}
            </p>
          {/if}
        </div>

        <!-- Fecha del pago -->
        <div>
          <label for="fechaPago" class="block text-sm font-medium text-gray-700 mb-2">
            Fecha del Pago *
          </label>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar class="w-4 h-4 text-gray-400" />
            </div>
            <input
              id="fechaPago"
              type="date"
              bind:value={formData.fechaPago}
              max={hoyLocal()}
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              disabled={cargando}
            />
          </div>
        </div>

        <!-- Método de pago -->
        <div>
          <label for="metodo" class="block text-sm font-medium text-gray-700 mb-2">
            Método de Pago *
          </label>
          <select
            id="metodo"
            bind:value={formData.metodo}
            class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            disabled={cargando}
          >
            <option value="">Seleccione un método</option>
            {#each METODOS_PAGO as metodo}
              <option value={metodo.value}>{metodo.label}</option>
            {/each}
          </select>
        </div>

        <!-- Referencia -->
        <div>
          <label for="referencia" class="block text-sm font-medium text-gray-700 mb-2">
            Referencia / Comprobante
          </label>
          <input
            id="referencia"
            type="text"
            bind:value={formData.referencia}
            class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="Número de referencia, folio, etc."
            disabled={cargando}
          />
        </div>

        <!-- Notas -->
        <div>
          <label for="notas" class="block text-sm font-medium text-gray-700 mb-2">
            Notas Adicionales
          </label>
          <div class="relative">
            <div class="absolute top-3 left-3 pointer-events-none">
              <FileText class="w-4 h-4 text-gray-400" />
            </div>
            <textarea
              id="notas"
              rows="3"
              bind:value={formData.notas}
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              placeholder="Observaciones sobre el pago..."
              disabled={cargando}
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <button
          type="button"
          on:click={cerrarModal}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          disabled={cargando}
        >
          Cancelar
        </button>
        <button
          type="button"
          on:click={guardarPago}
          class="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
          disabled={cargando}
        >
          {#if cargando}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Guardando...
          {:else}
            <DollarSign class="w-4 h-4 mr-1" />
            Registrar Pago
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}