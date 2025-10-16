<script lang="ts">
  import { onMount } from 'svelte';
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
    Users,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Settings,
    Send,
    MoreVertical
  } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { Button, Input, Badge } from '$lib/components/ui';
  import ModalPago from './ModalPago.svelte';
  import ModalGestion from './ModalGestion.svelte';
  import ModalDetalle from './ModalDetalle.svelte';
  import ModalNuevaFactura from './ModalNuevaFactura.svelte';
  import ModalRecordatorios from './ModalRecordatorios.svelte';
  import type { Factura } from './types';
  import {
    formatearMoneda,
    formatearFecha,
    getEstadoBadgeClass,
    getPrioridadBadgeClass,
    calcularAging,
    calcularMetricas,
    filtrarFacturas
  } from './utils';

  // Estado de filtros
  let filtroTexto = '';
  let filtroEstado = '';
  let filtroPrioridad = '';
  let filtroVencimiento = '';

  // Filtros de checkbox
  let filtrosEstadoCheckbox = {
    pagada: false,
    vigente: false,
    vencida: false,
    cancelada: false
  };
  let mostrarFiltros = false;

  // Contador de facturas por estado
  $: contadorEstados = {
    pagada: facturas.filter(f => f.estado_factura_id === 3).length,
    vigente: facturas.filter(f => f.estado_factura_id === 1).length,
    vencida: facturas.filter(f => f.estado_factura_id === 4).length,
    cancelada: facturas.filter(f => f.estado_factura_id === 5).length
  };

  // Contar filtros activos
  $: filtrosActivos = Object.values(filtrosEstadoCheckbox).filter(v => v).length;

  // Estado de ordenamiento
  let ordenCampo: string = 'FechaEmision'; // Campo por defecto - ordenar por fecha de emisión
  let ordenDireccion: 'ASC' | 'DESC' = 'DESC'; // Dirección por defecto - más recientes primero

  // Estado de modales
  let modalPagoAbierto = false;
  let modalGestionAbierta = false;
  let modalDetalleAbierto = false;
  let modalNuevaFacturaAbierto = false;
  let modalRecordatoriosAbierto = false;
  let abrirFormularioRecordatorio = false;
  let facturaSeleccionada: Factura | null = null;

  // Estado de menú dropdown
  let menuAbiertoId: number | null = null;

  // Estados dinámicos y prioridades (temporal - vendrá del API)
  let estadosFactura = [
    { id: 1, codigo: 'pendiente', nombre: 'Pendiente' },
    { id: 2, codigo: 'parcial', nombre: 'Pago Parcial' },
    { id: 3, codigo: 'pagada', nombre: 'Pagada' },
    { id: 4, codigo: 'vencida', nombre: 'Vencida' },
    { id: 5, codigo: 'incobrable', nombre: 'Incobrable' }
  ];

  let prioridadesCobranza = [
    { id: 1, codigo: 'alta', nombre: 'Alta' },
    { id: 2, codigo: 'media', nombre: 'Media' },
    { id: 3, codigo: 'baja', nombre: 'Baja' }
  ];

  // Datos de la API
  let facturas: Factura[] = [];
  let agingData: any = null;
  let paginacion = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  };
  let cargando = true;
  let error = '';

  // Estadísticas de recordatorios por factura
  let recordatoriosStats: Record<number, { total: number; vistos: number; noVistos: number }> = {};

  // Métricas calculadas dinámicamente
  $: metricas = {
    totalPorCobrar: agingData?.montoTotal || 0,
    facturasPendientes: agingData?.totalFacturas || 0,
    // Corregido: usar el estado de la base de datos para facturas vencidas
    facturasVencidas: facturas.filter(f => {
      // Estado 4 = vencida según la base de datos
      return f.estado_factura_id === 4;
    }).length,
    promedioCobranza: facturas.length > 0 ? facturas.reduce((sum, f) => sum + (f.diasVencido || 0), 0) / facturas.length : 0
  };

  // Aging de cartera calculado desde API
  $: aging = agingData ? {
    actual: { cantidad: agingData.rango0_30?.count || 0, monto: agingData.rango0_30?.monto || 0 },
    dias30: { cantidad: agingData.rango31_60?.count || 0, monto: agingData.rango31_60?.monto || 0 },
    dias60: { cantidad: agingData.rango61_90?.count || 0, monto: agingData.rango61_90?.monto || 0 },
    dias90: { cantidad: agingData.rango91_mas?.count || 0, monto: agingData.rango91_mas?.monto || 0 }
  } : {
    actual: { cantidad: 0, monto: 0 },
    dias30: { cantidad: 0, monto: 0 },
    dias60: { cantidad: 0, monto: 0 },
    dias90: { cantidad: 0, monto: 0 }
  };

  // Funciones auxiliares
  function getEstadoNombre(estadoId: number): string {
    if (!estadoId || !estadosFactura || estadosFactura.length === 0) return 'Desconocido';
    const estado = estadosFactura.find(e => e.id === estadoId);
    return estado?.nombre || 'Desconocido';
  }

  function getPrioridadNombre(prioridadId: number): string {
    if (!prioridadId || !prioridadesCobranza || prioridadesCobranza.length === 0) return 'Desconocido';
    const prioridad = prioridadesCobranza.find(p => p.id === prioridadId);
    return prioridad?.nombre || 'Desconocido';
  }

  function getEstadoCodigo(estadoId: number): string {
    if (!estadoId || !estadosFactura || estadosFactura.length === 0) return 'desconocido';
    const estado = estadosFactura.find(e => e.id === estadoId);
    return estado?.codigo || 'desconocido';
  }

  function getPrioridadCodigo(prioridadId: number): string {
    if (!prioridadId || !prioridadesCobranza || prioridadesCobranza.length === 0) return 'desconocido';
    const prioridad = prioridadesCobranza.find(p => p.id === prioridadId);
    return prioridad?.codigo || 'desconocido';
  }

  // Funciones de modal
  function abrirModalPago(factura: Factura) {
    facturaSeleccionada = factura;
    modalPagoAbierto = true;
  }

  function abrirModalGestion(factura: Factura) {
    facturaSeleccionada = factura;
    modalGestionAbierta = true;
  }

  function irADetalle(factura: Factura) {
    goto(`/dashboard/por-cobrar/${factura.id}`);
  }

  function cerrarModales() {
    modalPagoAbierto = false;
    modalGestionAbierta = false;
    modalDetalleAbierto = false;
    modalNuevaFacturaAbierto = false;
    modalRecordatoriosAbierto = false;
    abrirFormularioRecordatorio = false;
    facturaSeleccionada = null;
  }

  function abrirModalNuevaFactura() {
    modalNuevaFacturaAbierto = true;
  }

  function abrirModalRecordatorios(factura: Factura, abrirFormulario = false) {
    facturaSeleccionada = factura;
    modalRecordatoriosAbierto = true;
    abrirFormularioRecordatorio = abrirFormulario;
  }

  // Handlers de eventos de modales
  function handlePagoGuardado(event: any) {
    // Aquí actualizarías la lista de facturas
    // En producción, recargar desde API o actualizar localmente
  }

  function handleGestionGuardada(event: any) {
    // Aquí actualizarías la lista de facturas
  }

  function handleFacturaCreada(event: any) {
    // Recargar lista de facturas
    cargarFacturas();
  }

  function handleRecordatorioCreado(event: any) {
    // Recargar las estadísticas de recordatorios
    if (facturaSeleccionada) {
      cargarRecordatoriosFactura(facturaSeleccionada.id);
    }
  }

  // Función para cargar recordatorios de una factura específica
  async function cargarRecordatoriosFactura(facturaId: number) {
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');
      if (!organizacionId) return;

      const response = await authFetch(`/api/facturas/${facturaId}/recordatorios?organizacionId=${organizacionId}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          recordatoriosStats[facturaId] = {
            total: data.stats.Total || 0,
            vistos: data.stats.Vistos || 0,
            noVistos: data.stats.NoVistos || 0
          };
          // Forzar actualización reactiva
          recordatoriosStats = recordatoriosStats;
        }
      }
    } catch (error) {
      console.error('Error al cargar recordatorios:', error);
    }
  }

  // Función para cargar recordatorios de todas las facturas visibles
  async function cargarTodosLosRecordatorios() {
    for (const factura of facturas) {
      await cargarRecordatoriosFactura(factura.id);
    }
  }

  // Funciones para el menú dropdown
  function toggleMenu(facturaId: number) {
    menuAbiertoId = menuAbiertoId === facturaId ? null : facturaId;
  }

  function cerrarMenu() {
    menuAbiertoId = null;
  }


  // Función para cargar facturas desde API
  async function cargarFacturas() {
    cargando = true;
    error = '';

    try {
      // Obtener organizacionId actual de sessionStorage
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
      if (filtroPrioridad) {
        params.append('prioridad', filtroPrioridad);
      }

      // Agregar filtros de checkbox
      const estadosSeleccionados = [];
      if (filtrosEstadoCheckbox.pagada) estadosSeleccionados.push('3'); // Estado 3 = Pagada
      if (filtrosEstadoCheckbox.vigente) estadosSeleccionados.push('1'); // Estado 1 = Vigente/Pendiente
      if (filtrosEstadoCheckbox.vencida) estadosSeleccionados.push('4'); // Estado 4 = Vencida
      if (filtrosEstadoCheckbox.cancelada) estadosSeleccionados.push('5'); // Estado 5 = Cancelada

      if (estadosSeleccionados.length > 0) {
        params.append('estados', estadosSeleccionados.join(','));
      }

      const response = await authFetch(`/api/facturas?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Convertir formato API al formato esperado por la página
        facturas = data.facturas.map((f: any) => ({
          id: f.id,
          numero_factura: f.numeroFactura,
          clienteId: f.clienteId,
          cliente: {
            id: f.cliente.id,
            razonSocial: f.cliente.razonSocial,
            rfc: f.cliente.rfc
          },
          montoTotal: f.montoTotal,
          saldoPendiente: f.saldoPendiente,
          fechaEmision: f.fechaEmision,
          fechaVencimiento: f.fechaVencimiento,
          diasVencido: f.diasVencido,
          estado_factura_id: f.estado.id,
          prioridad_cobranza_id: f.prioridad.id,
          ultimaGestion: f.ultimaGestion,
          createdAt: f.createdAt
        }));

        agingData = data.aging;
        paginacion = { ...paginacion, ...data.pagination };

        // Cargar estadísticas de recordatorios para las facturas cargadas
        cargarTodosLosRecordatorios();
      } else {
        error = data.error || 'Error al cargar facturas';
      }
    } catch (err) {
      error = 'Error al conectar con el servidor';
    } finally {
      cargando = false;
    }
  }

  // Funciones de filtrado
  function aplicarFiltros() {
    paginacion.page = 1; // Reset a primera página
    cargarFacturas();
  }

  function limpiarFiltros() {
    filtroTexto = '';
    filtroEstado = '';
    filtroPrioridad = '';
    aplicarFiltros();
  }

  function toggleFiltros() {
    mostrarFiltros = !mostrarFiltros;
  }

  function aplicarFiltrosCheckbox() {
    paginacion.page = 1;
    cargarFacturas();
  }

  // Funciones de navegación de páginas
  function irAPagina(numeroPagina: number) {
    if (numeroPagina >= 1 && numeroPagina <= paginacion.totalPages) {
      paginacion.page = numeroPagina;
      cargarFacturas();
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
      // Si ya está ordenando por este campo, cambiar dirección
      ordenDireccion = ordenDireccion === 'ASC' ? 'DESC' : 'ASC';
    } else {
      // Si es un campo nuevo, ordenar ascendente
      ordenCampo = campo;
      ordenDireccion = 'ASC';
    }
    paginacion.page = 1; // Reset a primera página
    cargarFacturas();
  }

  // Función para obtener icono de ordenamiento
  function getIconoOrden(campo: string): 'up' | 'down' | 'none' {
    if (ordenCampo !== campo) return 'none';
    return ordenDireccion === 'ASC' ? 'up' : 'down';
  }

  onMount(() => {
    // Cargar datos iniciales
    cargarFacturas();

    // Listener para cerrar menú al hacer click fuera
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        cerrarMenu();
      }
    };
    document.addEventListener('click', handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="space-y-6">
  <!-- Header simple con botones -->
  <div class="flex items-center justify-between">
    <div>
      <!-- <h1 class="text-2xl font-bold text-gray-900">Por Cobrar</h1> -->
      <p class="text-sm text-gray-600 mt-1">Impulsa el crecimiento de tu empresa, revisa el estado de tus facturas, envía recordatorios a tus clientes y cobra tus facturas a tiempo.</p>
    </div>
    <div class="flex gap-3">
      <!-- <Button variant="primary" size="md">
        IMPORTAR
      </Button> -->
      <Button
        variant="success"
        size="md"
        on:click={() => goto('/dashboard/por-cobrar/nueva')}
      >
        Generar Factura
      </Button>
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
            placeholder="Buscar por cliente, folio o uuid"
            bind:value={filtroTexto}
            on:input={aplicarFiltros}
            class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full transition-all duration-200"
          />
        </div>

        <!-- Filtro Periodo -->
        <select class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] transition-all duration-200">
          <option value="">Periodo</option>
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="trimestre">Este trimestre</option>
        </select>

        <!-- Botón Filtros -->
        <Button variant="secondary" size="md" on:click={toggleFiltros}>
          <Filter class="w-4 h-4" />
          Filtros({filtrosActivos})
        </Button>
      </div>

      <!-- Panel de filtros desplegable -->
      {#if mostrarFiltros}
        <div class="px-4 py-3 bg-gray-50 border-t border-gray-200">
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
                bind:checked={filtrosEstadoCheckbox.vigente}
                on:change={aplicarFiltrosCheckbox}
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="text-sm text-gray-700">Vigente ({contadorEstados.vigente})</span>
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
        </div>
      {/if}
    </div>

    <!-- Tabla de facturas -->
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
              <button
                on:click={() => cambiarOrden('MontoTotal')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Monto
                {#if getIconoOrden('MontoTotal') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('MontoTotal') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('SaldoPendiente')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Adeudo
                {#if getIconoOrden('SaldoPendiente') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('SaldoPendiente') === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 tracking-wider">
              <button
                on:click={() => cambiarOrden('CreatedAt')}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors"
              >
                Creación
                {#if getIconoOrden('CreatedAt') === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getIconoOrden('CreatedAt') === 'down'}
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
              Recordatorios
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider">
              Estatus
            </th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider">
              <div class="flex items-center justify-center gap-1">
                <Settings class="w-4 h-4" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#if cargando}
            <tr>
              <td colspan="9" class="px-6 py-12 text-center">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p class="mt-2 text-gray-600">Cargando facturas...</p>
              </td>
            </tr>
          {:else if error}
            <tr>
              <td colspan="9" class="px-6 py-12 text-center">
                <div class="text-red-600">
                  <AlertTriangle class="w-12 h-12 mx-auto mb-2" />
                  <p class="font-medium">Error al cargar facturas</p>
                  <p class="text-sm text-gray-600 mt-1">{error}</p>
                  <div class="mt-4 flex justify-center">
                    <Button
                      variant="primary"
                      size="md"
                      on:click={cargarFacturas}
                    >
                      Reintentar
                    </Button>
                  </div>
                </div>
              </td>
            </tr>
          {:else if facturas.length === 0}
            <tr>
              <td colspan="9" class="px-6 py-12 text-center">
                <FileText class="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p class="text-gray-600">No hay facturas</p>
                <p class="text-sm text-gray-500 mt-1">No se encontraron facturas con los filtros aplicados</p>
              </td>
            </tr>
          {:else}
            {#each facturas as factura}
              <tr class="hover:bg-gray-50">
                <!-- Folio -->
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <button
                      on:click={() => irADetalle(factura)}
                      class="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      #{factura.numero_factura}
                    </button>
                  </div>
                  <div class="text-xs text-gray-500 mt-1">{factura.cliente?.razonSocial || 'N/A'}</div>
                </td>

                <!-- Monto -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{formatearMoneda(factura.montoTotal)}</div>
                </td>

                <!-- Adeudo -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">{formatearMoneda(factura.saldoPendiente || 0)}</div>
                </td>

                <!-- Creación -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{formatearFecha(factura.createdAt || factura.fechaEmision)}</div>
                </td>

                <!-- Emisión de factura -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{formatearFecha(factura.fechaEmision)}</div>
                </td>

                <!-- Vencimiento -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{formatearFecha(factura.fechaVencimiento)}</div>
                </td>

                <!-- Recordatorios -->
                <td class="px-6 py-4 text-center">
                  <div class="flex items-center justify-center gap-3">
                    <!-- Contador de recordatorios enviados -->
                    <div class="flex items-center gap-1" title="Recordatorios enviados">
                      <Send class="w-3 h-3 text-blue-500" />
                      <span class="text-xs text-gray-600 font-medium">
                        {recordatoriosStats[factura.id]?.total || 0}
                      </span>
                    </div>
                    <!-- Contador de recordatorios vistos -->
                    <div class="flex items-center gap-1" title="Correos abiertos">
                      <Eye class="w-3 h-3 {recordatoriosStats[factura.id]?.vistos > 0 ? 'text-green-500' : 'text-gray-400'}" />
                      <span class="text-xs {recordatoriosStats[factura.id]?.vistos > 0 ? 'text-green-600 font-medium' : 'text-gray-600'}">
                        {recordatoriosStats[factura.id]?.vistos || 0}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Estatus -->
                <td class="px-6 py-4 text-center">
                  <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full {getEstadoBadgeClass(getEstadoCodigo(factura.estado_factura_id || 0))}">
                    {getEstadoNombre(factura.estado_factura_id || 0)}
                  </span>
                </td>

                <!-- Menú opciones -->
                <td class="px-6 py-4 text-center relative">
                  <button
                    on:click={() => toggleMenu(factura.id)}
                    class="text-gray-400 hover:text-gray-600"
                  >
                    <MoreVertical class="w-5 h-5" />
                  </button>

                  {#if menuAbiertoId === factura.id}
                    <div class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <button
                        on:click={() => {
                          abrirModalRecordatorios(factura, true);
                          cerrarMenu();
                        }}
                        class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                      >
                        <Send class="w-4 h-4" />
                        Enviar recordatorio
                      </button>
                      <button
                        on:click={() => {
                          abrirModalRecordatorios(factura, false);
                          cerrarMenu();
                        }}
                        class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 border-t border-gray-100"
                      >
                        <Clock class="w-4 h-4" />
                        Historial
                      </button>
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
    {#if !cargando && !error && facturas.length > 0}
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
            facturas
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

<!-- Modales -->
<ModalPago
  bind:abierto={modalPagoAbierto}
  factura={facturaSeleccionada}
  on:cerrar={cerrarModales}
  on:pagoGuardado={handlePagoGuardado}
/>

<ModalGestion
  bind:abierto={modalGestionAbierta}
  factura={facturaSeleccionada}
  on:cerrar={cerrarModales}
  on:gestionGuardada={handleGestionGuardada}
/>

<ModalDetalle
  bind:abierto={modalDetalleAbierto}
  factura={facturaSeleccionada}
  on:cerrar={cerrarModales}
/>

<ModalNuevaFactura
  bind:abierto={modalNuevaFacturaAbierto}
  on:cerrar={cerrarModales}
  on:facturaCreada={handleFacturaCreada}
/>

<ModalRecordatorios
  bind:abierto={modalRecordatoriosAbierto}
  bind:abrirFormulario={abrirFormularioRecordatorio}
  factura={facturaSeleccionada}
  on:cerrar={cerrarModales}
  on:recordatorioCreado={handleRecordatorioCreado}
/>