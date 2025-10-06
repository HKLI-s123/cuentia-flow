<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, FileText, User, Calendar, DollarSign, Clock, Phone, Mail, MapPin, Download, Send } from 'lucide-svelte';
  import type { Factura } from './types';
  import { formatearMoneda, formatearFecha, formatearFechaHora, getEstadoBadgeClass, getPrioridadBadgeClass } from './utils';

  export let factura: Factura | null = null;
  export let abierto = false;

  const dispatch = createEventDispatcher();

  // Datos de ejemplo para historial de gestiones (temporal)
  let historialGestiones = [
    {
      id: 1,
      fecha: '2024-09-20T10:30:00Z',
      tipo: 'Llamada',
      resultado: 'Contactado',
      descripcion: 'Cliente confirma recepción de factura. Solicita 5 días adicionales.',
      usuario: 'Carlos Mendoza'
    },
    {
      id: 2,
      fecha: '2024-09-15T14:15:00Z',
      tipo: 'Email',
      resultado: 'Enviado',
      descripcion: 'Enviado recordatorio de pago con PDF adjunto.',
      usuario: 'Ana García'
    }
  ];

  // Datos de ejemplo para historial de pagos
  let historialPagos = [
    {
      id: 1,
      fecha: '2024-08-15T09:00:00Z',
      monto: 44500.75,
      metodo: 'Transferencia',
      referencia: 'TRF-789456123',
      usuario: 'Sistema'
    }
  ];

  function cerrarModal() {
    dispatch('cerrar');
  }

  function descargarPDF() {
    // Aquí iría la lógica para descargar el PDF
  }

  function enviarEmail() {
    // Aquí iría la lógica para enviar email
  }

  function getEstadoNombre(estadoId: number): string {
    const estados = [
      { id: 1, nombre: 'Pendiente' },
      { id: 2, nombre: 'Pago Parcial' },
      { id: 3, nombre: 'Pagada' },
      { id: 4, nombre: 'Vencida' },
      { id: 5, nombre: 'Incobrable' }
    ];
    return estados.find(e => e.id === estadoId)?.nombre || 'Desconocido';
  }

  function getPrioridadNombre(prioridadId: number): string {
    const prioridades = [
      { id: 1, nombre: 'Alta' },
      { id: 2, nombre: 'Media' },
      { id: 3, nombre: 'Baja' }
    ];
    return prioridades.find(p => p.id === prioridadId)?.nombre || 'Desconocido';
  }

  function getEstadoCodigo(estadoId: number): string {
    const estados = [
      { id: 1, codigo: 'pendiente' },
      { id: 2, codigo: 'parcial' },
      { id: 3, codigo: 'pagada' },
      { id: 4, codigo: 'vencida' },
      { id: 5, codigo: 'incobrable' }
    ];
    return estados.find(e => e.id === estadoId)?.codigo || 'desconocido';
  }

  function getPrioridadCodigo(prioridadId: number): string {
    const prioridades = [
      { id: 1, codigo: 'alta' },
      { id: 2, codigo: 'media' },
      { id: 3, codigo: 'baja' }
    ];
    return prioridades.find(p => p.id === prioridadId)?.codigo || 'desconocido';
  }
</script>

{#if abierto && factura}
  <!-- Overlay -->
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <!-- Modal -->
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-t-xl">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-blue-100 rounded-lg">
            <FileText class="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Detalles de Factura</h2>
            <p class="text-sm text-gray-600">{factura.numero_factura}</p>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <!-- Botones de acción -->
          <button
            on:click={descargarPDF}
            class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Descargar PDF"
          >
            <Download class="w-5 h-5" />
          </button>
          <button
            on:click={enviarEmail}
            class="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Enviar Email"
          >
            <Send class="w-5 h-5" />
          </button>
          <button
            on:click={cerrarModal}
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Contenido Principal -->
      <div class="p-6 space-y-6">
        <!-- Información General -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Datos de la Factura -->
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText class="w-5 h-5 mr-2 text-blue-600" />
              Información de Factura
            </h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">Número:</span>
                <span class="font-medium text-gray-900">{factura.numero_factura}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Fecha Emisión:</span>
                <span class="font-medium text-gray-900">{formatearFecha(factura.fechaEmision)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Fecha Vencimiento:</span>
                <span class="font-medium text-gray-900">{formatearFecha(factura.fechaVencimiento)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Días Vencida:</span>
                <span class="font-medium {(factura.diasVencido || 0) > 0 ? 'text-red-600' : 'text-green-600'}">
                  {(factura.diasVencido || 0) > 0 ? `${factura.diasVencido} días` : 'Al corriente'}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Estado:</span>
                <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full border {getEstadoBadgeClass(getEstadoCodigo(factura.estado_factura_id || 0))}">
                  {getEstadoNombre(factura.estado_factura_id || 0)}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">Prioridad:</span>
                <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full border {getPrioridadBadgeClass(getPrioridadCodigo(factura.prioridad_cobranza_id || 0))}">
                  {getPrioridadNombre(factura.prioridad_cobranza_id || 0)}
                </span>
              </div>
            </div>
          </div>

          <!-- Datos del Cliente -->
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User class="w-5 h-5 mr-2 text-green-600" />
              Información del Cliente
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <span class="text-gray-600">Razón Social:</span>
                <p class="font-medium text-gray-900">{factura.cliente?.razonSocial || 'N/A'}</p>
              </div>
              <div>
                <span class="text-gray-600">RFC:</span>
                <p class="font-medium text-gray-900">{factura.cliente?.rfc || 'N/A'}</p>
              </div>
              <div>
                <span class="text-gray-600">Email:</span>
                <p class="font-medium text-blue-600 flex items-center">
                  <Mail class="w-4 h-4 mr-1" />
                  {factura.cliente?.correo || 'No disponible'}
                </p>
              </div>
              <div>
                <span class="text-gray-600">Teléfono:</span>
                <p class="font-medium text-green-600 flex items-center">
                  <Phone class="w-4 h-4 mr-1" />
                  {factura.cliente?.telefono || 'No disponible'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Conceptos de la Factura -->
        {#if factura.conceptos && factura.conceptos.length > 0}
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText class="w-5 h-5 mr-2 text-purple-600" />
              Conceptos
            </h3>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clave SAT</th>
                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P. Unit.</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Impuestos</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each factura.conceptos as concepto}
                    <tr>
                      <td class="px-4 py-3">
                        <div class="text-sm font-medium text-gray-900">{concepto.nombre}</div>
                        {#if concepto.descripcion}
                          <div class="text-xs text-gray-500">{concepto.descripcion}</div>
                        {/if}
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-600">{concepto.claveProdServ || 'N/A'}</td>
                      <td class="px-4 py-3 text-center text-sm text-gray-900">{concepto.cantidad} {concepto.unidadMedida}</td>
                      <td class="px-4 py-3 text-right text-sm text-gray-900">{formatearMoneda(concepto.precioUnitario)}</td>
                      <td class="px-4 py-3 text-right text-sm text-gray-900">{formatearMoneda(concepto.subtotal)}</td>
                      <td class="px-4 py-3 text-right">
                        {#if concepto.impuestos && concepto.impuestos.length > 0}
                          <div class="text-sm text-gray-900">{formatearMoneda(concepto.totalImpuestos)}</div>
                          <div class="text-xs text-gray-500">
                            {#each concepto.impuestos as impuesto}
                              <div>{impuesto.tipo}: {formatearMoneda(impuesto.monto)}</div>
                            {/each}
                          </div>
                        {:else}
                          <div class="text-sm text-gray-500">-</div>
                        {/if}
                      </td>
                      <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatearMoneda(concepto.total)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}

        <!-- Montos -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign class="w-5 h-5 mr-2 text-blue-600" />
            Resumen Financiero
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center">
              <div class="text-sm text-gray-600">Monto Total</div>
              <div class="text-2xl font-bold text-gray-900">{formatearMoneda(factura.montoTotal)}</div>
            </div>
            <div class="text-center">
              <div class="text-sm text-gray-600">Saldo Pendiente</div>
              <div class="text-2xl font-bold text-red-600">{formatearMoneda(factura.saldoPendiente || 0)}</div>
            </div>
            <div class="text-center">
              <div class="text-sm text-gray-600">Monto Pagado</div>
              <div class="text-2xl font-bold text-green-600">{formatearMoneda(factura.montoTotal - (factura.saldoPendiente || 0))}</div>
            </div>
          </div>
        </div>

        <!-- Historial de Pagos -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <DollarSign class="w-5 h-5 mr-2 text-green-600" />
            Historial de Pagos
          </h3>
          {#if historialPagos.length > 0}
            <div class="space-y-3">
              {#each historialPagos as pago}
                <div class="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div>
                    <p class="font-medium text-gray-900">{formatearMoneda(pago.monto)}</p>
                    <p class="text-sm text-gray-600">
                      {pago.metodo} • {formatearFechaHora(pago.fecha)}
                    </p>
                    <p class="text-xs text-gray-500">Ref: {pago.referencia}</p>
                  </div>
                  <div class="text-green-600">
                    <DollarSign class="w-5 h-5" />
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-gray-500 text-center py-4">No hay pagos registrados</p>
          {/if}
        </div>

        <!-- Historial de Gestiones -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock class="w-5 h-5 mr-2 text-purple-600" />
            Historial de Gestiones
          </h3>
          {#if historialGestiones.length > 0}
            <div class="space-y-3">
              {#each historialGestiones as gestion}
                <div class="flex items-start space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div class="p-2 bg-purple-100 rounded-lg">
                    <Clock class="w-4 h-4 text-purple-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between">
                      <p class="font-medium text-gray-900">{gestion.tipo} • {gestion.resultado}</p>
                      <span class="text-sm text-gray-500">{formatearFechaHora(gestion.fecha)}</span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">{gestion.descripcion}</p>
                    <p class="text-xs text-gray-500 mt-1">Por: {gestion.usuario}</p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-gray-500 text-center py-4">No hay gestiones registradas</p>
          {/if}
        </div>

        <!-- Observaciones -->
        {#if factura.observaciones}
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Observaciones</h3>
            <p class="text-gray-700 leading-relaxed">{factura.observaciones}</p>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex justify-end p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <button
          on:click={cerrarModal}
          class="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
{/if}