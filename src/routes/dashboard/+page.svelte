<script lang="ts">
  import { onMount } from "svelte";
  import { get } from 'svelte/store';
  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { HelpCircle, FileText, AlertTriangle, TrendingUp, Clock } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { organizacionCambio } from '$lib/stores/organizacion';
  import OnboardingChecklist from './OnboardingChecklist.svelte';

  let canvasVentas: HTMLCanvasElement;
  let canvasResumenCobranza: HTMLCanvasElement;
  let canvasTopSaldoVencido: HTMLCanvasElement;
  let canvasAging: HTMLCanvasElement;

  // Instancias de los gráficos para poder destruirlos antes de recrearlos
  let chartVentas: any;
  let chartResumenCobranza: any;
  let chartTopSaldoVencido: any;
  let chartAging: any;

  // Datos de métricas
  let metricas = {
    totalPorCobrar: 0,
    saldoVencido: 0,
    totalFacturado: 0,
    totalCobrado: 0,
    eficienciaCobranza: 0,
    facturasPendientes: 0,
    facturasVencidas: 0,
    cantidadFacturasEmitidas: 0,
    cantidadPagos: 0,
    cantidadFacturasConPago: 0,
    usaWhatsApp: false
  };

  let aging = {
    vigente: { cantidad: 0, monto: 0 },
    dias0_30: { cantidad: 0, monto: 0 },
    dias31_60: { cantidad: 0, monto: 0 },
    dias61_90: { cantidad: 0, monto: 0 },
    mas90: { cantidad: 0, monto: 0 }
  };

  $: totalAging = Number(aging.vigente.monto || 0)
    + Number(aging.dias0_30.monto || 0)
    + Number(aging.dias31_60.monto || 0)
    + Number(aging.dias61_90.monto || 0)
    + Number(aging.mas90.monto || 0);

  function porcentajeAging(monto: number): string {
    if (totalAging <= 0) return '0.0';
    return ((Number(monto || 0) / totalAging) * 100).toFixed(1);
  }

  let usaWhatsApp = false;
  let whatsappBannerDismissed = false;

  let tooltipAbierto: string | null = null;

  const tooltips: Record<string, string> = {
    cuentasPorCobrar: 'Suma de saldos pendientes de facturas activas (no canceladas).',
    ventas: 'Total facturado y porcentaje cobrado sobre lo facturado.',
    resumenCobranza: 'Distribucion por periodo de facturas vigentes, vencidas y pagadas.',
    topSaldoVencido: 'Top 10 clientes con mayor saldo vencido acumulado.',
    aging: 'Distribucion de saldos pendientes por antiguedad.'
  };

  function toggleTooltip(key: string) {
    tooltipAbierto = tooltipAbierto === key ? null : key;
  }

  function cerrarTooltips(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.tooltip-trigger')) {
      tooltipAbierto = null;
    }
  }

  function checkWhatsAppBannerDismissed() {
    if (!browser) return;
    const orgId = String(get(orgIdStore) || '');
    if (!orgId) return;
    whatsappBannerDismissed = localStorage.getItem(`wa_banner_dismissed_${orgId}`) === 'true';
  }

  function dismissWhatsAppBanner() {
    if (!browser) return;
    const orgId = String(get(orgIdStore) || '');
    if (!orgId) return;
    localStorage.setItem(`wa_banner_dismissed_${orgId}`, 'true');
    whatsappBannerDismissed = true;
  }

  let cargando = true;
  let sinOrganizacion = false;
  let selectedPeriod = 'Semana';

  // Función para formatear moneda
  function formatearMoneda(valor: number | string | null | undefined): string {
    const numero = typeof valor === 'string' ? parseFloat(valor) : Number(valor);
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(isNaN(numero) ? 0 : numero);
  }

  // Cargar datos desde API
  async function cargarDatos() {
    // Solo ejecutar en el navegador
    if (!browser) return;

    try {
      const userData = { organizacionId: get(orgIdStore) };
      const organizacionId = userData.organizacionId;

      if (!organizacionId) {
        sinOrganizacion = true;
        cargando = false;
        return;
      }

      // Cargar métricas desde el nuevo endpoint
      const responseMetricas = await authFetch(`/api/dashboard/metricas?organizacionId=${organizacionId}&periodo=${selectedPeriod}`);

      if (!responseMetricas.ok) {
        throw new Error(`Error ${responseMetricas.status}: ${responseMetricas.statusText}`);
      }

      const dataMetricas = await responseMetricas.json();

      if (dataMetricas.success) {
        const m = dataMetricas.metricas;

        // Actualizar métricas principales
        metricas.totalPorCobrar = Number(m.totalPorCobrar) || 0;
        metricas.saldoVencido = Number(m.saldoVencido) || 0;
        metricas.totalFacturado = Number(m.totalFacturado) || 0;
        metricas.totalCobrado = Number(m.totalCobrado) || 0;
        metricas.eficienciaCobranza = Number(m.eficienciaCobranza) || 0;
        metricas.facturasPendientes = Number(m.cantidadFacturasPendientes) || 0;
        metricas.facturasVencidas = Number(m.cantidadFacturasVencidas) || 0;
        metricas.cantidadFacturasEmitidas = Number(m.cantidadFacturasEmitidas) || 0;
        metricas.cantidadPagos = Number(m.cantidadPagos) || 0;
        metricas.cantidadFacturasConPago = Number(m.cantidadFacturasConPago) || 0;
        metricas.usaWhatsApp = m.usaWhatsApp || false;
        usaWhatsApp = !!m.usaWhatsApp;

        // Actualizar aging
        if (m.aging) {
          aging = m.aging;
        }

        cargando = false;

        // Crear gráficos después de cargar datos
        setTimeout(() => crearGraficos(m.ventasPorMes, m.resumenCobranza, m.topSaldoVencido), 100);
      }

    } catch (error) {
      console.error('Error al cargar datos:', error);
      cargando = false;
    }
  }

  async function crearGraficos(ventasPorMes: any[], resumenCobranza: any[], topSaldoVencido: any[]) {
    // import dinámico de Chart.js solo en cliente
    const Chart = (await import("chart.js/auto")).default;

    // Destruir gráficos existentes antes de crear nuevos
    if (chartVentas) chartVentas.destroy();
    if (chartResumenCobranza) chartResumenCobranza.destroy();
    if (chartTopSaldoVencido) chartTopSaldoVencido.destroy();
    if (chartAging) chartAging.destroy();

    // Gráfico de Ventas - Usar datos del backend
    if (canvasVentas && ventasPorMes) {
      const hoy = new Date();
      const labels = [];
      const datos = [];

      // Generar los últimos 4 meses
      for (let i = 3; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short' });
        labels.push(nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) + '.');

        // Buscar datos del backend para este mes
        const datosDelMes = ventasPorMes.find(v => Number(v.anio) === fecha.getFullYear() && Number(v.mes) === (fecha.getMonth() + 1));
        datos.push(datosDelMes?.totalventas || 0);
      }

      chartVentas = new Chart(canvasVentas, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Ventas",
              data: datos,
              backgroundColor: "#4ade80",
              borderRadius: 4,
              barThickness: 40
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#ffffff'
              }
            },
            y: {
              display: false,
              grid: {
                display: false
              }
            }
          }
        }
      });
    }

    // Gráfico Resumen de Cobranza - Usar datos del backend
    if (canvasResumenCobranza && resumenCobranza) {
      // Preparar labels según periodo
      const labels = resumenCobranza.map((r: any, i: number) => r.periodo || `Sem ${i + 1}`);
      const datosVigente = resumenCobranza.map(r => r.vigente || 0);
      const datosVencido = resumenCobranza.map(r => r.vencido || 0);
      const datosPagado = resumenCobranza.map(r => r.pagado || 0);

      chartResumenCobranza = new Chart(canvasResumenCobranza, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Vigente: " + formatearMoneda(datosVigente.reduce((a,b) => a+b, 0)),
              data: datosVigente,
              backgroundColor: "#3b82f6",
              borderRadius: 0
            },
            {
              label: "Vencido: " + formatearMoneda(datosVencido.reduce((a,b) => a+b, 0)),
              data: datosVencido,
              backgroundColor: "#ef4444",
              borderRadius: 0
            },
            {
              label: "Pagado: " + formatearMoneda(datosPagado.reduce((a,b) => a+b, 0)),
              data: datosPagado,
              backgroundColor: "#4ade80",
              borderRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                padding: 15
              }
            }
          },
          scales: {
            x: {
              stacked: true,
              grid: {
                display: false
              }
            },
            y: {
              stacked: true,
              beginAtZero: true,
              ticks: {
                callback: function(value: string | number) {
                  const v = Number(value);
                  return v >= 1000 ? '$' + (v/1000) + 'k' : '$' + v;
                }
              }
            }
          }
        }
      });
    }

    // Gráfico Top Saldo Vencido por Cliente - Usar datos del backend
    if (canvasTopSaldoVencido && topSaldoVencido) {
      const labels = topSaldoVencido.map(c => {
        // Truncar nombre si es muy largo
        const nombre = c.clientenombre || 'Sin nombre';
        return nombre.length > 25 ? nombre.substring(0, 25) + '...' : nombre;
      });
      const datos = topSaldoVencido.map(c => c.totalsaldovencido || 0);

      chartTopSaldoVencido = new Chart(canvasTopSaldoVencido, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Saldo Vencido",
              data: datos,
              backgroundColor: "#3b82f6",
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y', // Barras horizontales
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return formatearMoneda(context.parsed.x);
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: function(value: string | number) {
                  const v = Number(value);
                  return v >= 1000 ? '$' + (v/1000) + 'k' : '$' + v;
                }
              }
            },
            y: {
              ticks: {
                font: {
                  size: 11
                }
              }
            }
          }
        }
      });
    }

    if (canvasAging && totalAging > 0) {
      chartAging = new Chart(canvasAging, {
        type: 'doughnut',
        data: {
          labels: ['Vigente', '1-30 dias', '31-60 dias', '61-90 dias', '+90 dias'],
          datasets: [{
            data: [
              Number(aging.vigente.monto || 0),
              Number(aging.dias0_30.monto || 0),
              Number(aging.dias31_60.monto || 0),
              Number(aging.dias61_90.monto || 0),
              Number(aging.mas90.monto || 0)
            ],
            backgroundColor: ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444'],
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.label}: ${formatearMoneda(context.parsed)}`;
                }
              }
            }
          }
        }
      });
    }
  }

  onMount(() => {
    checkWhatsAppBannerDismissed();
    document.addEventListener('click', cerrarTooltips);

    return () => {
      document.removeEventListener('click', cerrarTooltips);
      if (chartVentas) chartVentas.destroy();
      if (chartResumenCobranza) chartResumenCobranza.destroy();
      if (chartTopSaldoVencido) chartTopSaldoVencido.destroy();
      if (chartAging) chartAging.destroy();
    };
  });

  // Cargar datos reactivamente cuando la organización esté disponible o cambie
  $: if ($orgIdStore) {
    sinOrganizacion = false;
    // Resetear estado de carga
    cargando = true;
    checkWhatsAppBannerDismissed();
    // Recargar datos cuando la organización esté disponible o cambie
    cargarDatos();
  } else if (browser) {
    // Usuario sin organización: dejar de cargar y mostrar pantalla de bienvenida
    cargando = false;
    sinOrganizacion = true;
  }

  // Recargar datos cuando cambie el período seleccionado
  let periodoAnterior = selectedPeriod;
  $: if (selectedPeriod !== periodoAnterior) {
    periodoAnterior = selectedPeriod;
    cargarDatos();
  }
</script>

<div class="space-y-6">
  {#if sinOrganizacion}
    <!-- Pantalla de bienvenida para usuarios sin organización -->
    <div class="flex items-center justify-center py-16">
      <div class="text-center max-w-md">
        <div class="mx-auto w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
          <svg class="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-3">¡Bienvenido a CuentIA Flow!</h2>
        <p class="text-gray-600 mb-8 leading-relaxed">
          Para comenzar a facturar y gestionar tu cobranza, primero necesitas crear tu organización con tus datos fiscales.
        </p>
        <a
          href="/dashboard/organizaciones/nueva"
          class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Crear mi organización
        </a>
        <p class="text-xs text-gray-400 mt-4">Solo toma un par de minutos</p>
      </div>
    </div>
  {:else}
  {#if usaWhatsApp && !whatsappBannerDismissed}
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
      <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
        <span class="text-lg">i</span>
      </div>
      <div class="flex-1">
        <h4 class="text-sm font-semibold text-blue-800">Recuerda validar tu conexion de WhatsApp</h4>
        <p class="text-sm text-blue-700 mt-1">
          Para que el Cobrador IA funcione correctamente, revisa
          <a href="/dashboard/configuracion" class="font-medium underline hover:text-blue-900">Configuracion -> WhatsApp</a>.
        </p>
      </div>
      <button
        on:click={dismissWhatsAppBanner}
        class="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
      >
        No volver a mostrar
      </button>
    </div>
  {/if}

  {#if cargando}
    <div class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-500">Cargando dashboard...</p>
      </div>
    </div>
  {:else}

  <!-- OnboardingChecklist -->
  <OnboardingChecklist organizacionId={get(orgIdStore)?.toString() || ''} />

  <!-- Tarjetas de resumen -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3">
      <div class="p-2 bg-blue-100 rounded-lg">
        <FileText class="w-5 h-5 text-blue-600" />
      </div>
      <div>
        <p class="text-xs text-gray-500">Facturas Emitidas</p>
        <p class="text-xl font-bold text-gray-900">{metricas.cantidadFacturasEmitidas}</p>
      </div>
    </div>
    <div class="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3">
      <div class="p-2 bg-yellow-100 rounded-lg">
        <Clock class="w-5 h-5 text-yellow-600" />
      </div>
      <div>
        <p class="text-xs text-gray-500">Pendientes</p>
        <p class="text-xl font-bold text-gray-900">{metricas.facturasPendientes}</p>
      </div>
    </div>
    <div class="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3">
      <div class="p-2 bg-red-100 rounded-lg">
        <AlertTriangle class="w-5 h-5 text-red-600" />
      </div>
      <div>
        <p class="text-xs text-gray-500">Vencidas</p>
        <p class="text-xl font-bold text-gray-900">{metricas.facturasVencidas}</p>
      </div>
    </div>
    <div class="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3">
      <div class="p-2 bg-green-100 rounded-lg">
        <TrendingUp class="w-5 h-5 text-green-600" />
      </div>
      <div>
        <p class="text-xs text-gray-500">Eficiencia</p>
        <p class="text-xl font-bold text-gray-900">{metricas.eficienciaCobranza.toFixed(1)}%</p>
      </div>
    </div>
  </div>

  <!-- Tarjetas principales -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Tarjeta FACTURACIÓN -->
    <div class="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 shadow-lg text-white">
      <div class="flex items-start justify-between mb-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <h2 class="text-sm font-semibold tracking-wide uppercase">FACTURACIÓN</h2>
            <button class="text-white/70 hover:text-white cursor-help tooltip-trigger relative" on:click|stopPropagation={() => toggleTooltip('cuentasPorCobrar')}>
              <HelpCircle class="w-4 h-4" />
              {#if tooltipAbierto === 'cuentasPorCobrar'}
                <div class="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg font-normal normal-case tracking-normal leading-relaxed">
                  {tooltips.cuentasPorCobrar}
                </div>
              {/if}
            </button>
          </div>
          <p class="text-4xl font-bold">{formatearMoneda(metricas.totalPorCobrar)}</p>
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-white/20">
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-medium">SALDO VENCIDO</span>
          <span class="text-lg font-bold">{formatearMoneda(metricas.saldoVencido)}</span>
        </div>

        <!-- Leyenda de aging -->
        <div class="flex flex-wrap gap-3 text-xs">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-red-500"></span>
            <span>Más de 90 días</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-orange-500"></span>
            <span>60 - 90 días</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span>30 - 60 días</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-blue-400"></span>
            <span>1 - 30 días</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tarjeta VENTAS -->
    <div class="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 shadow-lg text-white">
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <h2 class="text-sm font-semibold tracking-wide uppercase">VENTAS (Total Facturado)</h2>
            <button class="text-white/70 hover:text-white cursor-help tooltip-trigger relative" on:click|stopPropagation={() => toggleTooltip('ventas')}>
              <HelpCircle class="w-4 h-4" />
              {#if tooltipAbierto === 'ventas'}
                <div class="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg font-normal normal-case tracking-normal leading-relaxed">
                  {tooltips.ventas}
                </div>
              {/if}
            </button>
          </div>
          <div class="flex items-baseline gap-3 mb-4">
            <p class="text-4xl font-bold">{formatearMoneda(metricas.totalFacturado)}</p>
            <div class="flex items-center gap-1 text-green-400">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
              </svg>
              <span class="text-sm font-semibold">{metricas.eficienciaCobranza.toFixed(1)}%</span>
            </div>
          </div>

          <div class="border-t border-white/20 pt-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Total Cobrado</span>
              <span class="text-lg font-bold">{formatearMoneda(metricas.totalCobrado)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Gráfico de ventas -->
      <div class="mt-4 h-32">
        <canvas bind:this={canvasVentas}></canvas>
      </div>
    </div>
  </div>

  <!-- Gráficos de resumen -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Resumen de cobranza -->
    <div class="bg-white rounded-xl p-6 shadow-sm border">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-semibold text-blue-600">Resumen de cobranza</h3>
          <button class="text-gray-400 hover:text-gray-600 cursor-help tooltip-trigger relative" on:click|stopPropagation={() => toggleTooltip('resumenCobranza')}>
            <HelpCircle class="w-4 h-4" />
            {#if tooltipAbierto === 'resumenCobranza'}
              <div class="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg font-normal normal-case tracking-normal leading-relaxed">
                {tooltips.resumenCobranza}
              </div>
            {/if}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <label for="periodo-select" class="text-sm text-gray-600">Mostrar</label>
          <select
            id="periodo-select"
            bind:value={selectedPeriod}
            class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="Semana">Semana</option>
            <option value="Mes">Mes</option>
            <option value="Trimestre">Trimestre</option>
          </select>
        </div>
      </div>
      <div class="h-80">
        <canvas bind:this={canvasResumenCobranza}></canvas>
      </div>
    </div>

    <!-- Top saldo vencido por cliente -->
    <div class="bg-white rounded-xl p-6 shadow-sm border">
      <div class="flex items-center gap-2 mb-6">
        <h3 class="text-lg font-semibold text-blue-600">Top saldo vencido por cliente</h3>
        <button class="text-gray-400 hover:text-gray-600 cursor-help tooltip-trigger relative" on:click|stopPropagation={() => toggleTooltip('topSaldoVencido')}>
          <HelpCircle class="w-4 h-4" />
          {#if tooltipAbierto === 'topSaldoVencido'}
            <div class="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg font-normal normal-case tracking-normal leading-relaxed">
              {tooltips.topSaldoVencido}
            </div>
          {/if}
        </button>
      </div>
      <div class="h-80 flex items-center justify-center text-gray-400">
        <canvas bind:this={canvasTopSaldoVencido}></canvas>
      </div>
    </div>
  </div>

  <!-- Antigüedad de saldos (Aging) -->
  <div class="bg-white rounded-xl p-6 shadow-sm border">
    <div class="flex items-center gap-2 mb-6">
      <h3 class="text-lg font-semibold text-blue-600">Antigüedad de saldos</h3>
      <button class="text-gray-400 hover:text-gray-600 cursor-help tooltip-trigger relative" on:click|stopPropagation={() => toggleTooltip('aging')}>
        <HelpCircle class="w-4 h-4" />
        {#if tooltipAbierto === 'aging'}
          <div class="absolute z-50 left-1/2 -translate-x-1/2 top-6 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg font-normal normal-case tracking-normal leading-relaxed">
            {tooltips.aging}
          </div>
        {/if}
      </button>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="flex items-center justify-center">
        <div class="w-48 h-48 relative">
          {#if totalAging > 0}
            <canvas bind:this={canvasAging}></canvas>
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span class="text-xs text-gray-500">Total</span>
              <span class="text-sm font-bold text-gray-800">{formatearMoneda(totalAging)}</span>
            </div>
          {:else}
            <div class="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin datos</div>
          {/if}
        </div>
      </div>
      <div class="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div class="bg-green-50 rounded-lg p-3 border border-green-200">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
            <span class="text-xs font-medium text-green-700">Vigente</span>
          </div>
          <p class="text-lg font-bold text-green-800">{formatearMoneda(aging.vigente.monto)}</p>
          <p class="text-xs text-green-600">{aging.vigente.cantidad} facturas - {porcentajeAging(aging.vigente.monto)}%</p>
        </div>
        <div class="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span class="text-xs font-medium text-blue-700">1-30 dias</span>
          </div>
          <p class="text-lg font-bold text-blue-800">{formatearMoneda(aging.dias0_30.monto)}</p>
          <p class="text-xs text-blue-600">{aging.dias0_30.cantidad} facturas - {porcentajeAging(aging.dias0_30.monto)}%</p>
        </div>
        <div class="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            <span class="text-xs font-medium text-yellow-700">31-60 dias</span>
          </div>
          <p class="text-lg font-bold text-yellow-800">{formatearMoneda(aging.dias31_60.monto)}</p>
          <p class="text-xs text-yellow-600">{aging.dias31_60.cantidad} facturas - {porcentajeAging(aging.dias31_60.monto)}%</p>
        </div>
        <div class="bg-orange-50 rounded-lg p-3 border border-orange-200">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            <span class="text-xs font-medium text-orange-700">61-90 dias</span>
          </div>
          <p class="text-lg font-bold text-orange-800">{formatearMoneda(aging.dias61_90.monto)}</p>
          <p class="text-xs text-orange-600">{aging.dias61_90.cantidad} facturas - {porcentajeAging(aging.dias61_90.monto)}%</p>
        </div>
        <div class="bg-red-50 rounded-lg p-3 border border-red-200">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span class="text-xs font-medium text-red-700">+90 dias</span>
          </div>
          <p class="text-lg font-bold text-red-800">{formatearMoneda(aging.mas90.monto)}</p>
          <p class="text-xs text-red-600">{aging.mas90.cantidad} facturas - {porcentajeAging(aging.mas90.monto)}%</p>
        </div>
      </div>
    </div>
  </div>

  {/if}
  {/if}
</div>
