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
    FileText,
    CreditCard,
    Clock,
    Users,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Settings,
    Send,
    MoreVertical,
    FileX,
    X as IconX
  } from 'lucide-svelte';
  import Swal from 'sweetalert2';
  import { authFetch } from '$lib/api';
  import { hoyLocal, fechaLocal } from '$lib/utils/date';
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

  // Contador de facturas por estado (viene del backend)
  let contadorEstados = {
    pagada: 0,
    vigente: 0,
    vencida: 0,
    cancelada: 0
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

  // Estado de cancelación
  let modalMotivoCancelacionAbierto = false;
  let modalConfirmacionCancelacionAbierto = false;
  let motivoSeleccionado = '01';
  let sustitucionId = '';
  let cancelando = false;

  // Motivos de cancelación según SAT
  const motivosCancelacion = [
    { codigo: '01', nombre: 'Comprobante emitido con errores con relación', descripcion: 'Cuando la factura contiene algún error y ya se ha emitido el comprobante que la sustituye.' },
    { codigo: '02', nombre: 'Comprobante emitido con errores sin relación', descripcion: 'Cuando la factura contiene algún error y no se requiere relacionar con otra factura.' },
    { codigo: '03', nombre: 'No se llevó a cabo la operación', descripcion: 'Cuando la venta o transacción no se concretó.' },
    { codigo: '04', nombre: 'Operación nominativa relacionada en la factura global', descripcion: 'Cuando se requiere cancelar una factura al público en general porque el cliente solicita su comprobante.' }
  ];

  // Estados dinámicos y prioridades (temporal - vendrá del API)
  let estadosFactura = [
    { id: 1, codigo: 'pendiente', nombre: 'Pendiente' },
    { id: 2, codigo: 'parcial', nombre: 'Pago Parcial' },
    { id: 3, codigo: 'pagada', nombre: 'Pagada' },
    { id: 4, codigo: 'vencida', nombre: 'Vencida' },
    { id: 5, codigo: 'incobrable', nombre: 'Incobrable' },
    { id: 6, codigo: 'cancelada', nombre: 'Cancelada' }
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
  let recordatoriosStats: Record<number, { total: number; enviados: number; fallidos: number }> = {};

  // Timer para debounce de búsqueda
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Variable para periodo seleccionado
  let filtroPeriodo = '';

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
    goto(`/dashboard/facturacion/${factura.id}`);
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
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) return;

      const response = await authFetch(`/api/facturas/${facturaId}/recordatorios?organizacionId=${organizacionId}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          recordatoriosStats[facturaId] = {
            total: data.stats.total || 0,
            enviados: data.stats.Enviados || 0,
            fallidos: data.stats.Fallidos || 0
          };
          // Forzar actualización reactiva
          recordatoriosStats = recordatoriosStats;
        }
      }
    } catch (error) {
      console.error('Error al cargar recordatorios:', error);
    }
  }

  // Función para cargar recordatorios de todas las facturas visibles (batch)
  async function cargarTodosLosRecordatorios() {
    if (facturas.length === 0) return;

    try {
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) return;

      const facturaIds = facturas.map(f => f.id).join(',');
      const response = await authFetch(`/api/facturas/recordatorios-stats?organizacionId=${organizacionId}&facturaIds=${facturaIds}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats) {
          for (const [facturaId, stats] of Object.entries(data.stats)) {
            const s = stats as { total: number; enviados: number; fallidos: number };
            recordatoriosStats[parseInt(facturaId)] = {
              total: s.total || 0,
              enviados: s.enviados || 0,
              fallidos: s.fallidos || 0
            };
          }
          recordatoriosStats = recordatoriosStats;
        }
      }
    } catch (error) {
      console.error('Error al cargar recordatorios batch:', error);
    }
  }

  // Funciones para el menú dropdown
  function toggleMenu(facturaId: number) {
    menuAbiertoId = menuAbiertoId === facturaId ? null : facturaId;
  }

  function cerrarMenu() {
    menuAbiertoId = null;
  }

  // Funciones de cancelación de factura timbrada
  function abrirModalMotivoCancelacion(factura: Factura) {
    if (!factura.timbrado) return;
    cerrarMenu();
    facturaSeleccionada = factura;
    motivoSeleccionado = '01';
    sustitucionId = '';
    modalMotivoCancelacionAbierto = true;
  }

  function cerrarModalMotivoCancelacion() {
    modalMotivoCancelacionAbierto = false;
    facturaSeleccionada = null;
  }

  function abrirModalConfirmacionCancelacion() {
    if (motivoSeleccionado === '01' && !sustitucionId.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo Requerido', text: 'Para el motivo 01 debes indicar el UUID de la factura que sustituye.', confirmButtonColor: '#3b82f6' });
      return;
    }
    modalMotivoCancelacionAbierto = false;
    modalConfirmacionCancelacionAbierto = true;
  }

  function cerrarModalConfirmacionCancelacion() {
    modalConfirmacionCancelacionAbierto = false;
    facturaSeleccionada = null;
  }

  async function confirmarCancelacion() {
    if (!facturaSeleccionada) return;
    cancelando = true;
    try {
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) { cancelando = false; return; }
      const motivoDescripcion = motivosCancelacion.find(m => m.codigo === motivoSeleccionado)?.nombre || '';
      const response = await authFetch(`/api/facturas/${facturaSeleccionada.id}/cancelar?organizacionId=${organizacionId}`, {
        method: 'POST',
        body: JSON.stringify({
          motivo: motivoSeleccionado,
          motivoDescripcion,
          sustitucion: motivoSeleccionado === '01' ? sustitucionId.trim() : ''
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.requiereAceptacion) {
          Swal.fire({ icon: 'warning', title: 'Cancelación Pendiente', text: `La solicitud de cancelación fue enviada al SAT. Se requiere la aceptación del receptor.`, confirmButtonColor: '#3b82f6' });
        } else {
          Swal.fire({ icon: 'success', title: 'Factura Cancelada', text: data.canceladaEnFacturapi ? `La factura ${data.numeroFactura} se ha cancelado exitosamente ante el SAT.` : `La factura ${data.numeroFactura} se ha cancelado exitosamente.`, timer: 3000, showConfirmButton: false });
        }
        cerrarModalConfirmacionCancelacion();
        setTimeout(() => cargarFacturas(), 1500);
      } else {
        Swal.fire({ icon: 'error', title: 'Error al Cancelar', text: data.error || 'Ocurrió un error desconocido.', confirmButtonColor: '#3b82f6' });
      }
    } catch (err) {
      console.error('Error al cancelar factura:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo procesar la cancelación.', confirmButtonColor: '#3b82f6' });
    } finally {
      cancelando = false;
    }
  }

  // Función para borrar factura no timbrada
  async function borrarFactura(factura: Factura) {
    cerrarMenu();
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Borrar factura?',
      html: `<p>Esta acción eliminará permanentemente la factura <strong>#${factura.numero_factura || factura.id}</strong>.</p><p class="text-sm text-gray-500 mt-2">Esta factura aún no ha sido timbrada ante el SAT.</p>`,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const organizacionId = get(orgIdStore)?.toString() || null;
      const response = await authFetch(`/api/facturas/${factura.id}?organizacionId=${organizacionId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Factura borrada',
          text: data.message,
          confirmButtonColor: '#3b82f6'
        });
        cargarFacturas();
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: data.error || 'No se pudo borrar la factura',
          confirmButtonColor: '#3b82f6'
        });
      }
    } catch {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al borrar la factura',
        confirmButtonColor: '#3b82f6'
      });
    }
  }


  // Función para cargar facturas desde API
  async function cargarFacturas() {
    cargando = true;
    error = '';

    try {
      // Obtener organizacionId actual del store
      const organizacionId = get(orgIdStore)?.toString() || null;

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

      // Agregar filtro de periodo (calcular fechas)
      if (filtroPeriodo) {
        const hoy = new Date();
        const hoyStr = hoyLocal();
        let fechaInicio = '';
        if (filtroPeriodo === 'hoy') {
          fechaInicio = hoyStr;
        } else if (filtroPeriodo === 'semana') {
          const inicioSemana = new Date(hoy);
          inicioSemana.setDate(hoy.getDate() - hoy.getDay());
          fechaInicio = fechaLocal(inicioSemana);
        } else if (filtroPeriodo === 'mes') {
          fechaInicio = fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
        } else if (filtroPeriodo === 'trimestre') {
          const mesInicioTrimestre = Math.floor(hoy.getMonth() / 3) * 3;
          fechaInicio = fechaLocal(new Date(hoy.getFullYear(), mesInicioTrimestre, 1));
        }
        if (fechaInicio) {
          params.append('fechaInicio', fechaInicio);
          params.append('fechaFin', hoyStr);
        }
      }

      // Agregar filtros de checkbox
      const estadosSeleccionados = [];
      if (filtrosEstadoCheckbox.pagada) estadosSeleccionados.push('3'); // Estado 3 = Pagada
      if (filtrosEstadoCheckbox.vigente) estadosSeleccionados.push('1'); // Estado 1 = Vigente/Pendiente
      if (filtrosEstadoCheckbox.vencida) estadosSeleccionados.push('4'); // Estado 4 = Vencida
      if (filtrosEstadoCheckbox.cancelada) estadosSeleccionados.push('6'); // Estado 6 = Cancelada

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
            rfc: f.cliente.rfc,
            nombreComercial: f.cliente.nombreComercial,
            correo: f.cliente.correo,
            telefono: f.cliente.telefono,
            telefonoWhatsApp: f.cliente.telefonoWhatsApp,
            codigoPais: f.cliente.codigoPais
          },
          montoTotal: f.montoTotal,
          saldoPendiente: f.saldoPendiente,
          fechaEmision: f.fechaEmision,
          fechaVencimiento: f.fechaVencimiento,
          diasVencido: f.diasVencido,
          estado_factura_id: f.estado.id,
          prioridad_cobranza_id: f.prioridad.id,
          ultimaGestion: f.ultimaGestion,
          timbrado: f.timbrado || false,
          metodoPago: f.metodoPago || null,
          createdAt: f.createdAt
        }));

        agingData = data.aging;
        paginacion = { ...paginacion, ...data.pagination };

        // Actualizar contadores de estados desde el backend
        if (data.conteoEstados) {
          contadorEstados = {
            pagada: data.conteoEstados[3] || 0,
            vigente: data.conteoEstados[1] || 0,
            vencida: data.conteoEstados[4] || 0,
            cancelada: data.conteoEstados[6] || 0
          };
        }

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

  // Búsqueda con debounce para evitar llamadas excesivas a la API
  function buscarConDebounce() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      aplicarFiltros();
    }, 350);
  }

  // Filtrar por periodo
  function aplicarFiltroPeriodo() {
    paginacion.page = 1;
    cargarFacturas();
  }

  function limpiarFiltros() {
    filtroTexto = '';
    filtroEstado = '';
    filtroPrioridad = '';
    filtroPeriodo = '';
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

  let cargaInicial = false;
  $: if ($orgIdStore && !cargaInicial) {
    cargaInicial = true;
    cargarFacturas();
  }

  onMount(() => {
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
      <!-- <h1 class="text-2xl font-bold text-gray-900">Facturación</h1> -->
      <p class="text-sm text-gray-600 mt-1">Impulsa el crecimiento de tu empresa, revisa el estado de tus facturas, envía recordatorios a tus clientes y cobra tus facturas a tiempo.</p>
    </div>
    <div class="flex gap-3">
      <!-- <Button variant="primary" size="md">
        IMPORTAR
      </Button> -->
      <Button
        variant="primary"
        size="md"
        on:click={() => goto('/dashboard/facturacion/nueva')}
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
            placeholder="Buscar por cliente, folio o identificador"
            bind:value={filtroTexto}
            on:input={buscarConDebounce}
            class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full transition-all duration-200"
          />
        </div>

        <!-- Filtro Periodo -->
        <select
          bind:value={filtroPeriodo}
          on:change={aplicarFiltroPeriodo}
          class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px] transition-all duration-200"
        >
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
              <span class="text-sm text-gray-700">Pendiente ({contadorEstados.vigente})</span>
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
                  <div class="text-sm text-gray-600">{formatearFecha(factura.fechaEmision || factura.createdAt)}</div>
                </td>

                <!-- Emisión de factura -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-600">{formatearFecha(factura.fechaEmision)}</div>
                  {#if !factura.timbrado && new Date(factura.fechaEmision) > new Date(hoyLocal())}
                    <span class="inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">Programada</span>
                  {/if}
                  {#if factura.recurrenciaActiva}
                    <span class="inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-700 border border-teal-200" title="Factura con recurrencia activa ({factura.facturasGeneradas} generadas)">Recurrente</span>
                  {/if}
                  {#if factura.facturaOrigenId}
                    <span class="inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">Auto</span>
                  {/if}
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
                        {recordatoriosStats[factura.id]?.enviados || 0}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- Estatus -->
                <td class="px-6 py-4 text-center">
                  {#if factura.metodoPago === 'PUE' && factura.estado_factura_id !== 6}
                    <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full {getEstadoBadgeClass('pagada')}">
                      Pagada
                    </span>
                  {:else}
                    <span class="inline-flex px-2.5 py-1 text-xs font-medium rounded-full {getEstadoBadgeClass(getEstadoCodigo(factura.estado_factura_id || 0))}">
                      {getEstadoNombre(factura.estado_factura_id || 0)}
                    </span>
                  {/if}
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
                      {#if factura.metodoPago !== 'PUE' && factura.estado_factura_id !== 6 && factura.estado_factura_id !== 3 && (factura.saldoPendiente || 0) > 0}
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
                      {/if}
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
                      {#if factura.estado_factura_id !== 6}
                        {#if factura.timbrado}
                          <button
                            on:click={() => abrirModalMotivoCancelacion(factura)}
                            class="w-full px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-gray-100"
                          >
                            <FileX class="w-4 h-4" />
                            Cancelar factura
                          </button>
                        {:else}
                          <button
                            on:click={() => borrarFactura(factura)}
                            class="w-full px-4 py-3 text-left text-sm text-red-700 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-gray-100"
                          >
                            <AlertTriangle class="w-4 h-4" />
                            Borrar factura
                          </button>
                        {/if}
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

<!-- Modal 1: Seleccionar Motivo de Cancelación -->
{#if modalMotivoCancelacionAbierto && facturaSeleccionada}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
        <h2 class="text-lg font-semibold text-gray-900">Seleccionar Motivo de Cancelación</h2>
        <button on:click={cerrarModalMotivoCancelacion} class="text-gray-400 hover:text-gray-600 transition-colors">
          <IconX class="w-5 h-5" />
        </button>
      </div>
      <div class="p-6 space-y-4">
        <p class="text-sm text-gray-600 mb-4"><strong>Factura:</strong> {facturaSeleccionada.numero_factura}</p>
        <div class="space-y-3">
          {#each motivosCancelacion as motivo}
            <label class="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors {motivoSeleccionado === motivo.codigo ? 'border-blue-500 bg-blue-50' : ''}">
              <input type="radio" name="motivo" value={motivo.codigo} bind:group={motivoSeleccionado} class="mt-1 w-4 h-4 text-blue-600" />
              <div class="ml-3 flex-1">
                <p class="text-sm font-semibold text-gray-900">{motivo.codigo} - {motivo.nombre}</p>
                <p class="text-xs text-gray-600 mt-1">{motivo.descripcion}</p>
              </div>
            </label>
          {/each}
        </div>
        {#if motivoSeleccionado === '01'}
          <div class="mt-4 p-4 border border-orange-200 bg-orange-50 rounded-lg">
            <label for="sustitucion-porcobrar" class="block text-sm font-semibold text-orange-900 mb-2">Factura que sustituye (requerido)</label>
            <input id="sustitucion-porcobrar" type="text" placeholder="UUID fiscal de la factura sustituta" bind:value={sustitucionId} class="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm" />
            <p class="text-xs text-orange-700 mt-1">Ingresa el folio fiscal (UUID) de la factura que sustituye a la que se está cancelando.</p>
          </div>
        {/if}
      </div>
      <div class="flex gap-3 p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
        <Button variant="secondary" size="md" on:click={cerrarModalMotivoCancelacion} class="flex-1">Cancelar</Button>
        <Button variant="primary" size="md" on:click={abrirModalConfirmacionCancelacion} class="flex-1">Continuar</Button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal 2: Confirmación de Cancelación -->
{#if modalConfirmacionCancelacionAbierto && facturaSeleccionada}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Confirmar Cancelación</h2>
        <button on:click={cerrarModalConfirmacionCancelacion} disabled={cancelando} class="text-gray-400 hover:text-gray-600 transition-colors">
          <IconX class="w-5 h-5" />
        </button>
      </div>
      <div class="p-6 space-y-4">
        <p class="text-sm text-gray-600 mb-2"><strong>Factura:</strong> {facturaSeleccionada.numero_factura}</p>
        <p class="text-sm text-gray-600 mb-4"><strong>Motivo:</strong> {motivosCancelacion.find(m => m.codigo === motivoSeleccionado)?.nombre}</p>
        {#if motivoSeleccionado === '01' && sustitucionId}
          <p class="text-sm text-gray-600 mb-4"><strong>Factura sustituta:</strong> {sustitucionId}</p>
        {/if}
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p class="text-sm text-yellow-800"><strong>⚠️ Advertencia:</strong> Esta acción no se puede deshacer. ¿Estás seguro de que deseas proceder con la cancelación?</p>
        </div>
      </div>
      <div class="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
        <Button variant="secondary" size="md" on:click={cerrarModalConfirmacionCancelacion} disabled={cancelando} class="flex-1">Atrás</Button>
        <Button variant="danger" size="md" on:click={confirmarCancelacion} disabled={cancelando} class="flex-1">
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