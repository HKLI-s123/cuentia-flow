<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';
  import { goto } from '$app/navigation';
  import {
    DollarSign,
    TrendingUp,
    AlertTriangle,
    Calendar,
    Search,
    Filter,
    Plus,
    Eye,
    FileText,
    CreditCard,
    Clock,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Settings,
    Send,
    MoreVertical,
    Trash2,
    CheckCircle,
    XCircle
  } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import Swal from 'sweetalert2';
  import { Button, Input, Badge, Table } from '$lib/components/ui';
  import type { Pago, Paginacion } from './types';
  import {
    formatearMoneda,
    formatearFecha,
    getMetodoNombre,
    calcularMetricas
  } from './utils';
  import ModalAgregarPago from './ModalAgregarPago.svelte';
  import ModalDetallePago from './ModalDetallePago.svelte';

  // Estado de filtros
  let filtroTexto = '';

  // Filtros de checkbox
  let filtrosEstadoCheckbox = {
    pendiente: false,
    aplicado: false,
    rechazado: false
  };
  let mostrarFiltros = false;

  // Contar filtros activos
  $: filtrosActivos = Object.values(filtrosEstadoCheckbox).filter(v => v).length;

  // Estado de ordenamiento
  let ordenCampo: string = 'fechaPago';
  let ordenDireccion: 'ASC' | 'DESC' = 'DESC';

  // Estado de modales
  let modalPagoAbierto = false;
  let modalAgregarPagoAbierto = false;
  let pagoSeleccionado: Pago | null = null;

  // Estado de menú dropdown
  let menuAbiertoId: number | null = null;

  // Datos de la API
  let pagos: Pago[] = [];
  let cargando = false;
  let error: string | null = null;
  let paginacion: Paginacion = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  };

  // Métricas
  let metricas: any = null;

  // Organización ID
  let organizacionId = '';

  // Notificación de comprobantes nuevos subidos a nivel factura
  let facturasConComprobantesNuevos: any[] = [];
  let bannerComprobantesVisible = false;

  async function cargarComprobantesNuevos() {
    try {
      const orgId = get(orgIdStore)?.toString() || '';
      if (!orgId) return;

      const resp = await authFetch(`/api/facturas/comprobantes-nuevos?organizacionId=${orgId}`);
      const data = await resp.json();

      if (data.success) {
        const dismissados = JSON.parse(localStorage.getItem('comprobantes_vistos') || '[]');
        facturasConComprobantesNuevos = (data.facturas || []).filter((f: any) => !dismissados.includes(f.facturaid));
        bannerComprobantesVisible = facturasConComprobantesNuevos.length > 0;
      }
    } catch (err) {
      console.error('Error cargando comprobantes nuevos:', err);
    }
  }

  function cerrarBannerComprobantes() {
    const ids = facturasConComprobantesNuevos.map(f => f.facturaid);
    const dismissados = JSON.parse(localStorage.getItem('comprobantes_vistos') || '[]');
    const nuevos = [...new Set([...dismissados, ...ids])];
    localStorage.setItem('comprobantes_vistos', JSON.stringify(nuevos));
    bannerComprobantesVisible = false;
  }

  /**
   * Carga los pagos del API
   */
  async function cargarPagos() {
    cargando = true;
    error = null;

    try {
      // Obtener organizacionId actual del store
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) {
        error = 'No se ha seleccionado una organización';
        return;
      }

      // Construir query string
      const queryParams = new URLSearchParams({
        organizacionId,
        page: paginacion.page.toString(),
        limit: paginacion.limit.toString(),
        ordenCampo,
        ordenDireccion,
        ...(filtroTexto && { cliente: filtroTexto })
      });

      // Agregar filtros de estado seleccionados
      const estadosFiltrados = Object.entries(filtrosEstadoCheckbox)
        .filter(([_, checked]) => checked)
        .map(([estado]) => {
          switch (estado) {
            case 'pendiente': return '1';
            case 'aplicado': return '2';
            case 'rechazado': return '3';
            default: return '';
          }
        })
        .filter(e => e);

      if (estadosFiltrados.length > 0) {
        queryParams.set('estados', estadosFiltrados.join(','));
      }

      const response = await authFetch(`/api/pagos?${queryParams}`);
      const data = await response.json();

      if (data.success) {
        pagos = data.pagos || [];
        paginacion = data.pagination;
        metricas = calcularMetricas(pagos);
      } else {
        error = data.message || 'Error al cargar pagos';
      }
    } catch (err) {
      if (error === 'No se ha seleccionado una organización') {
        // Ya está establecido el error
      } else {
        error = err instanceof Error ? err.message : 'Error desconocido';
      }
      console.error('Error loading pagos:', err);
    } finally {
      cargando = false;
    }
  }

  /**
   * Aplica los filtros de texto
   */
  function aplicarFiltros() {
    paginacion.page = 1;
    cargarPagos();
  }

  /**
   * Aplica los filtros de checkbox
   */
  function aplicarFiltrosCheckbox() {
    paginacion.page = 1;
    cargarPagos();
  }

  /**
   * Limpia todos los filtros
   */
  function limpiarFiltros() {
    filtroTexto = '';
    filtrosEstadoCheckbox = {
      pendiente: false,
      aplicado: false,
      rechazado: false
    };
    paginacion.page = 1;
    cargarPagos();
  }

  /**
   * Alterna la visibilidad del panel de filtros
   */
  function toggleFiltros() {
    mostrarFiltros = !mostrarFiltros;
  }

  /**
   * Abre el menú de acciones
   */
  function toggleMenu(pagoId: number) {
    menuAbiertoId = menuAbiertoId === pagoId ? null : pagoId;
  }

  /**
   * Cierra el menú de acciones
   */
  function cerrarMenu() {
    menuAbiertoId = null;
  }

  /**
   * Navega a la página especificada
   */
  function irAPagina(numeroPagina: number) {
    if (numeroPagina >= 1 && numeroPagina <= paginacion.totalPages) {
      paginacion.page = numeroPagina;
      cargarPagos();
    }
  }

  /**
   * Ir a página anterior
   */
  function paginaAnterior() {
    if (paginacion.page > 1) {
      irAPagina(paginacion.page - 1);
    }
  }

  /**
   * Ir a página siguiente
   */
  function paginaSiguiente() {
    if (paginacion.page < paginacion.totalPages) {
      irAPagina(paginacion.page + 1);
    }
  }

  /**
   * Cambia el ordenamiento
   */
  function cambiarOrden(campo: string) {
    if (ordenCampo === campo) {
      ordenDireccion = ordenDireccion === 'ASC' ? 'DESC' : 'ASC';
    } else {
      ordenCampo = campo;
      ordenDireccion = 'ASC';
    }
    paginacion.page = 1;
    cargarPagos();
  }

  /**
   * Obtiene el icono de ordenamiento
   */
  function getIconoOrden(campo: string): 'up' | 'down' | 'none' {
    if (ordenCampo !== campo) return 'none';
    return ordenDireccion === 'ASC' ? 'up' : 'down';
  }

  /**
   * Abre modal de visualización de pago
   */
  function abrirModalPago(pago: Pago) {
    pagoSeleccionado = pago;
    modalPagoAbierto = true;
    cerrarMenu();
  }

  /**
   * Cancela un pago (desde la tabla)
   */
  async function cancelarPagoDesdeTabla(pagoId: number) {
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Cancelar pago?',
      html: `<p>Esta acción cancelará el pago <strong>#${pagoId}</strong> y revertirá el saldo en la factura.</p>`,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, cancelar pago',
      cancelButtonText: 'Volver'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) {
        await Swal.fire({ icon: 'warning', title: 'Sin organización', text: 'No se ha seleccionado una organización.', confirmButtonColor: '#3b82f6' });
        return;
      }

      const response = await authFetch(
        `/api/pagos/${pagoId}/cancelar?organizacionId=${organizacionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: '02' })
        }
      );
      const data = await response.json();

      if (data.success) {
        await Swal.fire({ icon: 'success', title: 'Pago cancelado', text: 'El pago se ha cancelado exitosamente.', timer: 2000, showConfirmButton: false });
        cargarPagos();
      } else {
        await Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Error al cancelar pago', confirmButtonColor: '#3b82f6' });
      }
    } catch (err) {
      console.error('Error cancelling pago:', err);
      await Swal.fire({ icon: 'error', title: 'Error', text: 'Error al cancelar pago', confirmButtonColor: '#3b82f6' });
    }
  }

  onMount(() => {
    organizacionId = get(orgIdStore)?.toString() || '';
    cargarPagos();
    cargarComprobantesNuevos();

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
  <!-- Header simple con botones -->
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm text-gray-600 mt-1">Gestiona los pagos de tus clientes y mantén el control de tu flujo de caja.</p>
    </div>
    <div class="flex gap-3">
      <Button
        variant="primary"
        size="md"
        on:click={() => (modalAgregarPagoAbierto = true)}
      >
        <Plus class="w-4 h-4" />
        Nuevo Pago
      </Button>
    </div>
  </div>

  {#if bannerComprobantesVisible}
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <AlertTriangle class="w-5 h-5 text-amber-600 mt-0.5" />
        <div>
          <p class="text-sm font-semibold text-amber-900">Hay comprobantes nuevos por revisar</p>
          <p class="text-sm text-amber-800 mt-1">
            {facturasConComprobantesNuevos.length} factura{facturasConComprobantesNuevos.length === 1 ? '' : 's'} tiene{facturasConComprobantesNuevos.length === 1 ? '' : 'n'} comprobantes subidos por el cliente.
          </p>
          <div class="mt-2 text-xs text-amber-700">
            {#each facturasConComprobantesNuevos.slice(0, 3) as factura}
              <div>Factura #{factura.numero_factura} - {factura.clientenombre} ({factura.nuevos} nuevo{factura.nuevos === '1' ? '' : 's'})</div>
            {/each}
          </div>
        </div>
      </div>
      <button
        type="button"
        on:click={cerrarBannerComprobantes}
        class="text-amber-700 hover:text-amber-900 text-sm font-medium"
      >
        Cerrar
      </button>
    </div>
  {/if}

  <!-- Métricas (Tarjetas de resumen) -->
  {#if metricas && !cargando}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Total Pagos -->
      <div class="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 font-medium">Total de Pagos</p>
            <p class="text-2xl font-bold text-gray-900 mt-2">{metricas.totalPagos}</p>
            <p class="text-xs text-gray-500 mt-1">Registrados en el sistema</p>
          </div>
          <CreditCard class="w-12 h-12 text-blue-500 opacity-20" />
        </div>
      </div>

      <!-- Monto Total -->
      <div class="bg-white rounded-xl shadow-sm border border-green-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 font-medium">Monto Total</p>
            <p class="text-2xl font-bold text-gray-900 mt-2">{formatearMoneda(metricas.montoTotal)}</p>
            <p class="text-xs text-gray-500 mt-1">Promedio: {formatearMoneda(metricas.montoPromedio)}</p>
          </div>
          <TrendingUp class="w-12 h-12 text-green-500 opacity-20" />
        </div>
      </div>

      <!-- Pago Más Reciente -->
      <div class="bg-white rounded-xl shadow-sm border border-purple-200 p-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-600 font-medium">Pago Más Reciente</p>
            <p class="text-2xl font-bold text-gray-900 mt-2">{metricas.pagoMasReciente ? formatearFecha(metricas.pagoMasReciente) : 'N/A'}</p>
            <p class="text-xs text-gray-500 mt-1">Última registrado</p>
          </div>
          <Calendar class="w-12 h-12 text-purple-500 opacity-20" />
        </div>
      </div>
    </div>
  {/if}

  <!-- Filtros y búsqueda -->
  <div class="bg-white rounded-xl shadow-sm border">
    <div class="p-4 border-b border-gray-200">
      <div class="flex flex-col sm:flex-row gap-3">
        <!-- Búsqueda -->
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Buscar por cliente, folio o referencia"
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

        <!-- Botón Limpiar Filtros -->
        {#if filtrosActivos > 0 || filtroTexto}
          <Button variant="outline" size="md" on:click={limpiarFiltros}>
            <XCircle class="w-4 h-4" />
            Limpiar
          </Button>
        {/if}
      </div>

      <!-- Panel de filtros desplegable -->
      {#if mostrarFiltros}
        <div class="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div class="flex flex-col gap-2">
            <p class="text-sm text-gray-600 mb-2">Filtrar por método de pago:</p>
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
              <input
                type="checkbox"
                bind:checked={filtrosEstadoCheckbox.pendiente}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Efectivo</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
              <input
                type="checkbox"
                bind:checked={filtrosEstadoCheckbox.aplicado}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Transferencia Bancaria</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
              <input
                type="checkbox"
                bind:checked={filtrosEstadoCheckbox.rechazado}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Otros Métodos</span>
            </label>
          </div>
        </div>
      {/if}
    </div>

    <!-- Tabla de pagos -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('id')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                ID
                {#if getIconoOrden('id') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('id') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              Factura
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              Cliente
            </th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('monto')}
                class="flex items-center justify-end gap-1 cursor-pointer hover:text-gray-900 transition-colors w-full"
              >
                Monto
                {#if getIconoOrden('monto') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('monto') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('fechaPago')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Fecha Pago
                {#if getIconoOrden('fechaPago') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('fechaPago') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('metodo')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Método
                {#if getIconoOrden('metodo') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('metodo') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider">
              Estado
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider">
              <Settings class="w-4 h-4 inline" />
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if cargando}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="mt-2 text-gray-600">Cargando pagos...</p>
              </td>
            </tr>
          {:else if error}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center">
                <div class="text-red-600">
                  <AlertTriangle class="w-12 h-12 mx-auto mb-2" />
                  <p class="font-medium">Error al cargar pagos</p>
                  <p class="text-sm text-gray-600 mt-1">{error}</p>
                  <div class="mt-4 flex justify-center">
                    <Button variant="primary" size="md" on:click={cargarPagos}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              </td>
            </tr>
          {:else if pagos.length === 0}
            <tr>
              <td colspan="8" class="px-6 py-12 text-center">
                <FileText class="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p class="text-gray-600">No hay pagos registrados</p>
                <p class="text-sm text-gray-500 mt-1">No se encontraron pagos con los filtros aplicados</p>
              </td>
            </tr>
          {:else}
            {#each pagos as pago (pago.id)}
              <tr class="hover:bg-gray-50">
                <!-- ID -->
                <td class="px-6 py-4">
                  <button
                    on:click={() => abrirModalPago(pago)}
                    class="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none p-0"
                  >
                    #{pago.id}
                  </button>
                </td>

                <!-- Factura -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{pago.factura?.numero_factura || 'N/A'}</div>
                </td>

                <!-- Cliente -->
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">{pago.factura?.cliente?.razonSocial || 'N/A'}</div>
                </td>

                <!-- Monto -->
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="text-sm font-medium text-gray-900">{formatearMoneda(pago.monto)}</div>
                </td>

                <!-- Fecha Pago -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{formatearFecha(pago.fechaPago)}</div>
                </td>

                <!-- Método -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{getMetodoNombre(pago.metodo)}</div>
                </td>

                <!-- Estado -->
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  {#if pago.cancelado}
                    <Badge variant="danger">Cancelado</Badge>
                  {:else}
                    <Badge variant="success">Vigente</Badge>
                  {/if}
                </td>

                <!-- Menú opciones -->
                <td class="px-6 py-4 text-center relative">
                  <button
                    on:click={() => toggleMenu(pago.id)}
                    class="text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical class="w-5 h-5" />
                  </button>

                  {#if menuAbiertoId === pago.id}
                    <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <button
                        on:click={() => abrirModalPago(pago)}
                        class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <Eye class="w-4 h-4" />
                        Ver Detalle
                      </button>
                      {#if !pago.cancelado}
                      <button
                        on:click={() => {
                          cancelarPagoDesdeTabla(pago.id);
                          cerrarMenu();
                        }}
                        class="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-gray-100"
                      >
                        <Trash2 class="w-4 h-4" />
                        Cancelar Pago
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
    {#if !cargando && !error && pagos.length > 0}
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
            pagos
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
</div>

<!-- Modal Agregar Pago -->
<ModalAgregarPago
  bind:open={modalAgregarPagoAbierto}
  {organizacionId}
  on:pagoGuardado={() => {
    cargarPagos();
  }}
  on:cerrar={() => {
    modalAgregarPagoAbierto = false;
  }}
/>

<!-- Modal Detalle Pago -->
<ModalDetallePago
  bind:open={modalPagoAbierto}
  pagoId={pagoSeleccionado?.id ?? null}
  {organizacionId}
  on:cancelar={async (e) => {
    const pagoId = e.detail?.pagoId;
    if (!pagoId) return;
    
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Cancelar pago?',
      html: `<p>Esta acción cancelará el pago <strong>#${pagoId}</strong> y revertirá el saldo en la factura.</p>`,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, cancelar pago',
      cancelButtonText: 'No, volver'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const response = await authFetch(
        `/api/pagos/${pagoId}/cancelar?organizacionId=${organizacionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motivo: '02' })
        }
      );
      const data = await response.json();

      if (data.success) {
        await Swal.fire({ icon: 'success', title: 'Pago cancelado', text: data.message || 'El pago se ha cancelado exitosamente.', timer: 2500, showConfirmButton: false });
      } else {
        await Swal.fire({ icon: 'error', title: 'Error al cancelar', text: data.error || 'No se pudo cancelar el pago.', confirmButtonColor: '#3b82f6' });
      }
    } catch (err) {
      console.error('Error cancelling pago:', err);
      await Swal.fire({ icon: 'error', title: 'Error', text: 'Error al cancelar el pago.', confirmButtonColor: '#3b82f6' });
    }

    modalPagoAbierto = false;
    cargarPagos();
  }}
/>
