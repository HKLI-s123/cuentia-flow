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
    totalVentas: 0,
    facturasPendientes: 0,
    facturasVencidas: 0
  };

  let aging = {
    actual: { cantidad: 0, monto: 0 },
    dias30: { cantidad: 0, monto: 0 },
    dias60: { cantidad: 0, monto: 0 },
    dias90: { cantidad: 0, monto: 0 },
    mas90: { cantidad: 0, monto: 0 }
  };

  let facturas: any[] = [];
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

      const response = await authFetch(`/api/facturas?organizacionId=${organizacionId}&limit=100`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        facturas = data.facturas;

        // Calcular métricas
        metricas.totalPorCobrar = data.aging?.montoTotal || 0;
        metricas.facturasPendientes = data.aging?.totalFacturas || 0;

        // Calcular saldo vencido (facturas con estado vencida)
        const facturasVencidas = facturas.filter(f => f.estado.id === 4);
        metricas.saldoVencido = facturasVencidas.reduce((sum, f) => sum + (f.saldoPendiente || 0), 0);
        metricas.facturasVencidas = facturasVencidas.length;

        // Total de ventas (suma de todos los montos totales)
        metricas.totalVentas = facturas.reduce((sum, f) => sum + (f.montoTotal || 0), 0);

        // Actualizar aging
        if (data.aging) {
          aging = {
            actual: { cantidad: data.aging.rango0_30?.count || 0, monto: data.aging.rango0_30?.monto || 0 },
            dias30: { cantidad: data.aging.rango31_60?.count || 0, monto: data.aging.rango31_60?.monto || 0 },
            dias60: { cantidad: data.aging.rango61_90?.count || 0, monto: data.aging.rango61_90?.monto || 0 },
            dias90: { cantidad: data.aging.rango91_mas?.count || 0, monto: data.aging.rango91_mas?.monto || 0 },
            mas90: { cantidad: data.aging.rango91_mas?.count || 0, monto: data.aging.rango91_mas?.monto || 0 }
          };
        }

        cargando = false;

        // Crear gráficos después de cargar datos
        setTimeout(crearGraficos, 100);
      }
    } catch (error) {
      cargando = false;
    }
  }

  async function crearGraficos() {
    // import dinámico de Chart.js solo en cliente
    const Chart = (await import("chart.js/auto")).default;

    // Gráfico de Ventas - Calcular últimos 4 meses dinámicamente
    if (canvasVentas) {
      const hoy = new Date();
      const meses = [];
      const labels = [];

      // Generar los últimos 4 meses
      for (let i = 3; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        meses.push(fecha);
        const nombreMes = fecha.toLocaleDateString('es-ES', { month: 'short' });
        labels.push(nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1) + '.');
      }

      // Agrupar facturas por mes
      const ventasPorMes = new Array(4).fill(0);

      facturas.forEach(f => {
        const fechaFactura = new Date(f.fechaEmision);

        // Encontrar en qué mes cae
        for (let i = 0; i < meses.length; i++) {
          const mesActual = meses[i];
          const mesSiguiente = new Date(mesActual.getFullYear(), mesActual.getMonth() + 1, 1);

          if (fechaFactura >= mesActual && fechaFactura < mesSiguiente) {
            ventasPorMes[i] += f.montoTotal || 0;
            break;
          }
        }
      });

      new Chart(canvasVentas, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Ventas",
              data: ventasPorMes,
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

    // Gráfico Resumen de Cobranza - Últimas 4 semanas dinámicamente
    if (canvasResumenCobranza) {
      const hoy = new Date();
      const semanas = [];
      const labels = [];

      // Generar las últimas 4 semanas
      for (let i = 3; i >= 0; i--) {
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - (i * 7));
        semanas.push(inicioSemana);

        const dia = inicioSemana.getDate();
        const mes = inicioSemana.toLocaleDateString('es-ES', { month: 'short' });
        labels.push(`${dia}-${mes.charAt(0).toUpperCase() + mes.slice(1)}`);
      }

      // Agrupar facturas por semana
      const datosVigente = new Array(4).fill(0);
      const datosVencido = new Array(4).fill(0);
      const datosPagado = new Array(4).fill(0);

      facturas.forEach(f => {
        const fechaFactura = new Date(f.fechaEmision);

        // Encontrar en qué semana cae
        for (let i = 0; i < semanas.length; i++) {
          const inicioSemana = semanas[i];
          const finSemana = new Date(inicioSemana);
          finSemana.setDate(inicioSemana.getDate() + 7);

          if (fechaFactura >= inicioSemana && fechaFactura < finSemana) {
            // Vigente: estado pendiente y no vencida
            if (f.estado.id === 1 && (f.diasVencido || 0) <= 0) {
              datosVigente[i] += f.montoTotal || 0;
            }
            // Vencido: estado vencida
            else if (f.estado.id === 4) {
              datosVencido[i] += f.saldoPendiente || 0;
            }
            // Pagado: estado pagada
            else if (f.estado.id === 3) {
              datosPagado[i] += f.montoTotal || 0;
            }
            break;
          }
        }
      });

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

    // Gráfico Top Saldo Vencido por Cliente
    if (canvasTopSaldoVencido) {
      // Agrupar facturas vencidas por cliente
      const saldoPorCliente: { [key: string]: { nombre: string; saldo: number } } = {};

      facturas.forEach(f => {
        if (f.estado.id === 4 && f.saldoPendiente > 0) {
          const clienteId = f.cliente.id;
          const nombreCliente = f.cliente.razonSocial || 'Sin nombre';

          if (!saldoPorCliente[clienteId]) {
            saldoPorCliente[clienteId] = {
              nombre: nombreCliente,
              saldo: 0
            };
          }
          saldoPorCliente[clienteId].saldo += f.saldoPendiente;
        }
      });

      // Convertir a array y ordenar por saldo descendente
      const topClientes = Object.values(saldoPorCliente)
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 10); // Top 10 clientes

      const labels = topClientes.map(c => {
        // Truncar nombre si es muy largo
        return c.nombre.length > 25 ? c.nombre.substring(0, 25) + '...' : c.nombre;
      });
      const datos = topClientes.map(c => c.saldo);

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
        <div>
          <div class="flex items-center gap-2 mb-2">
            <h2 class="text-sm font-semibold tracking-wide uppercase">VENTAS</h2>
            <button class="text-white/70 hover:text-white">
              <HelpCircle class="w-4 h-4" />
            </button>
          </div>
          <div class="flex items-baseline gap-3">
            <p class="text-4xl font-bold">{formatearMoneda(metricas.totalVentas)}</p>
            <div class="flex items-center gap-1 text-green-400">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
              </svg>
              <span class="text-sm font-semibold">100%</span>
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
