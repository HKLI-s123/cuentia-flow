<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';
  import { browser } from '$app/environment';
  import {
    FileText,
    Download,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Clock,
    DollarSign,
    BarChart3,
    PieChart,
    Users,
    Filter,
    RefreshCw
  } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { organizacionCambio } from '$lib/stores/organizacion';

  let cargando = true;
  let error = '';

  // Tab activa
  let tabActiva: 'general' | 'aging' | 'clientes' = 'general';

  // Datos de métricas (reutilizamos el endpoint existente)
  let metricas = {
    totalPorCobrar: 0,
    saldoVencido: 0,
    totalFacturado: 0,
    totalCobrado: 0,
    eficienciaCobranza: 0,
    facturasPendientes: 0,
    facturasVencidas: 0,
    cantidadPagos: 0,
    cantidadFacturasEmitidas: 0,
    cantidadFacturasConPago: 0
  };

  let aging = {
    vigente: { cantidad: 0, monto: 0 },
    dias0_30: { cantidad: 0, monto: 0 },
    dias31_60: { cantidad: 0, monto: 0 },
    dias61_90: { cantidad: 0, monto: 0 },
    mas90: { cantidad: 0, monto: 0 }
  };

  let ventasPorMes: any[] = [];
  let topSaldoVencido: any[] = [];
  let resumenCobranza: any[] = [];

  // Canvas para gráficos
  let canvasFacturasEstado: HTMLCanvasElement;
  let canvasVentasMensual: HTMLCanvasElement;
  let chartFacturasEstado: any;
  let chartVentasMensual: any;

  // Totales derivados
  $: totalAging = aging.vigente.monto + aging.dias0_30.monto + aging.dias31_60.monto + aging.dias61_90.monto + aging.mas90.monto;
  $: porCobrarVsFacturado = metricas.totalFacturado > 0 ? ((metricas.totalPorCobrar / metricas.totalFacturado) * 100) : 0;
  $: totalAgingFacturas = aging.vigente.cantidad + aging.dias0_30.cantidad + aging.dias31_60.cantidad + aging.dias61_90.cantidad + aging.mas90.cantidad;

  function formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(valor);
  }

  function porcentajeAging(monto: number): string {
    if (totalAging === 0) return '0';
    return ((monto / totalAging) * 100).toFixed(1);
  }

  // CSV Download utility
  function descargarCSV(datos: Record<string, any>[], nombreArchivo: string) {
    if (!datos || datos.length === 0) return;

    const headers = Object.keys(datos[0]);
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const csvContent = bom + [
      headers.join(','),
      ...datos.map(row =>
        headers.map(h => {
          const val = row[h] ?? '';
          const str = String(val);
          // Escape commas, quotes, and newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function descargarResumenGeneral() {
    descargarCSV([{
      'Total Facturado': metricas.totalFacturado,
      'Total Cobrado': metricas.totalCobrado,
      'Por cobrar': metricas.totalPorCobrar,
      'Saldo Vencido': metricas.saldoVencido,
      'Facturas Emitidas': metricas.cantidadFacturasEmitidas,
      'Facturas Pendientes': metricas.facturasPendientes,
      'Facturas Vencidas': metricas.facturasVencidas,
      'Pagos Registrados': metricas.cantidadPagos,
      'Facturas con Pago': metricas.cantidadFacturasConPago,
      'Eficiencia de Cobro (%)': metricas.eficienciaCobranza,
      'Tasa de Morosidad (%)': metricas.totalPorCobrar > 0 ? ((metricas.saldoVencido / metricas.totalPorCobrar) * 100).toFixed(2) : '0',
      'Cobertura de Pagos (%)': metricas.cantidadFacturasEmitidas > 0 ? ((metricas.cantidadFacturasConPago / metricas.cantidadFacturasEmitidas) * 100).toFixed(2) : '0'
    }], 'resumen_general');
  }

  function descargarFacturacionMensual() {
    const hoy = new Date();
    const datos = [];
    for (let i = 3; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const datosDelMes = ventasPorMes.find((v: any) => v.Anio === fecha.getFullYear() && v.Mes === (fecha.getMonth() + 1));
      datos.push({
        'Mes': nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1),
        'Total Facturado': datosDelMes?.TotalVentas || 0,
        'Cantidad Facturas': datosDelMes?.CantidadFacturas || 0
      });
    }
    descargarCSV(datos, 'facturacion_mensual');
  }

  function descargarAging() {
    descargarCSV([
      { Rango: 'Vigente', Facturas: aging.vigente.cantidad, Monto: aging.vigente.monto, 'Porcentaje (%)': porcentajeAging(aging.vigente.monto) },
      { Rango: '1-30 días', Facturas: aging.dias0_30.cantidad, Monto: aging.dias0_30.monto, 'Porcentaje (%)': porcentajeAging(aging.dias0_30.monto) },
      { Rango: '31-60 días', Facturas: aging.dias31_60.cantidad, Monto: aging.dias31_60.monto, 'Porcentaje (%)': porcentajeAging(aging.dias31_60.monto) },
      { Rango: '61-90 días', Facturas: aging.dias61_90.cantidad, Monto: aging.dias61_90.monto, 'Porcentaje (%)': porcentajeAging(aging.dias61_90.monto) },
      { Rango: 'Más de 90 días', Facturas: aging.mas90.cantidad, Monto: aging.mas90.monto, 'Porcentaje (%)': porcentajeAging(aging.mas90.monto) },
      { Rango: 'TOTAL', Facturas: totalAgingFacturas, Monto: totalAging, 'Porcentaje (%)': '100' }
    ], 'aging_cartera');
  }

  function descargarTopDeudores() {
    descargarCSV(topSaldoVencido.map((c, i) => ({
      '#': i + 1,
      'Cliente': c.ClienteNombre || 'Sin nombre',
      'Facturas Vencidas': c.CantidadFacturas,
      'Saldo Vencido': c.TotalSaldoVencido
    })), 'top_deudores');
  }

  async function cargarDatos() {
    if (!browser) return;
    cargando = true;
    error = '';

    try {
      const organizacionId = get(orgIdStore)?.toString() || null;

      if (!organizacionId) {
        error = 'No se pudo obtener la organización activa.';
        cargando = false;
        return;
      }

      const response = await authFetch(`/api/dashboard/metricas?organizacionId=${organizacionId}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const m = data.metricas;

        metricas.totalPorCobrar = m.totalPorCobrar || 0;
        metricas.saldoVencido = m.saldoVencido || 0;
        metricas.totalFacturado = m.totalFacturado || 0;
        metricas.totalCobrado = m.totalCobrado || 0;
        metricas.eficienciaCobranza = m.eficienciaCobranza || 0;
        metricas.facturasPendientes = m.cantidadFacturasPendientes || 0;
        metricas.facturasVencidas = m.cantidadFacturasVencidas || 0;
        metricas.cantidadPagos = m.cantidadPagos || 0;
        metricas.cantidadFacturasEmitidas = m.cantidadFacturasEmitidas || 0;
        metricas.cantidadFacturasConPago = m.cantidadFacturasConPago || 0;

        if (m.aging) aging = m.aging;
        ventasPorMes = m.ventasPorMes || [];
        topSaldoVencido = m.topSaldoVencido || [];
        resumenCobranza = m.resumenCobranza || [];

        cargando = false;
        setTimeout(() => crearGraficos(), 100);
      }
    } catch (err) {
      console.error('Error al cargar reportes:', err);
      error = 'Error al cargar los datos del reporte.';
      cargando = false;
    }
  }

  async function crearGraficos() {
    const Chart = (await import('chart.js/auto')).default;

    if (chartFacturasEstado) chartFacturasEstado.destroy();
    if (chartVentasMensual) chartVentasMensual.destroy();

    // Doughnut: Facturas por estado
    if (canvasFacturasEstado) {
      const pagadas = metricas.cantidadFacturasConPago || 0;
      const pendientes = metricas.facturasPendientes || 0;
      const vencidas = metricas.facturasVencidas || 0;

      chartFacturasEstado = new Chart(canvasFacturasEstado, {
        type: 'doughnut',
        data: {
          labels: ['Pagadas', 'Pendientes', 'Vencidas'],
          datasets: [{
            data: [pagadas, pendientes, vencidas],
            backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '60%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { usePointStyle: true, boxWidth: 8, padding: 12 }
            }
          }
        }
      });
    }

    // Bar: Ventas mensuales
    if (canvasVentasMensual && ventasPorMes.length > 0) {
      const hoy = new Date();
      const labels: string[] = [];
      const datosFacturado: number[] = [];

      for (let i = 3; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        labels.push(nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1));

        const datosDelMes = ventasPorMes.find(
          (v: any) => v.Anio === fecha.getFullYear() && v.Mes === (fecha.getMonth() + 1)
        );
        datosFacturado.push(datosDelMes?.TotalVentas || 0);
      }

      chartVentasMensual = new Chart(canvasVentasMensual, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Total Facturado',
            data: datosFacturado,
            backgroundColor: '#3b82f6',
            borderRadius: 4,
            barThickness: 40
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value: number | string) {
                  const v = Number(value);
                  return v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'k' : '$' + v;
                }
              }
            }
          }
        }
      });
    }
  }

  let unsubscribeOrgCambio: () => void;

  onMount(() => {
    cargarDatos();
    unsubscribeOrgCambio = organizacionCambio.subscribe(() => {
      cargando = true;
      cargarDatos();
    });
    return () => {
      if (unsubscribeOrgCambio) unsubscribeOrgCambio();
    };
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <p class="text-sm text-gray-500">Resumen financiero y análisis de cobranza de tu organización.</p>
    </div>
    <button
      on:click={() => { cargando = true; cargarDatos(); }}
      class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
    >
      <RefreshCw class="w-4 h-4" />
      Actualizar
    </button>
  </div>

  {#if cargando}
    <div class="flex items-center justify-center py-20">
      <div class="flex flex-col items-center gap-3">
        <div class="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p class="text-sm text-gray-500">Cargando reportes...</p>
      </div>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <AlertTriangle class="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p class="text-red-700">{error}</p>
    </div>
  {:else}

  <!-- Tabs -->
  <div class="border-b border-gray-200">
    <nav class="flex gap-6">
      <button
        on:click={() => tabActiva = 'general'}
        class="pb-3 text-sm font-medium border-b-2 transition-colors {tabActiva === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
      >
        <span class="flex items-center gap-2"><BarChart3 class="w-4 h-4" /> Resumen General</span>
      </button>
      <button
        on:click={() => tabActiva = 'aging'}
        class="pb-3 text-sm font-medium border-b-2 transition-colors {tabActiva === 'aging' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
      >
        <span class="flex items-center gap-2"><Clock class="w-4 h-4" /> Aging de Cartera</span>
      </button>
      <button
        on:click={() => tabActiva = 'clientes'}
        class="pb-3 text-sm font-medium border-b-2 transition-colors {tabActiva === 'clientes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
      >
        <span class="flex items-center gap-2"><Users class="w-4 h-4" /> Top Deudores</span>
      </button>
    </nav>
  </div>

  <!-- Tab: Resumen General -->
  {#if tabActiva === 'general'}
    <!-- KPI Cards -->
    <div class="flex justify-end">
      <button on:click={descargarResumenGeneral} class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        <Download class="w-3.5 h-3.5" />
        Descargar CSV
      </button>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl p-5 shadow-sm border">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 bg-blue-100 rounded-lg"><DollarSign class="w-5 h-5 text-blue-600" /></div>
          <span class="text-xs uppercase font-medium text-gray-500">Total Facturado</span>
        </div>
        <p class="text-2xl font-bold text-gray-900">{formatearMoneda(metricas.totalFacturado)}</p>
        <p class="text-xs text-gray-500 mt-1">{metricas.cantidadFacturasEmitidas} facturas emitidas</p>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 bg-green-100 rounded-lg"><CheckCircle class="w-5 h-5 text-green-600" /></div>
          <span class="text-xs uppercase font-medium text-gray-500">Total Cobrado</span>
        </div>
        <p class="text-2xl font-bold text-gray-900">{formatearMoneda(metricas.totalCobrado)}</p>
        <p class="text-xs text-gray-500 mt-1">{metricas.cantidadPagos} pagos registrados</p>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 bg-yellow-100 rounded-lg"><Clock class="w-5 h-5 text-yellow-600" /></div>
          <span class="text-xs uppercase font-medium text-gray-500">Por cobrar</span>
        </div>
        <p class="text-2xl font-bold text-gray-900">{formatearMoneda(metricas.totalPorCobrar)}</p>
        <p class="text-xs text-gray-500 mt-1">{porCobrarVsFacturado.toFixed(1)}% del facturado</p>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border">
        <div class="flex items-center gap-3 mb-3">
          <div class="p-2 bg-red-100 rounded-lg"><AlertTriangle class="w-5 h-5 text-red-600" /></div>
          <span class="text-xs uppercase font-medium text-gray-500">Saldo Vencido</span>
        </div>
        <p class="text-2xl font-bold text-gray-900">{formatearMoneda(metricas.saldoVencido)}</p>
        <p class="text-xs text-gray-500 mt-1">{metricas.facturasVencidas} facturas vencidas</p>
      </div>
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Facturas por estado -->
      <div class="bg-white rounded-xl p-6 shadow-sm border">
        <h3 class="text-base font-semibold text-gray-800 mb-4">Facturas por estado</h3>
        <div class="h-64">
          <canvas bind:this={canvasFacturasEstado}></canvas>
        </div>
      </div>

      <!-- Facturación mensual -->
      <div class="bg-white rounded-xl p-6 shadow-sm border">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-gray-800">Facturación mensual (últimos 4 meses)</h3>
          <button on:click={descargarFacturacionMensual} class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" title="Descargar CSV">
            <Download class="w-3.5 h-3.5" />
          </button>
        </div>
        <div class="h-64">
          <canvas bind:this={canvasVentasMensual}></canvas>
        </div>
      </div>
    </div>

    <!-- Eficiencia de cobranza -->
    <div class="bg-white rounded-xl p-6 shadow-sm border">
      <h3 class="text-base font-semibold text-gray-800 mb-4">Indicadores de cobranza</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <p class="text-sm text-gray-500 mb-1">Eficiencia de cobro</p>
          <div class="flex items-end gap-2">
            <span class="text-3xl font-bold text-gray-900">{metricas.eficienciaCobranza.toFixed(1)}%</span>
          </div>
          <div class="mt-2 w-full bg-gray-200 rounded-full h-2.5">
            <div class="bg-green-500 h-2.5 rounded-full transition-all" style="width: {Math.min(metricas.eficienciaCobranza, 100)}%"></div>
          </div>
          <p class="text-xs text-gray-400 mt-1">Cobrado / Facturado</p>
        </div>
        <div>
          <p class="text-sm text-gray-500 mb-1">Tasa de morosidad</p>
          <div class="flex items-end gap-2">
            {#if metricas.totalPorCobrar > 0}
              <span class="text-3xl font-bold text-gray-900">{((metricas.saldoVencido / metricas.totalPorCobrar) * 100).toFixed(1)}%</span>
            {:else}
              <span class="text-3xl font-bold text-gray-900">0%</span>
            {/if}
          </div>
          <div class="mt-2 w-full bg-gray-200 rounded-full h-2.5">
            <div class="bg-red-500 h-2.5 rounded-full transition-all" style="width: {metricas.totalPorCobrar > 0 ? Math.min((metricas.saldoVencido / metricas.totalPorCobrar) * 100, 100) : 0}%"></div>
          </div>
          <p class="text-xs text-gray-400 mt-1">Vencido / Por cobrar</p>
        </div>
        <div>
          <p class="text-sm text-gray-500 mb-1">Cobertura de pagos</p>
          <div class="flex items-end gap-2">
            {#if metricas.cantidadFacturasEmitidas > 0}
              <span class="text-3xl font-bold text-gray-900">{((metricas.cantidadFacturasConPago / metricas.cantidadFacturasEmitidas) * 100).toFixed(1)}%</span>
            {:else}
              <span class="text-3xl font-bold text-gray-900">0%</span>
            {/if}
          </div>
          <div class="mt-2 w-full bg-gray-200 rounded-full h-2.5">
            <div class="bg-blue-500 h-2.5 rounded-full transition-all" style="width: {metricas.cantidadFacturasEmitidas > 0 ? Math.min((metricas.cantidadFacturasConPago / metricas.cantidadFacturasEmitidas) * 100, 100) : 0}%"></div>
          </div>
          <p class="text-xs text-gray-400 mt-1">Facturas con pago / Total emitidas</p>
        </div>
      </div>
    </div>

  <!-- Tab: Aging de Cartera -->
  {:else if tabActiva === 'aging'}
    <!-- Aging summary cards -->
    <div class="flex justify-end">
      <button on:click={descargarAging} class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        <Download class="w-3.5 h-3.5" />
        Descargar CSV
      </button>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <div class="bg-green-50 rounded-xl p-4 border border-green-200">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-3 h-3 rounded-full bg-green-500"></span>
          <span class="text-xs font-semibold text-green-700 uppercase">Vigente</span>
        </div>
        <p class="text-xl font-bold text-green-800">{formatearMoneda(aging.vigente.monto)}</p>
        <p class="text-xs text-green-600 mt-1">{aging.vigente.cantidad} facturas</p>
        <p class="text-xs text-green-500">{porcentajeAging(aging.vigente.monto)}% del total</p>
      </div>
      <div class="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-3 h-3 rounded-full bg-blue-500"></span>
          <span class="text-xs font-semibold text-blue-700 uppercase">1-30 días</span>
        </div>
        <p class="text-xl font-bold text-blue-800">{formatearMoneda(aging.dias0_30.monto)}</p>
        <p class="text-xs text-blue-600 mt-1">{aging.dias0_30.cantidad} facturas</p>
        <p class="text-xs text-blue-500">{porcentajeAging(aging.dias0_30.monto)}% del total</p>
      </div>
      <div class="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span class="text-xs font-semibold text-yellow-700 uppercase">31-60 días</span>
        </div>
        <p class="text-xl font-bold text-yellow-800">{formatearMoneda(aging.dias31_60.monto)}</p>
        <p class="text-xs text-yellow-600 mt-1">{aging.dias31_60.cantidad} facturas</p>
        <p class="text-xs text-yellow-500">{porcentajeAging(aging.dias31_60.monto)}% del total</p>
      </div>
      <div class="bg-orange-50 rounded-xl p-4 border border-orange-200">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-3 h-3 rounded-full bg-orange-500"></span>
          <span class="text-xs font-semibold text-orange-700 uppercase">61-90 días</span>
        </div>
        <p class="text-xl font-bold text-orange-800">{formatearMoneda(aging.dias61_90.monto)}</p>
        <p class="text-xs text-orange-600 mt-1">{aging.dias61_90.cantidad} facturas</p>
        <p class="text-xs text-orange-500">{porcentajeAging(aging.dias61_90.monto)}% del total</p>
      </div>
      <div class="bg-red-50 rounded-xl p-4 border border-red-200">
        <div class="flex items-center gap-2 mb-2">
          <span class="w-3 h-3 rounded-full bg-red-500"></span>
          <span class="text-xs font-semibold text-red-700 uppercase">+90 días</span>
        </div>
        <p class="text-xl font-bold text-red-800">{formatearMoneda(aging.mas90.monto)}</p>
        <p class="text-xs text-red-600 mt-1">{aging.mas90.cantidad} facturas</p>
        <p class="text-xs text-red-500">{porcentajeAging(aging.mas90.monto)}% del total</p>
      </div>
    </div>

    <!-- Aging stacked bar visual -->
    <div class="bg-white rounded-xl p-6 shadow-sm border">
      <h3 class="text-base font-semibold text-gray-800 mb-4">Distribución de cartera</h3>
      {#if totalAging > 0}
        <div class="w-full h-8 rounded-lg overflow-hidden flex">
          {#if aging.vigente.monto > 0}
            <div class="bg-green-500 h-full flex items-center justify-center text-xs text-white font-medium transition-all"
                 style="width: {porcentajeAging(aging.vigente.monto)}%"
                 title="Vigente: {formatearMoneda(aging.vigente.monto)}">
              {#if Number(porcentajeAging(aging.vigente.monto)) > 8}{porcentajeAging(aging.vigente.monto)}%{/if}
            </div>
          {/if}
          {#if aging.dias0_30.monto > 0}
            <div class="bg-blue-500 h-full flex items-center justify-center text-xs text-white font-medium transition-all"
                 style="width: {porcentajeAging(aging.dias0_30.monto)}%"
                 title="1-30 días: {formatearMoneda(aging.dias0_30.monto)}">
              {#if Number(porcentajeAging(aging.dias0_30.monto)) > 8}{porcentajeAging(aging.dias0_30.monto)}%{/if}
            </div>
          {/if}
          {#if aging.dias31_60.monto > 0}
            <div class="bg-yellow-500 h-full flex items-center justify-center text-xs text-white font-medium transition-all"
                 style="width: {porcentajeAging(aging.dias31_60.monto)}%"
                 title="31-60 días: {formatearMoneda(aging.dias31_60.monto)}">
              {#if Number(porcentajeAging(aging.dias31_60.monto)) > 8}{porcentajeAging(aging.dias31_60.monto)}%{/if}
            </div>
          {/if}
          {#if aging.dias61_90.monto > 0}
            <div class="bg-orange-500 h-full flex items-center justify-center text-xs text-white font-medium transition-all"
                 style="width: {porcentajeAging(aging.dias61_90.monto)}%"
                 title="61-90 días: {formatearMoneda(aging.dias61_90.monto)}">
              {#if Number(porcentajeAging(aging.dias61_90.monto)) > 8}{porcentajeAging(aging.dias61_90.monto)}%{/if}
            </div>
          {/if}
          {#if aging.mas90.monto > 0}
            <div class="bg-red-500 h-full flex items-center justify-center text-xs text-white font-medium transition-all"
                 style="width: {porcentajeAging(aging.mas90.monto)}%"
                 title="+90 días: {formatearMoneda(aging.mas90.monto)}">
              {#if Number(porcentajeAging(aging.mas90.monto)) > 8}{porcentajeAging(aging.mas90.monto)}%{/if}
            </div>
          {/if}
        </div>
        <div class="flex flex-wrap gap-4 mt-3">
          <div class="flex items-center gap-1.5 text-xs text-gray-600"><span class="w-2.5 h-2.5 rounded-full bg-green-500"></span> Vigente</div>
          <div class="flex items-center gap-1.5 text-xs text-gray-600"><span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span> 1-30 días</div>
          <div class="flex items-center gap-1.5 text-xs text-gray-600"><span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> 31-60 días</div>
          <div class="flex items-center gap-1.5 text-xs text-gray-600"><span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span> 61-90 días</div>
          <div class="flex items-center gap-1.5 text-xs text-gray-600"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> +90 días</div>
        </div>
      {:else}
        <div class="text-center text-gray-400 py-8">No hay saldos pendientes registrados.</div>
      {/if}
    </div>

    <!-- Aging table -->
    <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div class="p-4 border-b bg-gray-50">
        <h3 class="text-base font-semibold text-gray-800">Detalle de antigüedad de saldos</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-gray-50 border-b">
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Rango</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Facturas</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Monto</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">% del Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3"><span class="inline-flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-green-500"></span><span class="text-sm font-medium text-gray-800">Vigente</span></span></td>
              <td class="px-4 py-3 text-right text-sm text-gray-700">{aging.vigente.cantidad}</td>
              <td class="px-4 py-3 text-right text-sm font-medium text-gray-800">{formatearMoneda(aging.vigente.monto)}</td>
              <td class="px-4 py-3 text-right text-sm text-gray-600">{porcentajeAging(aging.vigente.monto)}%</td>
            </tr>
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3"><span class="inline-flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span><span class="text-sm font-medium text-gray-800">1 - 30 días</span></span></td>
              <td class="px-4 py-3 text-right text-sm text-gray-700">{aging.dias0_30.cantidad}</td>
              <td class="px-4 py-3 text-right text-sm font-medium text-gray-800">{formatearMoneda(aging.dias0_30.monto)}</td>
              <td class="px-4 py-3 text-right text-sm text-gray-600">{porcentajeAging(aging.dias0_30.monto)}%</td>
            </tr>
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3"><span class="inline-flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span><span class="text-sm font-medium text-gray-800">31 - 60 días</span></span></td>
              <td class="px-4 py-3 text-right text-sm text-gray-700">{aging.dias31_60.cantidad}</td>
              <td class="px-4 py-3 text-right text-sm font-medium text-gray-800">{formatearMoneda(aging.dias31_60.monto)}</td>
              <td class="px-4 py-3 text-right text-sm text-gray-600">{porcentajeAging(aging.dias31_60.monto)}%</td>
            </tr>
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3"><span class="inline-flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span><span class="text-sm font-medium text-gray-800">61 - 90 días</span></span></td>
              <td class="px-4 py-3 text-right text-sm text-gray-700">{aging.dias61_90.cantidad}</td>
              <td class="px-4 py-3 text-right text-sm font-medium text-gray-800">{formatearMoneda(aging.dias61_90.monto)}</td>
              <td class="px-4 py-3 text-right text-sm text-gray-600">{porcentajeAging(aging.dias61_90.monto)}%</td>
            </tr>
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3"><span class="inline-flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span><span class="text-sm font-medium text-gray-800">Más de 90 días</span></span></td>
              <td class="px-4 py-3 text-right text-sm text-gray-700">{aging.mas90.cantidad}</td>
              <td class="px-4 py-3 text-right text-sm font-medium text-gray-800">{formatearMoneda(aging.mas90.monto)}</td>
              <td class="px-4 py-3 text-right text-sm text-gray-600">{porcentajeAging(aging.mas90.monto)}%</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-gray-50 border-t-2 border-gray-200">
              <td class="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
              <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">{totalAgingFacturas}</td>
              <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatearMoneda(totalAging)}</td>
              <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

  <!-- Tab: Top Deudores -->
  {:else if tabActiva === 'clientes'}
    {#if topSaldoVencido.length > 0}
      <div class="flex justify-end">
        <button on:click={descargarTopDeudores} class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Download class="w-3.5 h-3.5" />
          Descargar CSV
        </button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div class="p-4 border-b bg-gray-50">
          <h3 class="text-base font-semibold text-gray-800">Top 10 clientes con mayor saldo vencido</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-gray-50 border-b">
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">#</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Facturas</th>
                <th class="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Saldo Vencido</th>
                <th class="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Proporción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              {#each topSaldoVencido as cliente, i}
                {@const maxSaldo = topSaldoVencido[0]?.TotalSaldoVencido || 1}
                <tr class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-sm text-gray-500 font-medium">{i + 1}</td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-800">{cliente.ClienteNombre || 'Sin nombre'}</td>
                  <td class="px-4 py-3 text-right text-sm text-gray-700">{cliente.CantidadFacturas}</td>
                  <td class="px-4 py-3 text-right text-sm font-semibold text-red-600">{formatearMoneda(cliente.TotalSaldoVencido)}</td>
                  <td class="px-4 py-3">
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div class="bg-red-500 h-2 rounded-full transition-all" style="width: {(cliente.TotalSaldoVencido / maxSaldo) * 100}%"></div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Resumen rápido -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl p-5 shadow-sm border text-center">
          <p class="text-xs text-gray-500 uppercase font-medium mb-1">Clientes con saldo vencido</p>
          <p class="text-3xl font-bold text-gray-900">{topSaldoVencido.length}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border text-center">
          <p class="text-xs text-gray-500 uppercase font-medium mb-1">Mayor deudor</p>
          <p class="text-lg font-bold text-gray-900 truncate">{topSaldoVencido[0]?.ClienteNombre || '-'}</p>
          <p class="text-sm text-red-600 font-semibold">{formatearMoneda(topSaldoVencido[0]?.TotalSaldoVencido || 0)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border text-center">
          <p class="text-xs text-gray-500 uppercase font-medium mb-1">Total vencido (Top 10)</p>
          <p class="text-2xl font-bold text-red-600">{formatearMoneda(topSaldoVencido.reduce((acc, c) => acc + (c.TotalSaldoVencido || 0), 0))}</p>
        </div>
      </div>
    {:else}
      <div class="bg-white rounded-xl p-12 shadow-sm border text-center">
        <CheckCircle class="w-12 h-12 text-green-400 mx-auto mb-3" />
        <h3 class="text-lg font-semibold text-gray-700 mb-1">Sin saldos vencidos</h3>
        <p class="text-sm text-gray-500">No hay clientes con saldo vencido. Tu cartera está al día.</p>
      </div>
    {/if}
  {/if}

  {/if}
</div>
