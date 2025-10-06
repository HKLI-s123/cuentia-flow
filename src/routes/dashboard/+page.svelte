<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from '$app/navigation';
  import { HelpCircle } from 'lucide-svelte';
  import { authFetch } from '$lib/api';

  let canvasVentas: HTMLCanvasElement;
  let canvasResumenCobranza: HTMLCanvasElement;
  let canvasTopSaldoVencido: HTMLCanvasElement;

  // Datos de métricas
  let metricas = {
    totalPorCobrar: 0,
    saldoVencido: 0,
    totalFacturado: 0,
    totalCobrado: 0,
    eficienciaCobranza: 0,
    facturasPendientes: 0,
    facturasVencidas: 0
  };

  let aging = {
    vigente: { cantidad: 0, monto: 0 },
    dias0_30: { cantidad: 0, monto: 0 },
    dias31_60: { cantidad: 0, monto: 0 },
    dias61_90: { cantidad: 0, monto: 0 },
    mas90: { cantidad: 0, monto: 0 }
  };

  let cargando = true;
  let selectedPeriod = 'Semana';

  // Función para formatear moneda
  function formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(valor);
  }

  // Cargar datos desde API
  async function cargarDatos() {
    try {
      const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
      const organizacionId = userData.organizacionId;

      if (!organizacionId) {
        return;
      }

      // Cargar métricas desde el nuevo endpoint
      const responseMetricas = await authFetch(`/api/dashboard/metricas?organizacionId=${organizacionId}`);

      if (!responseMetricas.ok) {
        throw new Error(`Error ${responseMetricas.status}: ${responseMetricas.statusText}`);
      }

      const dataMetricas = await responseMetricas.json();

      if (dataMetricas.success) {
        const m = dataMetricas.metricas;

        // Actualizar métricas principales
        metricas.totalPorCobrar = m.totalPorCobrar || 0;
        metricas.saldoVencido = m.saldoVencido || 0;
        metricas.totalFacturado = m.totalFacturado || 0;
        metricas.totalCobrado = m.totalCobrado || 0;
        metricas.eficienciaCobranza = m.eficienciaCobranza || 0;
        metricas.facturasPendientes = m.cantidadFacturasPendientes || 0;
        metricas.facturasVencidas = m.cantidadFacturasVencidas || 0;

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
        const datosDelMes = ventasPorMes.find(v => v.Anio === fecha.getFullYear() && v.Mes === (fecha.getMonth() + 1));
        datos.push(datosDelMes?.TotalVentas || 0);
      }

      new Chart(canvasVentas, {
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
      // Preparar datos para las últimas 4 semanas
      const labels = resumenCobranza.map((r, i) => `Sem ${i + 1}`);
      const datosVigente = resumenCobranza.map(r => r.Vigente || 0);
      const datosVencido = resumenCobranza.map(r => r.Vencido || 0);
      const datosPagado = resumenCobranza.map(r => r.Pagado || 0);

      new Chart(canvasResumenCobranza, {
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
                callback: function(value) {
                  return value >= 1000 ? '$' + (value/1000) + 'k' : '$' + value;
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
        const nombre = c.ClienteNombre || 'Sin nombre';
        return nombre.length > 25 ? nombre.substring(0, 25) + '...' : nombre;
      });
      const datos = topSaldoVencido.map(c => c.TotalSaldoVencido || 0);

      new Chart(canvasTopSaldoVencido, {
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
                callback: function(value) {
                  return value >= 1000 ? '$' + (value/1000) + 'k' : '$' + value;
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
  }

  onMount(() => {
    cargarDatos();
  });
</script>

<div class="space-y-6">
  <!-- Tarjetas principales -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Tarjeta CUENTAS POR COBRAR -->
    <div class="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 shadow-lg text-white">
      <div class="flex items-start justify-between mb-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <h2 class="text-sm font-semibold tracking-wide uppercase">CUENTAS POR COBRAR</h2>
            <button class="text-white/70 hover:text-white">
              <HelpCircle class="w-4 h-4" />
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
            <button class="text-white/70 hover:text-white">
              <HelpCircle class="w-4 h-4" />
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
          <button class="text-gray-400 hover:text-gray-600">
            <HelpCircle class="w-4 h-4" />
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
        <button class="text-gray-400 hover:text-gray-600">
          <HelpCircle class="w-4 h-4" />
        </button>
      </div>
      <div class="h-80 flex items-center justify-center text-gray-400">
        <canvas bind:this={canvasTopSaldoVencido}></canvas>
      </div>
    </div>
  </div>
</div>
