<script lang="ts">
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ChevronLeft, Download, Copy, FileText, RefreshCw, AlertTriangle, Trash2, Send, Clock, Eye, X, CheckCircle, AlertCircle, Info } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { Button, Modal } from '$lib/components/ui';
  import ModalAgregarPago from '../../pagos/ModalAgregarPago.svelte';
  import { formatearMoneda, formatearFecha } from '../utils';

  // Obtener ID de la factura desde la URL
  $: facturaId = $page.params.id;

  // Estado
  let factura: any = null;
  let cargando = true;
  let error = '';
  let tabActivo: 'COBRANZA' | 'DETALLES' = 'COBRANZA';

  $: facturaCancelada = factura?.estado?.id === 6;

  // Modal de cancelación
  let modalCancelacionAbierto = false;
  let motivoSeleccionado = '01';
  let cancelando = false;

  // Modal de pago
  let modalPagoAbierto = false;

  // Notificaciones
  let notificacion: { tipo: 'exito' | 'error' | 'info' | 'advertencia', titulo: string, mensaje: string } | null = null;
  let mostrarNotificacion = false;
  let timeoutNotificacion: NodeJS.Timeout | null = null;

  // Motivos de cancelación según SAT
  const motivosCancelacion = [
    {
      codigo: '01',
      nombre: 'Comprobante emitido con errores con relación',
      descripcion: 'Cuando la factura contiene algún error y ya se ha emitido el comprobante que la sustituye.'
    },
    {
      codigo: '02',
      nombre: 'Comprobante emitido con errores sin relación',
      descripcion: 'Cuando la factura contiene algún error y no se requiere relacionar con otra factura.'
    },
    {
      codigo: '03',
      nombre: 'No se llevó a cabo la operación',
      descripcion: 'Cuando la venta o transacción no se concretó.'
    },
    {
      codigo: '04',
      nombre: 'Operación nominativa relacionada en la factura global',
      descripcion: 'Cuando se requiere cancelar una factura al público en general porque el cliente solicita su comprobante.'
    }
  ];

  // Función para mostrar notificaciones
  function mostrarNotif(tipo: 'exito' | 'error' | 'info' | 'advertencia', titulo: string, mensaje: string, duracion = 4000) {
    notificacion = { tipo, titulo, mensaje };
    mostrarNotificacion = true;

    if (timeoutNotificacion) clearTimeout(timeoutNotificacion);

    if (duracion > 0) {
      timeoutNotificacion = setTimeout(() => {
        mostrarNotificacion = false;
      }, duracion);
    }
  }

  function cerrarNotificacion() {
    mostrarNotificacion = false;
    if (timeoutNotificacion) clearTimeout(timeoutNotificacion);
  }

  // Cargar datos de la factura
  async function cargarFactura() {
    cargando = true;
    error = '';

    try {
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) {
        error = 'No se pudo obtener la organización';
        cargando = false;
        return;
      }

      const response = await authFetch(`/api/facturas/${facturaId}?organizacionId=${organizacionId}`);
      const data = await response.json();

      if (data.success && data.factura) {
        factura = data.factura;
      } else {
        error = data.error || 'No se encontró la factura';
      }
    } catch (err) {
      console.error('Error:', err);
      error = 'Error al cargar la factura';
    } finally {
      cargando = false;
    }
  }

  function volver() {
    goto('/dashboard/ventas');
  }

  function getEstadoNombre(estadoId: number): string {
    const estados: Record<number, string> = {
      1: 'Pendiente',
      3: 'Pagada',
      4: 'Vencida',
      6: 'Cancelada'
    };
    return estados[estadoId] || 'Desconocido';
  }

  function getEstadoColor(estadoId: number): string {
    const colores: Record<number, string> = {
      1: 'bg-yellow-100 text-yellow-700',
      3: 'bg-green-100 text-green-700',
      4: 'bg-red-100 text-red-700',
      6: 'bg-gray-100 text-gray-700'
    };
    return colores[estadoId] || 'bg-gray-100 text-gray-700';
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
      '99': '99 - Por definir'
    };
    return formasPago[formaPago] || formaPago;
  }

  async function agregarPago() {
    modalPagoAbierto = true;
  }

  function abrirModalCancelacion() {
    // Validar que la factura esté timbrada
    if (!factura?.timbrado) {
      mostrarNotif('info', 'Factura No Timbrada', 'Solo se pueden cancelar facturas que hayan sido timbradas en Facturapi.');
      return;
    }

    // Validar estado de la factura antes de abrir el modal
    if (factura?.estado?.id === 6) {
      mostrarNotif('info', 'Factura Cancelada', 'Esta factura ya se encuentra cancelada. No es posible cancelarla nuevamente.');
      return;
    }

    modalCancelacionAbierto = true;
  }

  function cerrarModalCancelacion() {
    modalCancelacionAbierto = false;
  }

  async function confirmarCancelacion() {
    cancelando = true;
    try {
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) {
        mostrarNotif('error', 'Error', 'No se pudo obtener la información de la organización.');
        cancelando = false;
        return;
      }

      const motivo = motivoSeleccionado;
      const motivoDescripcion = motivosCancelacion.find(m => m.codigo === motivo)?.nombre || '';

      const response = await authFetch(`/api/facturas/${facturaId}/cancelar?organizacionId=${organizacionId}`, {
        method: 'POST',
        body: JSON.stringify({
          motivo,
          motivoDescripcion
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const mensaje = data.canceladaEnFacturapi
          ? `La factura ${data.numeroFactura} se ha cancelado exitosamente en Facturapi y en el sistema.`
          : `La factura ${data.numeroFactura} se ha cancelado exitosamente.`;

        mostrarNotif('exito', 'Factura Cancelada', mensaje);
        cerrarModalCancelacion();

        // Esperar a que se cierre la notificación antes de recargar
        setTimeout(() => {
          cargarFactura();
        }, 1500);
      } else {
        mostrarNotif('error', 'Error al Cancelar', data.error || 'Ocurrió un error desconocido.');
      }
    } catch (err: any) {
      console.error('Error al cancelar factura:', err);
      mostrarNotif('error', 'Error', 'No se pudo procesar la cancelación. Intenta de nuevo.');
    } finally {
      cancelando = false;
    }
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
      <AlertTriangle class="w-12 h-12 text-red-600 mb-4" />
      <p class="text-red-600 font-medium text-lg mb-2">{error}</p>
      <div class="mt-4 flex gap-3">
        <Button variant="secondary" size="md" on:click={volver}>
          Volver
        </Button>
        <Button variant="primary" size="md" on:click={cargarFactura}>
          Reintentar
        </Button>
      </div>
    </div>
  {:else if factura}
    <!-- Header con breadcrumb y botones -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <button on:click={volver} class="hover:text-gray-700">Ventas</button>
          <span>/</span>
          <button on:click={volver} class="hover:text-gray-700">Facturas</button>
          <span>/</span>
          <span class="text-blue-600">Detalle de {factura.numeroFactura}</span>
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
            <div>
              <h1 class="text-2xl font-bold text-gray-900">Venta/Factura {factura.numeroFactura}</h1>
              <span class="inline-flex mt-2 px-2.5 py-1 text-xs font-medium rounded-full {getEstadoColor(factura.estado?.id || 0)}">
                {getEstadoNombre(factura.estado?.id || 0)}
              </span>
            </div>
          </div>

          <div class="flex gap-3">
            <Button
              variant="success"
              size="md"
              on:click={agregarPago}
              disabled={facturaCancelada || factura.metodoPago === 'PUE' || (factura.saldoPendiente || 0) <= 0}
              title={facturaCancelada ? 'No se pueden agregar pagos a una factura cancelada' : factura.metodoPago === 'PUE' ? 'Las facturas PUE no requieren complemento de pago' : ''}
            >
              AGREGAR PAGO
            </Button>
            {#if factura.estado?.id !== 6}
              {#if factura.timbrado}
                <Button variant="danger" size="md" on:click={abrirModalCancelacion}>
                  CANCELAR
                </Button>
              {:else}
                <Button
                  variant="secondary"
                  size="md"
                  disabled
                  title="Solo se pueden cancelar facturas timbradas"
                  class="opacity-50 cursor-not-allowed"
                >
                  CANCELAR (NO TIMBRADA)
                </Button>
              {/if}
            {/if}
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
                {#if facturaCancelada}
                  <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <h3 class="text-sm font-semibold text-red-700 uppercase">Factura Cancelada</h3>
                    </div>
                    <p class="text-sm text-red-600">Esta factura ha sido cancelada. No hay salud de factura ni gestión de cobranza disponible.</p>
                  </div>

                  <div class="mb-6 opacity-50">
                    <h3 class="text-xs font-medium text-gray-400 uppercase mb-2">Vencimiento de Factura</h3>
                    <p class="text-lg text-gray-400">N/A — Factura cancelada</p>
                    <p class="text-sm text-gray-400">{formatearFecha(factura.fechaVencimiento)}</p>
                  </div>
                {:else if factura.metodoPago === 'PUE'}
                  <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 class="text-sm font-semibold text-green-700 uppercase">Factura Pagada (PUE)</h3>
                    </div>
                    <p class="text-sm text-green-600">Esta factura fue pagada en una sola exhibición. No requiere salud de factura ni cobranza.</p>
                  </div>

                  <div class="mb-6">
                    <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Fecha de emisión</h3>
                    <p class="text-sm text-gray-600">{formatearFecha(factura.fechaEmision)}</p>
                  </div>

                  <div class="mb-6 pt-4 border-t border-gray-200">
                    <h3 class="text-xs font-medium text-gray-500 uppercase mb-3">Monto Total</h3>
                    <p class="text-2xl font-bold text-green-600">{formatearMoneda(factura.montoTotal || 0)}</p>
                  </div>
                {:else}
                  <div class="mb-6">
                    <h3 class="text-xs font-medium text-gray-500 uppercase mb-3">Vencimiento de Factura</h3>
                    {#if (factura.diasVencido || 0) < 0}
                      <p class="text-2xl font-bold text-red-600 mb-1">Vencida hace {Math.abs(factura.diasVencido || 0)} días</p>
                    {:else if (factura.diasVencido || 0) === 0}
                      <p class="text-2xl font-bold text-yellow-600 mb-1">Vence hoy</p>
                    {:else}
                      <p class="text-2xl font-bold text-green-600 mb-1">En {factura.diasVencido || 0} días</p>
                    {/if}
                    <p class="text-sm text-gray-600">{formatearFecha(factura.fechaVencimiento)}</p>

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
                      <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          class="h-2 rounded-full {(factura.diasVencido || 0) < -90 ? 'bg-red-600' : (factura.diasVencido || 0) < -30 ? 'bg-orange-600' : (factura.diasVencido || 0) < 0 ? 'bg-yellow-600' : 'bg-green-600'}"
                          style="width: {Math.min(Math.max(((factura.diasVencido || 0) + 90) / 180 * 100, 0), 100)}%"
                        ></div>
                      </div>
                      <div class="flex justify-between text-xs text-gray-600 mt-2">
                        <span>{formatearFecha(factura.fechaEmision)}</span>
                        <span>{formatearFecha(factura.fechaVencimiento)}</span>
                      </div>
                    </div>
                  </div>

                  <div class="mb-6 pt-4 border-t border-gray-200">
                    <h3 class="text-xs font-medium text-gray-500 uppercase mb-3">Saldo Pendiente</h3>
                    <p class="text-2xl font-bold text-red-600">{formatearMoneda(factura.saldoPendiente || 0)}</p>
                  </div>

                  <div class="mb-6 pt-4 border-t border-gray-200">
                    <h3 class="text-xs font-medium text-gray-500 uppercase mb-3">Monto Total</h3>
                    <p class="text-2xl font-bold text-green-600">{formatearMoneda(factura.montoTotal || 0)}</p>
                  </div>
                {/if}
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

                  <!-- Información del cliente -->
                  <div class="grid grid-cols-1 gap-3 pt-4 border-t">
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Cliente</p>
                      <p class="text-sm font-medium text-blue-600">{factura.cliente?.razonSocial || 'N/A'}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">RFC</p>
                      <p class="text-sm font-medium text-gray-900">{factura.cliente?.rfc || 'N/A'}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Email</p>
                      <p class="text-sm font-medium text-gray-900">{factura.cliente?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Teléfono</p>
                      <p class="text-sm font-medium text-gray-900">{factura.cliente?.telefono || 'N/A'}</p>
                    </div>
                  </div>

                  <!-- Identificador -->
                  <div class="pt-4 border-t">
                    <p class="text-xs text-gray-500 mb-1">Identificador</p>
                    <p class="text-sm font-medium text-gray-900">{factura.identificador || '-'}</p>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Columna derecha: DETALLES Y DOCUMENTOS -->
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
              <div class="pt-3 border-t">
                <p class="text-sm text-gray-600 mb-1">Condiciones de pago</p>
                <p class="text-sm text-gray-900">{factura.condicionesPago || '-'}</p>
              </div>
              <div>
                <p class="text-sm text-gray-600 mb-1">Moneda</p>
                <p class="text-sm text-gray-900">{factura.moneda || 'MXN'}</p>
              </div>
            </div>
          </div>

          <!-- DOCUMENTOS CON RELACIÓN -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-sm font-bold text-gray-700 uppercase mb-6">INFORMACIÓN DE FACTURA</h3>
            <table class="w-full">
              <thead class="border-b border-gray-200">
                <tr>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">Folio</th>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">Monto Total</th>
                  <th class="text-right text-sm text-gray-600 font-medium pb-3">Saldo Pendiente</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-gray-100">
                  <td class="py-4">
                    <span class="text-sm text-blue-600 font-medium">{factura.numeroFactura}</span>
                  </td>
                  <td class="py-4">
                    <span class="text-sm text-gray-900 font-medium">{formatearMoneda(factura.montoTotal || 0)}</span>
                  </td>
                  <td class="py-4 text-right text-sm text-gray-900 font-medium">{formatearMoneda(factura.saldoPendiente || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- FACTURA -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-sm font-bold text-gray-700 uppercase">FACTURA</h3>
              <div class="flex items-center gap-2">
                <p class="text-xs text-gray-600 font-medium">Creada:</p>
                <p class="text-sm text-gray-900">{formatearFecha(factura.createdAt)}</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <p class="text-xs text-gray-600 uppercase mb-1">Número de Factura</p>
                <p class="text-sm font-medium text-gray-900">{factura.numeroFactura}</p>
              </div>
              <div>
                <p class="text-xs text-gray-600 uppercase mb-1">Cliente</p>
                <p class="text-sm font-medium text-gray-900">{factura.cliente?.razonSocial || 'N/A'}</p>
              </div>
              <div class="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p class="text-xs text-gray-600 uppercase mb-1">Emisión</p>
                  <p class="text-sm font-medium text-gray-900">{formatearFecha(factura.fechaEmision)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-600 uppercase mb-1">Vencimiento</p>
                  <p class="text-sm font-medium text-gray-900">{formatearFecha(factura.fechaVencimiento)}</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-600 uppercase mb-1">Monto Total</p>
                  <p class="text-sm font-medium text-green-600">{formatearMoneda(factura.montoTotal || 0)}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-600 uppercase mb-1">Saldo Pendiente</p>
                  <p class="text-sm font-medium text-red-600">{formatearMoneda(factura.saldoPendiente || 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Notificaciones -->
{#if mostrarNotificacion && notificacion}
  <div
    class="fixed top-6 right-6 max-w-md z-50 animate-in fade-in slide-in-from-top-4 duration-300"
  >
    <div
      class="rounded-lg shadow-lg border p-4 flex items-start gap-3 {notificacion.tipo === 'exito'
        ? 'bg-green-50 border-green-200'
        : notificacion.tipo === 'error'
          ? 'bg-red-50 border-red-200'
          : notificacion.tipo === 'advertencia'
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-blue-50 border-blue-200'}"
    >
      <!-- Icono -->
      <div
        class="{notificacion.tipo === 'exito'
          ? 'text-green-600'
          : notificacion.tipo === 'error'
            ? 'text-red-600'
            : notificacion.tipo === 'advertencia'
              ? 'text-yellow-600'
              : 'text-blue-600'}"
      >
        {#if notificacion.tipo === 'exito'}
          <CheckCircle class="w-5 h-5 flex-shrink-0" />
        {:else if notificacion.tipo === 'error'}
          <AlertCircle class="w-5 h-5 flex-shrink-0" />
        {:else if notificacion.tipo === 'advertencia'}
          <AlertTriangle class="w-5 h-5 flex-shrink-0" />
        {:else}
          <Info class="w-5 h-5 flex-shrink-0" />
        {/if}
      </div>

      <!-- Contenido -->
      <div class="flex-1 min-w-0">
        <p
          class="font-semibold text-sm {notificacion.tipo === 'exito'
            ? 'text-green-900'
            : notificacion.tipo === 'error'
              ? 'text-red-900'
              : notificacion.tipo === 'advertencia'
                ? 'text-yellow-900'
                : 'text-blue-900'}"
        >
          {notificacion.titulo}
        </p>
        <p
          class="text-sm mt-1 {notificacion.tipo === 'exito'
            ? 'text-green-800'
            : notificacion.tipo === 'error'
              ? 'text-red-800'
              : notificacion.tipo === 'advertencia'
                ? 'text-yellow-800'
                : 'text-blue-800'}"
        >
          {notificacion.mensaje}
        </p>
      </div>

      <!-- Botón cerrar -->
      <button
        on:click={cerrarNotificacion}
        class="flex-shrink-0 {notificacion.tipo === 'exito'
          ? 'text-green-600 hover:text-green-700'
          : notificacion.tipo === 'error'
            ? 'text-red-600 hover:text-red-700'
            : notificacion.tipo === 'advertencia'
              ? 'text-yellow-600 hover:text-yellow-700'
              : 'text-blue-600 hover:text-blue-700'}"
      >
        <X class="w-5 h-5" />
      </button>
    </div>
  </div>
{/if}

<!-- Modal de Cancelación -->
<Modal
  open={modalCancelacionAbierto}
  title="Cancelar Factura"
  size="md"
  on:close={cerrarModalCancelacion}
>
  <div class="space-y-4">
    <div>
      <p class="text-sm text-gray-600 mb-2">
        <strong>Factura:</strong> {factura?.numeroFactura}
      </p>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-3">
        Motivo de cancelación*
      </label>
      <div class="space-y-2 max-h-80 overflow-y-auto">
        {#each motivosCancelacion as motivo}
          <label class="flex items-start p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors {motivoSeleccionado === motivo.codigo ? 'border-blue-500 bg-blue-50' : ''}">
            <input
              type="radio"
              name="motivo"
              value={motivo.codigo}
              bind:group={motivoSeleccionado}
              class="mt-1 w-4 h-4 text-blue-600 flex-shrink-0"
              disabled={cancelando}
            />
            <div class="ml-3 flex-1">
              <p class="text-sm font-semibold text-gray-900">
                {motivo.codigo} - {motivo.nombre}
              </p>
              <p class="text-xs text-gray-600 mt-1">
                {motivo.descripcion}
              </p>
            </div>
          </label>
        {/each}
      </div>
    </div>

    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <p class="text-xs text-blue-800">
        <strong>Nota:</strong> Si la factura está timbrada en Facturapi, será cancelada automáticamente en el servicio de facturación.
      </p>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <div class="flex gap-3">
      <Button
        variant="secondary"
        size="md"
        on:click={cerrarModalCancelacion}
        disabled={cancelando}
        class="flex-1"
      >
        Cancelar
      </Button>
      <Button
        variant="danger"
        size="md"
        on:click={confirmarCancelacion}
        disabled={cancelando}
        class="flex-1"
      >
        {#if cancelando}
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Cancelando...
        {:else}
          Confirmar Cancelación
        {/if}
      </Button>
    </div>
  </svelte:fragment>
</Modal>

<!-- Modal Agregar Pago -->
{#if factura}
<ModalAgregarPago
  bind:open={modalPagoAbierto}
  organizacionId={get(orgIdStore)?.toString() || ''}
  facturaInicial={{
    id: factura.id,
    numeroFactura: factura.numeroFactura,
    montoTotal: factura.montoTotal,
    saldoPendiente: factura.saldoPendiente || factura.montoTotal
  }}
  clienteInicial={{
    id: factura.cliente?.id || factura.clienteId,
    razonSocial: factura.cliente?.razonSocial || '',
    rfc: factura.cliente?.rfc || ''
  }}
  abrirConFactura={true}
  on:pagoGuardado={() => {
    cargarFactura();
  }}
  on:cerrar={() => {
    modalPagoAbierto = false;
  }}
/>
{/if}
