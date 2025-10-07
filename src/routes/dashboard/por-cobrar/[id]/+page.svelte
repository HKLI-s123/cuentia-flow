<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ChevronLeft, Trash2, Download, Copy, Camera, RefreshCw, FileText } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import ModalRecordatorios from '../ModalRecordatorios.svelte';
  import type { Factura } from '../types';
  import { formatearMoneda, formatearFecha } from '../utils';

  // Obtener ID de la factura desde la URL
  $: facturaId = $page.params.id;

  // Estado
  let factura: Factura | null = null;
  let cargando = true;
  let error = '';
  let tabActivo: 'COBRANZA' | 'DETALLES' = 'COBRANZA';

  // Modal de recordatorios
  let modalRecordatoriosAbierto = false;
  let abrirFormularioRecordatorio = false;

  // Cargar datos de la factura
  async function cargarFactura() {
    cargando = true;
    error = '';

    try {
      const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
      const organizacionId = userData.organizacionId;

      const response = await authFetch(`/api/facturas/${facturaId}?organizacionId=${organizacionId}`);
      const data = await response.json();

      if (data.success && data.factura) {
        factura = {
          ...data.factura,
          estado_factura_id: data.factura.estado.id,
          prioridad_cobranza_id: data.factura.prioridad.id
        };
      } else {
        error = data.error || 'No se encontró la factura';
      }
    } catch (err) {
      error = 'Error al cargar la factura';
    } finally {
      cargando = false;
    }
  }

  function volver() {
    goto('/dashboard/por-cobrar');
  }

  function abrirModalRecordatorios(abrirFormulario = false) {
    modalRecordatoriosAbierto = true;
    abrirFormularioRecordatorio = abrirFormulario;
  }

  function cerrarModal() {
    modalRecordatoriosAbierto = false;
    abrirFormularioRecordatorio = false;
  }

  function formatearMetodoPago(metodoPago: string | undefined): string {
    if (!metodoPago) return 'No especificado';
    if (metodoPago === 'PUE') return 'PUE - Pago en Una sola Exhibición';
    if (metodoPago === 'PPD') return 'PPD - Pago en Parcialidades o Diferido';
    return metodoPago;
  }

  function formatearFormaPago(formaPago: string | undefined): string {
    if (!formaPago) return 'No especificado';
    const formasPago: { [key: string]: string } = {
      '01': '01 - Efectivo',
      '02': '02 - Cheque nominativo',
      '03': '03 - Transferencia electrónica de fondos',
      '04': '04 - Tarjeta de crédito',
      '05': '05 - Monedero electrónico',
      '06': '06 - Dinero electrónico',
      '08': '08 - Vales de despensa',
      '12': '12 - Dación en pago',
      '13': '13 - Pago por subrogación',
      '14': '14 - Pago por consignación',
      '15': '15 - Condonación',
      '17': '17 - Compensación',
      '23': '23 - Novación',
      '24': '24 - Confusión',
      '25': '25 - Remisión de deuda',
      '26': '26 - Prescripción o caducidad',
      '27': '27 - A satisfacción del acreedor',
      '28': '28 - Tarjeta de débito',
      '29': '29 - Tarjeta de servicios',
      '30': '30 - Aplicación de anticipos',
      '31': '31 - Intermediario pagos',
      '99': '99 - Por definir'
    };
    return formasPago[formaPago] || formaPago;
  }

  onMount(() => {
    cargarFactura();
  });
</script>

<div class="min-h-screen bg-gray-50">
  {#if cargando}
    <div class="flex items-center justify-center h-screen">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center h-screen">
      <p class="text-red-600 font-medium">{error}</p>
      <button
        on:click={volver}
        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Volver
      </button>
    </div>
  {:else if factura}
    <!-- Header con breadcrumb y botones -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <button on:click={volver} class="hover:text-gray-700">PorCobrar</button>
          <span>/</span>
          <button on:click={volver} class="hover:text-gray-700">Facturas</button>
          <span>/</span>
          <span class="text-blue-600">Detalle de {factura.numero_factura}</span>
        </div>

        <!-- Título y botones -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button
              on:click={volver}
              class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft class="w-5 h-5" />
            </button>
            <h1 class="text-2xl font-bold text-gray-900">Nota de Venta {factura.numero_factura}</h1>
          </div>

          <div class="flex gap-3">
            <button class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              ENVIAR NOTA DE VENTA
            </button>
            <button
              on:click={() => abrirModalRecordatorios(false)}
              class="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ENVIAR RECORDATORIO
            </button>
            <button class="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
              AGREGAR PAGO
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Contenido principal -->
    <div class="max-w-7xl mx-auto px-6 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Columna izquierda: COBRANZA -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200">
            <!-- Tabs -->
            <div class="border-b border-gray-200">
              <div class="flex">
                <button
                  on:click={() => tabActivo = 'COBRANZA'}
                  class="flex-1 px-6 py-3 text-sm font-medium transition-colors relative {tabActivo === 'COBRANZA' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}"
                >
                  COBRANZA
                  {#if tabActivo === 'COBRANZA'}
                    <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500"></div>
                  {/if}
                </button>
                <button
                  on:click={() => tabActivo = 'DETALLES'}
                  class="flex-1 px-6 py-3 text-sm font-medium transition-colors relative {tabActivo === 'DETALLES' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}"
                >
                  DETALLES
                  {#if tabActivo === 'DETALLES'}
                    <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500"></div>
                  {/if}
                </button>
              </div>
            </div>

            <div class="p-6">
              {#if tabActivo === 'COBRANZA'}
                <!-- Vencimiento de factura -->
                <div class="mb-6">
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xs font-medium text-gray-500 uppercase">Vencimiento de Factura</h3>
                    <button class="text-xs text-blue-600 hover:text-blue-800">Actualizar</button>
                  </div>
                  {#if (factura.diasVencido || 0) < 0}
                    <p class="text-2xl font-bold text-red-600 mb-1">Vencida hace {Math.abs(factura.diasVencido || 0)} días</p>
                  {:else if (factura.diasVencido || 0) === 0}
                    <p class="text-2xl font-bold text-yellow-600 mb-1">Vence hoy</p>
                  {:else}
                    <p class="text-2xl font-bold text-green-600 mb-1">En {factura.diasVencido || 0} días</p>
                  {/if}
                  <p class="text-sm text-gray-600">{formatearFecha(factura.fechaVencimiento)}</p>

                  <!-- Barra de salud de factura -->
                  <div class="mt-4">
                    <div class="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Salud de factura</span>
                      {#if (factura.diasVencido || 0) < -90}
                        <span class="text-red-600 font-medium">Crítica</span>
                      {:else if (factura.diasVencido || 0) < -30}
                        <span class="text-orange-600 font-medium">Requiere atención</span>
                      {:else if (factura.diasVencido || 0) < 0}
                        <span class="text-yellow-600 font-medium">Vencida</span>
                      {:else}
                        <span class="text-green-600 font-medium">Bueno</span>
                      {/if}
                    </div>
                    <div class="flex justify-between text-xs text-gray-600">
                      <span>{formatearFecha(factura.fechaEmision)}</span>
                      <span>{formatearFecha(factura.fechaVencimiento)}</span>
                      {#if (factura.diasVencido || 0) < 0}
                        <span class="text-red-600">{Math.abs(factura.diasVencido || 0)} días vencidos</span>
                      {:else}
                        <span class="text-green-600">{factura.diasVencido || 0} días restantes</span>
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- Pagos -->
                <div class="mb-6">
                  <h3 class="text-xs font-medium text-gray-500 uppercase mb-3">Pagos</h3>
                  <p class="text-sm text-gray-600">No hay pagos registrados</p>
                </div>

                <!-- Recordatorios -->
                <div class="mb-6">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-xs font-medium text-gray-500 uppercase">Recordatorios</h3>
                    <button
                      on:click={() => abrirModalRecordatorios(false)}
                      class="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Ver Historial
                    </button>
                  </div>
                  <div class="flex gap-6">
                    <div class="text-center">
                      <p class="text-xs text-gray-500 mb-1">ENVIADOS</p>
                      <p class="text-3xl font-bold text-blue-600">0</p>
                    </div>
                    <div class="text-center">
                      <p class="text-xs text-gray-500 mb-1">VISTOS</p>
                      <p class="text-3xl font-bold text-blue-600">0</p>
                    </div>
                    <div class="text-center">
                      <p class="text-xs text-gray-500 mb-1">PROGRAMADOS</p>
                      <p class="text-3xl font-bold text-blue-600">0</p>
                    </div>
                  </div>
                </div>

                <!-- Cobranza automática -->
                <div class="mb-6">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-medium text-gray-500 uppercase">Cobranza Automática</h3>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" class="sr-only peer">
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span class="ml-3 text-sm font-medium text-gray-500">Desactivada</span>
                    </label>
                  </div>
                </div>

                <!-- Próximos recordatorios -->
                <div>
                  <h3 class="text-xs font-medium text-gray-500 uppercase mb-3">Próximos Recordatorios</h3>
                  <p class="text-sm text-gray-600">No hay recordatorios programados</p>
                </div>
              {:else}
                <!-- Tab DETALLES -->
                <div class="space-y-4">
                  <!-- Método de pago -->
                  <div>
                    <h4 class="text-xs font-medium text-gray-500 mb-1">Método de pago</h4>
                    <p class="text-sm text-gray-900">{formatearMetodoPago(factura.metodoPago || '')}</p>
                  </div>

                  <!-- Forma de pago -->
                  <div>
                    <h4 class="text-xs font-medium text-gray-500 mb-1">Forma de pago</h4>
                    <p class="text-sm text-gray-900">{formatearFormaPago(factura.formaPago || '')}</p>
                  </div>

                  <!-- Nota de venta -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="text-xs font-medium text-blue-600 uppercase">Nota de Venta</h4>
                      <p class="text-xs text-gray-500">EMITIDA POR:</p>
                    </div>
                    <p class="text-xs text-blue-600">{factura.usuarioCreadorCorreo || 'N/A'}</p>
                  </div>

                  <!-- Información del cliente -->
                  <div class="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Cliente</p>
                      <p class="text-sm font-medium text-blue-600">{factura.cliente?.razonSocial || 'N/A'}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">RFC</p>
                      <p class="text-sm font-medium text-gray-900">{factura.cliente?.rfc || 'N/A'}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Total</p>
                      <p class="text-sm font-medium text-gray-900">{formatearMoneda(factura.montoTotal || 0)}</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Saldo</p>
                      <p class="text-sm font-medium text-gray-900">{formatearMoneda(factura.saldoPendiente || 0)}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Condiciones de pago</p>
                      <p class="text-sm font-medium text-gray-900">7 días</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Régimen Fiscal</p>
                      <p class="text-sm font-medium text-gray-900">612 - Personas Físicas</p>
                    </div>
                  </div>

                  <div>
                    <p class="text-xs text-gray-500 mb-1">Código Postal</p>
                    <p class="text-sm font-medium text-gray-900">{factura.cliente?.codigoPostal || 'N/A'}</p>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Columna derecha: DETALLES -->
        <div class="lg:col-span-2 space-y-6">

          <!-- DETALLES -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-sm font-bold text-gray-700 uppercase mb-6">DETALLES</h3>
            <div class="space-y-3">
              <div>
                <p class="text-sm text-gray-600 mb-1">Método de pago</p>
                <p class="text-sm text-gray-900">{formatearMetodoPago(factura.metodoPago || '')}</p>
              </div>
              <div>
                <p class="text-sm text-gray-600 mb-1">Forma de pago</p>
                <p class="text-sm text-gray-900">{formatearFormaPago(factura.formaPago || '')}</p>
              </div>
            </div>
          </div>

          <!-- DOCUMENTOS CON RELACIÓN -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-sm font-bold text-gray-700 uppercase mb-6">DOCUMENTOS CON RELACIÓN</h3>
            <table class="w-full">
              <thead class="border-b border-gray-200">
                <tr>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">Folio</th>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">CFDI</th>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">UUID</th>
                  <th class="text-right text-sm text-gray-600 font-medium pb-3">Valor</th>
                  <th class="text-right text-sm text-gray-600 font-medium pb-3">Monto de pago</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-gray-100">
                  <td class="py-4">
                    <button class="text-sm text-blue-600 hover:underline">{factura.numero_factura}</button>
                  </td>
                  <td class="py-4">
                    <span class="inline-flex items-center justify-center w-6 h-6 bg-gray-200 rounded text-xs text-gray-600">P</span>
                  </td>
                  <td class="py-4 text-sm text-gray-900">-</td>
                  <td class="py-4 text-right text-sm text-gray-900">{formatearMoneda(factura.saldoPendiente || 0)}</td>
                  <td class="py-4 text-right text-sm text-gray-900">{formatearMoneda(factura.saldoPendiente || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- NOTA DE VENTA -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-sm font-bold text-gray-700 uppercase">NOTA DE VENTA</h3>
              <div class="flex items-center gap-4">
                <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Eliminar">
                  <Trash2 class="w-4 h-4 text-gray-600" />
                </button>
                <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Descargar">
                  <Download class="w-4 h-4 text-gray-600" />
                </button>
                <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Copiar">
                  <Copy class="w-4 h-4 text-gray-600" />
                </button>
                <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="PDF">
                  <FileText class="w-4 h-4 text-gray-600" />
                </button>
                <button class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Actualizar">
                  <RefreshCw class="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div class="mb-4">
              <p class="text-xs text-blue-600 uppercase mb-1">EMITIDA POR:</p>
              <p class="text-sm text-blue-600">{factura.usuarioCreadorCorreo || 'N/A'}</p>
            </div>

            <!-- Info del cliente en grid -->
            <div class="grid grid-cols-3 gap-6 mb-6 pb-6 border-b border-gray-200">
              <div>
                <p class="text-sm text-gray-600 mb-2">Cliente</p>
                <button class="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                  {factura.cliente?.razonSocial || 'N/A'}
                </button>
              </div>
              <div>
                <p class="text-sm text-gray-600 mb-2">RFC</p>
                <p class="text-sm text-gray-900">{factura.cliente?.rfc || 'N/A'}</p>
              </div>
              <div>
                <p class="text-sm text-gray-600 mb-2">Total</p>
                <p class="text-sm font-semibold text-gray-900">{formatearMoneda(factura.montoTotal || 0)}</p>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-6 mb-6 pb-6 border-b border-gray-200">
              <div>
                <p class="text-sm text-gray-600 mb-2">Saldo</p>
                <p class="text-sm font-semibold text-gray-900">{formatearMoneda(factura.saldoPendiente || 0)}</p>
              </div>
              <div>
                <p class="text-sm text-gray-600 mb-2">Condiciones de pago</p>
                <p class="text-sm text-gray-900">{factura.condicionesPago || 'No especificado'}</p>
              </div>
              <div>
                <p class="text-sm text-gray-600 mb-2">Régimen Fiscal</p>
                <p class="text-sm text-gray-900">{factura.cliente?.regimenFiscal || 'N/A'}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-200">
              <div>
                <p class="text-sm text-gray-600 mb-2">Código Postal</p>
                <p class="text-sm text-gray-900">{factura.cliente?.codigoPostal || 'N/A'}</p>
              </div>
              {#if factura.uuid}
                <div>
                  <p class="text-sm text-gray-600 mb-2">UUID (Timbrado)</p>
                  <p class="text-xs text-gray-900 font-mono">{factura.uuid}</p>
                </div>
              {/if}
            </div>

            <!-- Tabla de productos -->
            {#if factura.conceptos && factura.conceptos.length > 0}
              <table class="w-full mb-6">
                <thead class="border-b border-gray-200">
                  <tr>
                    <th class="text-left text-sm text-gray-600 font-medium pb-3">Producto</th>
                    <th class="text-center text-sm text-gray-600 font-medium pb-3">Cantidad</th>
                    <th class="text-right text-sm text-gray-600 font-medium pb-3">Subtotal (MXN)</th>
                    <th class="text-right text-sm text-gray-600 font-medium pb-3">Impuesto (MXN)</th>
                    <th class="text-right text-sm text-gray-600 font-medium pb-3">Total (MXN)</th>
                  </tr>
                </thead>
                <tbody>
                  {#each (factura.conceptos || []) as concepto}
                    <tr class="border-b border-gray-100">
                      <td class="py-4">
                        <p class="text-sm text-gray-900">{concepto.nombre}</p>
                        {#if concepto.descripcion}
                          <p class="text-xs text-gray-500 mt-1">{concepto.descripcion}</p>
                        {/if}
                        {#if concepto.claveProdServ}
                          <p class="text-xs text-gray-500 mt-1">Clave SAT: {concepto.claveProdServ}</p>
                        {/if}
                      </td>
                      <td class="py-4 text-center text-sm text-gray-900">
                        {concepto.cantidad}
                      </td>
                      <td class="py-4 text-right text-sm text-gray-900">
                        {formatearMoneda(concepto.subtotal || 0)}
                      </td>
                      <td class="py-4 text-right text-sm text-gray-900">
                        {formatearMoneda(concepto.totalImpuestos || 0)}
                      </td>
                      <td class="py-4 text-right text-sm text-gray-900">
                        {formatearMoneda(concepto.total || 0)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>

              <!-- Totales alineados a la derecha -->
              <div class="flex justify-end">
                <div class="w-80 space-y-2">
                  <div class="flex justify-between text-sm text-gray-600">
                    <span>Subtotal:</span>
                    <span>{formatearMoneda((factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.subtotal || 0), 0))}</span>
                  </div>
                  <div class="flex justify-between text-sm text-gray-600">
                    <span>Descuento:</span>
                    <span>$0 MXN</span>
                  </div>
                  <div class="flex justify-between text-sm text-gray-600">
                    <span>Impuestos:</span>
                    <span>{formatearMoneda((factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.totalImpuestos || 0), 0))}</span>
                  </div>
                  <div class="flex justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Total:</span>
                    <span>{formatearMoneda(factura.montoTotal || 0)}</span>
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-sm text-gray-500 py-8 text-center">No hay conceptos registrados</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Modal de Recordatorios -->
<ModalRecordatorios
  bind:abierto={modalRecordatoriosAbierto}
  bind:abrirFormulario={abrirFormularioRecordatorio}
  factura={factura}
  on:cerrar={cerrarModal}
/>
