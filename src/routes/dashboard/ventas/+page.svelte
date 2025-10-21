<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    TrendingUp,
    AlertTriangle,
    Search,
    Filter,
    Plus,
    FileText,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Settings,
    MoreVertical,
    Eye,
    CreditCard,
    FileX,
    CheckCircle,
    AlertCircle,
    Info,
    X as IconX
  } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { Button, Input, Badge } from '$lib/components/ui';
  import type { Venta, Paginacion } from './types';
  import {
    formatearMoneda,
    formatearFecha,
    getEstadoBadgeClass,
    calcularMetricas
  } from './utils';

  // Estado de filtros
  let filtroTexto = '';
  let filtroEstado = '';
  let filtrosEstadoCheckbox = {
    pagada: false,
    pendiente: false,
    vencida: false,
    cancelada: false
  };
  let mostrarFiltros = false;

  // Contar filtros activos
  $: filtrosActivos = Object.values(filtrosEstadoCheckbox).filter(v => v).length;

  // Estado de ordenamiento
  let ordenCampo: string = 'FechaEmision';
  let ordenDireccion: 'ASC' | 'DESC' = 'DESC';

  // Estado de menú dropdown
  let menuAbiertoId: number | null = null;

  // Modal de cancelación
  let modalMotivoCancelacionAbierto = false;
  let modalConfirmacionCancelacionAbierto = false;
  let ventaSeleccionada: Venta | null = null;
  let motivoSeleccionado = '01';
  let cancelando = false;

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

  // Notificaciones
  let notificacion: { tipo: 'exito' | 'error' | 'info' | 'advertencia', titulo: string, mensaje: string } | null = null;
  let mostrarNotificacion = false;
  let timeoutNotificacion: NodeJS.Timeout | null = null;

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

  // Datos de la API
  let ventas: Venta[] = [];
  let paginacion: Paginacion = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  };
  let cargando = true;
  let error = '';

  // Contadores de estados
  let contadorEstados = {
    pagada: 0,
    pendiente: 0,
    vencida: 0,
    cancelada: 0
  };

  // Métricas calculadas dinámicamente
  $: metricas = calcularMetricas(ventas);

  // Función para obtener el nombre del estado
  function getEstadoNombre(estadoId: number): string {
    const estados: Record<number, string> = {
      1: 'Pendiente',
      3: 'Pagada',
      4: 'Vencida',
      6: 'Cancelada'
    };
    return estados[estadoId] || 'Desconocido';
  }

  // Función para obtener el código del estado
  function getEstadoCodigo(estadoId: number): string {
    const estados: Record<number, string> = {
      1: 'pendiente',
      3: 'pagada',
      4: 'vencida',
      6: 'cancelada'
    };
    return estados[estadoId] || 'desconocido';
  }

  // Funciones de modal y navegación
  function irADetalle(venta: Venta) {
    goto(`/dashboard/ventas/${venta.id}`);
  }

  function cerrarMenu() {
    menuAbiertoId = null;
  }

  // Funciones para el menú dropdown
  function toggleMenu(ventaId: number) {
    menuAbiertoId = menuAbiertoId === ventaId ? null : ventaId;
  }

  // Función para agregar pago
  function abrirModalPago(venta: Venta) {
    cerrarMenu();
    // Ir a la página de por-cobrar donde está el modal de pago
    goto(`/dashboard/por-cobrar/${venta.id}`);
  }

  // Función para abrir modal de selección de motivo
  function abrirModalMotivoCancelacion(venta: Venta) {
    // Validar que la factura esté timbrada
    if (!venta.Timbrado) {
      mostrarNotif('info', 'Factura No Timbrada', 'Solo se pueden cancelar facturas que hayan sido timbradas en Facturapi.');
      cerrarMenu();
      return;
    }

    cerrarMenu();
    ventaSeleccionada = venta;
    motivoSeleccionado = '01';
    modalMotivoCancelacionAbierto = true;
  }

  function cerrarModalMotivoCancelacion() {
    modalMotivoCancelacionAbierto = false;
    ventaSeleccionada = null;
  }

  // Función para abrir modal de confirmación
  function abrirModalConfirmacionCancelacion() {
    modalMotivoCancelacionAbierto = false;
    modalConfirmacionCancelacionAbierto = true;
  }

  function cerrarModalConfirmacionCancelacion() {
    modalConfirmacionCancelacionAbierto = false;
    ventaSeleccionada = null;
  }

  // Función para ejecutar la cancelación
  async function confirmarCancelacion() {
    if (!ventaSeleccionada) return;

    cancelando = true;
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');
      if (!organizacionId) {
        mostrarNotif('error', 'Error', 'No se pudo obtener la información de la organización.');
        cancelando = false;
        return;
      }

      const motivoDescripcion = motivosCancelacion.find(m => m.codigo === motivoSeleccionado)?.nombre || '';

      const response = await authFetch(`/api/facturas/${ventaSeleccionada.id}/cancelar?organizacionId=${organizacionId}`, {
        method: 'POST',
        body: JSON.stringify({
          motivo: motivoSeleccionado,
          motivoDescripcion
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const mensaje = data.canceladaEnFacturapi
          ? `La factura ${data.numeroFactura} se ha cancelado exitosamente en Facturapi y en el sistema.`
          : `La factura ${data.numeroFactura} se ha cancelado exitosamente.`;

        mostrarNotif('exito', 'Factura Cancelada', mensaje);
        cerrarModalConfirmacionCancelacion();

        // Recargar la lista después de mostrar la notificación
        setTimeout(() => {
          cargarVentas();
        }, 1500);
      } else {
        mostrarNotif('error', 'Error al Cancelar', data.error || 'Ocurrió un error desconocido.');
      }
    } catch (err) {
      console.error('Error al cancelar factura:', err);
      mostrarNotif('error', 'Error', 'No se pudo procesar la cancelación. Intenta de nuevo.');
    } finally {
      cancelando = false;
    }
  }

  // Función para cargar facturas desde API (que se mostrarán como ventas)
  async function cargarVentas() {
    cargando = true;
    error = '';

    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');

      if (!organizacionId) {
        error = 'No se pudo obtener la información de la organización. Por favor, inicie sesión nuevamente.';
        cargando = false;
        return;
      }

      // Construir query string con filtros
      const params = new URLSearchParams();
      params.append('organizacionId', organizacionId);
      params.append('page', paginacion.page.toString());
      params.append('limit', paginacion.limit.toString());

      // Agregar ordenamiento
      params.append('ordenCampo', ordenCampo);
      params.append('ordenDireccion', ordenDireccion);

      // Agregar filtros
      if (filtroTexto) {
        params.append('cliente', filtroTexto);
      }
      if (filtroEstado) {
        params.append('estado', filtroEstado);
      }

      // Agregar filtros de checkbox - Estados de factura
      const estadosSeleccionados = [];
      if (filtrosEstadoCheckbox.pagada) estadosSeleccionados.push('3');
      if (filtrosEstadoCheckbox.pendiente) estadosSeleccionados.push('1');
      if (filtrosEstadoCheckbox.vencida) estadosSeleccionados.push('4');
      if (filtrosEstadoCheckbox.cancelada) estadosSeleccionados.push('6');

      if (estadosSeleccionados.length > 0) {
        params.append('estados', estadosSeleccionados.join(','));
      }

      // Usar el endpoint de facturas
      const response = await authFetch(`/api/facturas?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Mapear facturas al formato de ventas
        ventas = (data.facturas || []).map((f: any) => ({
          id: f.id,
          numero_venta: f.numeroFactura,
          cliente: f.cliente,
          montoTotal: f.montoTotal,
          fechaEmision: f.fechaEmision,
          fechaVencimiento: f.fechaVencimiento,
          identificador: f.identificador,
          estado_venta_id: f.estado?.id,
          createdAt: f.createdAt,
          saldoPendiente: f.saldoPendiente,
          Timbrado: f.timbrado || f.Timbrado || false
        }));
        paginacion = { ...paginacion, ...data.pagination };

        // Actualizar contadores de estados desde el backend
        if (data.conteoEstados) {
          contadorEstados = {
            pagada: data.conteoEstados[3] || 0,
            pendiente: data.conteoEstados[1] || 0,
            vencida: data.conteoEstados[4] || 0,
            cancelada: data.conteoEstados[6] || 0
          };
        }
      } else {
        error = data.error || 'Error al cargar ventas';
      }
    } catch (err) {
      error = 'Error al conectar con el servidor';
      console.error('Error:', err);
    } finally {
      cargando = false;
    }
  }

  // Funciones de filtrado
  function aplicarFiltros() {
    paginacion.page = 1;
    cargarVentas();
  }

  function limpiarFiltros() {
    filtroTexto = '';
    filtroEstado = '';
    filtrosEstadoCheckbox = {
      pagada: false,
      pendiente: false,
      vencida: false,
      cancelada: false
    };
    aplicarFiltros();
  }

  function toggleFiltros() {
    mostrarFiltros = !mostrarFiltros;
  }

  function aplicarFiltrosCheckbox() {
    paginacion.page = 1;
    cargarVentas();
  }

  // Funciones de navegación de páginas
  function irAPagina(numeroPagina: number) {
    if (numeroPagina >= 1 && numeroPagina <= paginacion.totalPages) {
      paginacion.page = numeroPagina;
      cargarVentas();
    }
  }

  function paginaAnterior() {
    if (paginacion.page > 1) {
      irAPagina(paginacion.page - 1);
    }
  }

  function paginaSiguiente() {
    if (paginacion.page < paginacion.totalPages) {
      irAPagina(paginacion.page + 1);
    }
  }

  // Función para cambiar ordenamiento
  function cambiarOrden(campo: string) {
    if (ordenCampo === campo) {
      ordenDireccion = ordenDireccion === 'ASC' ? 'DESC' : 'ASC';
    } else {
      ordenCampo = campo;
      ordenDireccion = 'ASC';
    }
    paginacion.page = 1;
    cargarVentas();
  }

  // Función para obtener icono de ordenamiento
  function getIconoOrden(campo: string): 'up' | 'down' | 'none' {
    if (ordenCampo !== campo) return 'none';
    return ordenDireccion === 'ASC' ? 'up' : 'down';
  }

  onMount(() => {
    cargarVentas();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        cerrarMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="space-y-6">
  <!-- Header con botones -->
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm text-gray-600 mt-1">Gestiona todas tus ventas/facturas, agrega pagos y cancela facturas según sea necesario.</p>
    </div>
  </div>

  <!-- Filtros y búsqueda -->
  <div class="bg-white rounded-xl shadow-sm border">
    <div class="p-4 border-b border-gray-200">
      <div class="flex flex-col sm:flex-row gap-3">
        <!-- Búsqueda -->
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Buscar por folio, cliente o identificador"
            bind:value={filtroTexto}
            on:input={aplicarFiltros}
            class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full transition-all duration-200"
          />
        </div>

        <!-- Botón Filtros -->
        <Button variant="secondary" size="md" on:click={toggleFiltros}>
          <Filter class="w-4 h-4" />
          Filtros({filtrosActivos})
        </Button>
      </div>

      <!-- Panel de filtros desplegable -->
      {#if mostrarFiltros}
        <div class="px-4 py-3 bg-gray-50 border-t border-gray-200 mt-3">
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
              <input
                type="checkbox"
                bind:checked={filtrosEstadoCheckbox.pagada}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Pagada ({contadorEstados.pagada})</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
              <input
                type="checkbox"
                bind:checked={filtrosEstadoCheckbox.pendiente}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Pendiente ({contadorEstados.pendiente})</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
              <input
                type="checkbox"
                bind:checked={filtrosEstadoCheckbox.vencida}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Vencida ({contadorEstados.vencida})</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
              <input
                type="checkbox"
                bind:checked={filtrosEstadoCheckbox.cancelada}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Cancelada ({contadorEstados.cancelada})</span>
            </label>
          </div>
          <div class="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" on:click={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Tabla de ventas/facturas -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('numero_factura')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Folio
                {#if getIconoOrden('numero_factura') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('numero_factura') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              Identificador
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('Cliente')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Cliente
                {#if getIconoOrden('Cliente') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('Cliente') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('FechaEmision')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Emisión de factura
                {#if getIconoOrden('FechaEmision') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('FechaEmision') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('FechaVencimiento')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Vencimiento
                {#if getIconoOrden('FechaVencimiento') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('FechaVencimiento') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider">
              Estatus
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('MontoTotal')}
                class="flex items-center justify-end gap-1 cursor-pointer hover:text-gray-900 transition-colors w-full"
              >
                Total
                {#if getIconoOrden('MontoTotal') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('MontoTotal') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider">
              <Settings class="w-4 h-4" />
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if cargando}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="mt-2 text-gray-600">Cargando ventas...</p>
              </td>
            </tr>
          {:else if error}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center">
                <div class="text-red-600">
                  <AlertTriangle class="w-12 h-12 mx-auto mb-2" />
                  <p class="font-medium">Error al cargar ventas</p>
                  <p class="text-sm text-gray-600 mt-1">{error}</p>
                  <div class="mt-4 flex justify-center">
                    <Button
                      variant="primary"
                      size="md"
                      on:click={cargarVentas}
                    >
                      Reintentar
                    </Button>
                  </div>
                </div>
              </td>
            </tr>
          {:else if ventas.length === 0}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center">
                <FileText class="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p class="text-gray-600">No hay ventas</p>
                <p class="text-sm text-gray-500 mt-1">No se encontraron ventas con los filtros aplicados</p>
              </td>
            </tr>
          {:else}
            {#each ventas as venta}
              <tr class="hover:bg-gray-50">
                <!-- Folio -->
                <td class="px-6 py-4">
                  <button
                    on:click={() => irADetalle(venta)}
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    #{venta.numero_venta}
                  </button>
                </td>

                <!-- Identificador -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{venta.identificador || '-'}</div>
                </td>

                <!-- Cliente -->
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">{venta.cliente?.razonSocial || 'N/A'}</div>
                  <div class="text-xs text-gray-500 mt-1">{venta.cliente?.rfc || '-'}</div>
                </td>

                <!-- Emisión de factura -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{formatearFecha(venta.fechaEmision)}</div>
                </td>

                <!-- Vencimiento -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{formatearFecha(venta.fechaVencimiento)}</div>
                </td>

                <!-- Estatus -->
                <td class="px-6 py-4 text-center">
                  <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full {getEstadoBadgeClass(getEstadoCodigo(venta.estado_venta_id || 0))}">
                    {getEstadoNombre(venta.estado_venta_id || 0)}
                  </span>
                </td>

                <!-- Total -->
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="text-sm font-semibold text-gray-900">{formatearMoneda(venta.montoTotal)}</div>
                </td>

                <!-- Menú opciones -->
                <td class="px-6 py-4 text-center relative">
                  <button
                    on:click={() => toggleMenu(venta.id)}
                    class="text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical class="w-5 h-5" />
                  </button>

                  {#if menuAbiertoId === venta.id}
                    <div class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <button
                        on:click={() => {
                          irADetalle(venta);
                          cerrarMenu();
                        }}
                        class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <Eye class="w-4 h-4" />
                        Ver detalle
                      </button>
                      <button
                        on:click={() => abrirModalPago(venta)}
                        class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 border-t border-gray-100"
                      >
                        <CreditCard class="w-4 h-4" />
                        Agregar pago
                      </button>
                      {#if venta.estado_venta_id !== 6}
                        <button
                          on:click={() => abrirModalMotivoCancelacion(venta)}
                          disabled={!venta.Timbrado}
                          class="w-full px-4 py-3 text-left text-sm flex items-center gap-2 border-t border-gray-100 transition-colors {venta.Timbrado ? 'text-red-700 hover:bg-red-50 cursor-pointer' : 'text-gray-400 cursor-not-allowed bg-gray-50'}"
                        >
                          <FileX class="w-4 h-4" />
                          Cancelar factura
                          {#if !venta.Timbrado}
                            <span class="text-xs text-gray-500">(no timbrada)</span>
                          {/if}
                        </button>
                      {/if}
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Paginación -->
    {#if !cargando && !error && ventas.length > 0}
      <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
          <!-- Información de registros -->
          <div class="text-sm text-gray-700">
            Mostrando
            <span class="font-medium">{(paginacion.page - 1) * paginacion.limit + 1}</span>
            a
            <span class="font-medium">{Math.min(paginacion.page * paginacion.limit, paginacion.total)}</span>
            de
            <span class="font-medium">{paginacion.total}</span>
            ventas
          </div>

          <!-- Controles de paginación -->
          <div class="flex items-center gap-2">
            <!-- Botón Anterior -->
            <Button
              variant="secondary"
              size="sm"
              on:click={paginaAnterior}
              disabled={paginacion.page === 1}
            >
              <ChevronLeft class="w-4 h-4" />
            </Button>

            <!-- Números de página -->
            <div class="flex items-center gap-1">
              {#each Array.from({ length: paginacion.totalPages }, (_, i) => i + 1) as numeroPagina}
                {#if numeroPagina === 1 || numeroPagina === paginacion.totalPages || (numeroPagina >= paginacion.page - 1 && numeroPagina <= paginacion.page + 1)}
                  <Button
                    variant={paginacion.page === numeroPagina ? 'primary' : 'secondary'}
                    size="sm"
                    on:click={() => irAPagina(numeroPagina)}
                  >
                    {numeroPagina}
                  </Button>
                {:else if numeroPagina === paginacion.page - 2 || numeroPagina === paginacion.page + 2}
                  <span class="px-2 text-gray-500">...</span>
                {/if}
              {/each}
            </div>

            <!-- Botón Siguiente -->
            <Button
              variant="secondary"
              size="sm"
              on:click={paginaSiguiente}
              disabled={paginacion.page === paginacion.totalPages}
            >
              <ChevronRight class="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Modal 1: Seleccionar Motivo de Cancelación -->
  {#if modalMotivoCancelacionAbierto && ventaSeleccionada}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 class="text-lg font-semibold text-gray-900">Seleccionar Motivo de Cancelación</h2>
          <button
            on:click={cerrarModalMotivoCancelacion}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <div>
            <p class="text-sm text-gray-600 mb-4">
              <strong>Factura:</strong> {ventaSeleccionada.numero_venta}
            </p>
          </div>

          <div class="space-y-3">
            {#each motivosCancelacion as motivo}
              <label class="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors {motivoSeleccionado === motivo.codigo ? 'border-blue-500 bg-blue-50' : ''}">
                <input
                  type="radio"
                  name="motivo"
                  value={motivo.codigo}
                  bind:group={motivoSeleccionado}
                  class="mt-1 w-4 h-4 text-blue-600"
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

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
            <p class="text-xs text-blue-800">
              <strong>Nota:</strong> Selecciona el motivo que mejor describe la razón de la cancelación según los códigos del SAT.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
          <Button
            variant="secondary"
            size="md"
            on:click={cerrarModalMotivoCancelacion}
            class="flex-1"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            on:click={abrirModalConfirmacionCancelacion}
            class="flex-1"
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal 2: Confirmación de Cancelación -->
  {#if modalConfirmacionCancelacionAbierto && ventaSeleccionada}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">Confirmar Cancelación</h2>
          <button
            on:click={cerrarModalConfirmacionCancelacion}
            disabled={cancelando}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-4">
          <div>
            <p class="text-sm text-gray-600 mb-2">
              <strong>Factura:</strong> {ventaSeleccionada.numero_venta}
            </p>
            <p class="text-sm text-gray-600 mb-4">
              <strong>Motivo:</strong> {motivosCancelacion.find(m => m.codigo === motivoSeleccionado)?.nombre}
            </p>
          </div>

          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p class="text-sm text-yellow-800">
              <strong>⚠️ Advertencia:</strong> Esta acción no se puede deshacer. ¿Estás seguro de que deseas proceder con la cancelación?
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="secondary"
            size="md"
            on:click={cerrarModalConfirmacionCancelacion}
            disabled={cancelando}
            class="flex-1"
          >
            Atrás
          </Button>
          <Button
            variant="danger"
            size="md"
            on:click={confirmarCancelacion}
            disabled={cancelando}
            class="flex-1"
          >
            {#if cancelando}
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
              Cancelando...
            {:else}
              Confirmar Cancelación
            {/if}
          </Button>
        </div>
      </div>
    </div>
  {/if}

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
          <IconX class="w-5 h-5" />
        </button>
      </div>
    </div>
  {/if}
</div>
