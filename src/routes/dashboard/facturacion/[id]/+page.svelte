<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ChevronLeft, Download, Copy, RefreshCw, FileText } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { Button } from '$lib/components/ui';
  import ModalRecordatorios from '../ModalRecordatorios.svelte';
  import type { Factura } from '../types';
  import { formatearMoneda, formatearFecha } from '../utils';
  import { formatearMetodoPago, formatearFormaPago } from '$lib/utils/factura-format';
  import Swal from 'sweetalert2';
  import ModalPagos from '../../pagos/ModalAgregarPago.svelte';
 
  let modalPagosAbierto = false;

  // Obtener ID de la factura desde la URL
  $: facturaId = $page.params.id;

  // Estado
  let factura: Factura | null = null;
  let cargando = true;
  let error = '';
  let tabActivo: 'COBRANZA' | 'DETALLES' = 'COBRANZA';

  // Modal de recordatorios
  let modalRecordatoriosAbierto = false;
  let abrirFormularioRecordatorio = false;

  // Agente IA Cobranza
  let agenteIAActivo = false;
  let guardandoAgenteIA = false;

  // Recurrencia
  let desactivandoRecurrencia = false;

  // Estadísticas de recordatorios
  let statsRecordatorios = { Total: 0, Enviados: 0, Fallidos: 0 };

  // Estado de cancelación
  $: facturaCancelada = factura?.estado_factura_id === 6;

  // Cargar estadísticas de recordatorios
  async function cargarStatsRecordatorios() {
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');
      if (!organizacionId || !facturaId) return;

      const response = await authFetch(`/api/facturas/${facturaId}/recordatorios?organizacionId=${organizacionId}`);
      const data = await response.json();

      if (data.success && data.stats) {
        statsRecordatorios = {
          Total: data.stats.total || 0,
          Enviados: data.stats.Enviados || 0,
          Fallidos: data.stats.Fallidos || 0
        };
      }
    } catch (err) {
      console.error('Error al cargar stats recordatorios:', err);
    }
  }

  // Cargar configuración de cobranza (para Agente IA)
  async function cargarConfigCobranza() {
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');
      if (!organizacionId) return;

      // Si la factura ya tiene el campo, usarlo directamente
      if (factura && factura.agenteIAActivo !== undefined) {
        agenteIAActivo = factura.agenteIAActivo;
      }
    } catch (err) {
      console.error('Error al cargar config cobranza:', err);
    }
  }

  // Guardar estado del Agente IA para esta factura
  async function toggleAgenteIA() {
    if (!factura || guardandoAgenteIA) return;
    if (facturaCancelada) {
      Swal.fire({ icon: 'warning', title: 'Factura cancelada', text: 'No se puede modificar el agente IA en una factura cancelada.', confirmButtonColor: '#3b82f6' });
      return;
    }
    guardandoAgenteIA = true;

    const nuevoEstado = !agenteIAActivo;

    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');
      if (!organizacionId) return;

      const response = await authFetch(`/api/facturas/${factura.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizacionId, agenteIAActivo: nuevoEstado })
      });

      const data = await response.json();

      if (data.success) {
        agenteIAActivo = nuevoEstado;
        Swal.fire({
          icon: 'success',
          title: nuevoEstado ? 'Agente IA Activado' : 'Agente IA Desactivado',
          text: data.message,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'No se pudo guardar', confirmButtonColor: '#3b82f6' });
      }
    } catch (err) {
      console.error('Error al guardar agente IA:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error al guardar la configuración', confirmButtonColor: '#3b82f6' });
    } finally {
      guardandoAgenteIA = false;
    }
  }

  // Desactivar recurrencia de esta factura
  async function desactivarRecurrencia() {
    if (!factura || desactivandoRecurrencia) return;

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: 'Desactivar Recurrencia',
      text: '¿Estás seguro de desactivar la recurrencia? No se generarán más facturas automáticas desde este template.',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    desactivandoRecurrencia = true;
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');
      if (!organizacionId) return;

      const response = await authFetch(`/api/facturas/${factura.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizacionId, recurrenciaActiva: false })
      });

      const data = await response.json();

      if (data.success) {
        if (factura?.recurrencia) factura.recurrencia.activa = false;
        Swal.fire({
          icon: 'success',
          title: 'Recurrencia Desactivada',
          text: data.message,
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'No se pudo desactivar', confirmButtonColor: '#3b82f6' });
      }
    } catch (err) {
      console.error('Error al desactivar recurrencia:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error al desactivar la recurrencia', confirmButtonColor: '#3b82f6' });
    } finally {
      desactivandoRecurrencia = false;
    }
  }

  // Cargar datos de la factura
  async function cargarFactura() {
    cargando = true;
    error = '';

    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');

      const response = await authFetch(`/api/facturas/${facturaId}?organizacionId=${organizacionId}`);
      const data = await response.json();

      if (data.success && data.factura) {
        factura = {
          ...data.factura,
          estado_factura_id: data.factura.estado.id,
          prioridad_cobranza_id: data.factura.prioridad.id
        };
        agenteIAActivo = data.factura.agenteIAActivo || false;
      } else {
        error = data.error || 'No se encontró la factura';
      }
    } catch (err) {
      error = 'Error al cargar la factura';
    } finally {
      cargando = false;
    }
  }

  function volver() {
    goto('/dashboard/facturacion');
  }

  function abrirModalRecordatorios(abrirFormulario = false) {
    if (facturaCancelada) {
      Swal.fire({
        icon: 'warning',
        title: 'Factura cancelada',
        text: 'No se pueden enviar recordatorios para una factura cancelada.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }
    if (agenteIAActivo) {
      Swal.fire({
        icon: 'info',
        title: 'Cobrador IA activo',
        text: 'El cobrador IA está gestionando esta factura. Desactívalo para enviar recordatorios manualmente.',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }
    modalRecordatoriosAbierto = true;
    abrirFormularioRecordatorio = abrirFormulario;
  }

  function cerrarModal() {
    modalRecordatoriosAbierto = false;
    abrirFormularioRecordatorio = false;
  }



  async function visualizarPDF() {
    if (!factura) return;
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');

      if (!organizacionId) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se encontró la información de la organización',
          confirmButtonColor: '#3b82f6'
        });
        return;
      }

      const response = await authFetch(`/api/facturas/${factura.id}/pdf?organizacionId=${organizacionId}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Crear un link temporal para forzar la descarga con el nombre UUID
      const a = document.createElement('a');
      a.href = url;
      a.download = `${factura.uuid}.pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al visualizar PDF:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al visualizar el PDF',
        confirmButtonColor: '#3b82f6'
      });
    }
  }

  async function descargarXML() {
    if (!factura) return;
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');

      if (!organizacionId) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se encontró la información de la organización',
          confirmButtonColor: '#3b82f6'
        });
        return;
      }

      const response = await authFetch(`/api/facturas/${factura.id}/xml?organizacionId=${organizacionId}`);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${factura.uuid}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      // Mensaje de éxito
      Swal.fire({
        icon: 'success',
        title: 'Descarga exitosa',
        text: `El archivo XML de la factura ${factura.numero_factura} se ha descargado correctamente`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Error al descargar XML:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Error al descargar el XML',
        confirmButtonColor: '#3b82f6'
      });
    }
  }

  // Copiar detalles de factura al portapapeles
  async function copiarDetallesFactura() {
    if (!factura) return;

    let texto = `Factura: ${factura.numero_factura}\n`;
    texto += `Fecha de emisión: ${formatearFecha(factura.fechaEmision)}\n`;
    texto += `Fecha de vencimiento: ${formatearFecha(factura.fechaVencimiento)}\n`;
    texto += `Método de pago: ${formatearMetodoPago(factura.metodoPago || '')}\n`;
    texto += `Forma de pago: ${formatearFormaPago(factura.formaPago || '')}\n`;
    texto += `Condiciones de pago: ${factura.condicionesPago || 'No especificado'}\n`;
    if (factura.uuid) texto += `UUID: ${factura.uuid}\n`;
    texto += `\nCliente: ${factura.cliente?.razonSocial || 'N/A'}\n`;
    texto += `RFC: ${factura.cliente?.rfc || 'N/A'}\n`;
    texto += `\nConceptos:\n`;
    (factura.conceptos || []).forEach((c: any) => {
      texto += `  - ${c.nombre} x${c.cantidad} = ${formatearMoneda(c.total || 0)}\n`;
    });
    const subtotal = (factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.subtotal || 0), 0);
    const impuestos = (factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.totalImpuestos || 0), 0);
    texto += `\nSubtotal: ${formatearMoneda(subtotal)}\n`;
    texto += `Impuestos: ${formatearMoneda(impuestos)}\n`;
    texto += `Total: ${formatearMoneda(factura.montoTotal || 0)}\n`;
    texto += `Saldo Pendiente: ${formatearMoneda(factura.saldoPendiente || 0)}\n`;

    try {
      await navigator.clipboard.writeText(texto);
      Swal.fire({
        icon: 'success',
        title: 'Copiado',
        text: 'Detalles de la factura copiados al portapapeles',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  }

  // Descargar reporte Excel (CSV) de la factura
  function descargarExcelFactura() {
    if (!factura) return;

    const BOM = '\uFEFF';
    let csv = BOM;

    csv += `Factura,${factura.numero_factura}\n`;
    csv += `Fecha Emisión,"${formatearFecha(factura.fechaEmision)}"\n`;
    csv += `Fecha Vencimiento,"${formatearFecha(factura.fechaVencimiento)}"\n`;
    csv += `Cliente,"${factura.cliente?.razonSocial || 'N/A'}"\n`;
    csv += `RFC,${factura.cliente?.rfc || 'N/A'}\n`;
    csv += `Método de Pago,"${formatearMetodoPago(factura.metodoPago || '')}"\n`;
    csv += `Forma de Pago,"${formatearFormaPago(factura.formaPago || '')}"\n`;
    csv += `Condiciones de Pago,"${factura.condicionesPago || 'No especificado'}"\n`;
    if (factura.uuid) csv += `UUID,${factura.uuid}\n`;
    csv += `\n`;

    csv += `Producto,Cantidad,Subtotal,Impuesto,Total\n`;
    (factura.conceptos || []).forEach((c: any) => {
      csv += `"${(c.nombre || '').replace(/"/g, '""')}",${c.cantidad},${c.subtotal || 0},${c.totalImpuestos || 0},${c.total || 0}\n`;
    });
    csv += `\n`;

    const subtotal = (factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.subtotal || 0), 0);
    const impuestos = (factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.totalImpuestos || 0), 0);
    csv += `,,,Subtotal,${subtotal}\n`;
    csv += `,,,Impuestos,${impuestos}\n`;
    csv += `,,,Total,${factura.montoTotal || 0}\n`;
    csv += `,,,Saldo Pendiente,${factura.saldoPendiente || 0}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Factura_${factura.numero_factura}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Swal.fire({
      icon: 'success',
      title: 'Descarga exitosa',
      text: `El reporte de la factura ${factura.numero_factura} se ha descargado`,
      timer: 2000,
      showConfirmButton: false
    });
  }

  onMount(() => {
    cargarFactura().then(() => {
      cargarConfigCobranza();
      cargarStatsRecordatorios();
    });
  });
</script>

<div class="min-h-screen bg-gray-50">
  {#if cargando}
    <div class="flex items-center justify-center h-screen">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center h-screen">
      <p class="text-red-600 font-medium">{error}</p>
      <div class="mt-4">
        <Button variant="primary" size="md" on:click={volver}>
          Volver
        </Button>
      </div>
    </div>
  {:else if factura}
    <!-- Header con breadcrumb y botones -->
    <div class="bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <button on:click={volver} class="hover:text-gray-700">Facturación</button>
          <span>/</span>
          <button on:click={volver} class="hover:text-gray-700">Facturas</button>
          <span>/</span>
          <span class="text-blue-600">Detalle de {factura.numero_factura}</span>
        </div>

        <!-- Título y botones -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <button
              on:click={volver}
              class="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ChevronLeft class="w-5 h-5" />
            </button>
            <h1 class="text-lg sm:text-2xl font-bold text-gray-900 truncate">Factura {factura.numero_factura}</h1>
          </div>

          <div class="flex flex-wrap gap-2 sm:gap-3">
            {#if factura.timbrado}
              <Button variant="danger" size="md" on:click={visualizarPDF}>
                <Download class="w-4 h-4" />
                <span class="hidden sm:inline">PDF</span>
              </Button>
              <Button variant="secondary" size="md" on:click={descargarXML}>
                <Download class="w-4 h-4" />
                <span class="hidden sm:inline">XML</span>
              </Button>
            {/if}
            {#if !agenteIAActivo}
            <Button variant="primary" size="md" on:click={() => abrirModalRecordatorios(false)}>
              <span class="hidden sm:inline">ENVIAR RECORDATORIO</span>
              <span class="sm:hidden">RECORDATORIO</span>
            </Button>
            {/if}
              <Button
                variant="success"
                size="md"
                on:click={() => modalPagosAbierto = true}
                disabled={!factura.timbrado || factura.metodoPago === 'PUE' || (factura.saldoPendiente || 0) <= 0}
                title={factura.metodoPago === 'PUE' ? 'Las facturas PUE no requieren complemento de pago' : !factura.timbrado ? 'La factura debe estar timbrada para agregar pagos' : ''}
              >
                <span class="hidden sm:inline">AGREGAR PAGO</span>
                <span class="sm:hidden">PAGO</span>
              </Button>
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
                  <!-- Banner de factura cancelada -->
                  <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div class="flex items-center gap-2 mb-2">
                      <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <h3 class="text-sm font-semibold text-red-700 uppercase">Factura Cancelada</h3>
                    </div>
                    <p class="text-sm text-red-600">Esta factura ha sido cancelada. No es posible enviar recordatorios, activar el agente IA ni gestionar la cobranza.</p>
                  </div>

                  <!-- Vencimiento congelado -->
                  <div class="mb-6 opacity-50">
                    <h3 class="text-xs font-medium text-gray-400 uppercase mb-2">Vencimiento de Factura</h3>
                    <p class="text-lg text-gray-400">N/A — Factura cancelada</p>
                    <p class="text-sm text-gray-400">{formatearFecha(factura.fechaVencimiento)}</p>
                  </div>

                  <!-- Recordatorios (solo lectura) -->
                  <div class="mb-6 opacity-50">
                    <h3 class="text-xs font-medium text-gray-400 uppercase mb-3">Recordatorios</h3>
                    <div class="flex gap-6">
                      <div class="text-center">
                        <p class="text-xs text-gray-400 mb-1">ENVIADOS</p>
                        <p class="text-3xl font-bold text-gray-400">{statsRecordatorios.Enviados}</p>
                      </div>
                      <div class="text-center">
                        <p class="text-xs text-gray-400 mb-1">FALLIDOS</p>
                        <p class="text-3xl font-bold text-gray-400">{statsRecordatorios.Fallidos}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Agente IA deshabilitado -->
                  <div class="opacity-50">
                    <div class="flex items-center justify-between">
                      <h3 class="text-xs font-medium text-gray-400 uppercase">Agente IA Cobranza</h3>
                      <label class="relative inline-flex items-center">
                        <input type="checkbox" class="sr-only peer" disabled checked={false}>
                        <div class="w-11 h-6 bg-gray-200 rounded-full peer after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all opacity-50"></div>
                        <span class="ml-3 text-sm font-medium text-gray-400">No disponible</span>
                      </label>
                    </div>
                    <p class="text-xs text-gray-400 mt-2">El agente IA no está disponible para facturas canceladas.</p>
                  </div>
                {:else}
                <!-- Vencimiento de factura -->
                <div class="mb-6">
                  <div class="flex items-center justify-between mb-2">
                    <h3 class="text-xs font-medium text-gray-500 uppercase">Vencimiento de Factura</h3>
                  </div>
                  {#if (factura.diasVencido || 0) < 0}
                    <p class="text-2xl font-bold text-red-600 mb-1">Vencida hace {Math.abs(factura.diasVencido || 0)} días</p>
                  {:else if (factura.diasVencido || 0) === 0}
                    <p class="text-2xl font-bold text-yellow-600 mb-1">Vence hoy</p>
                  {:else}
                    <p class="text-2xl font-bold text-green-600 mb-1">En {factura.diasVencido || 0} días</p>
                  {/if}
                  <p class="text-sm text-gray-600">{formatearFecha(factura.fechaVencimiento)}</p>

                  <!-- Barra de salud de factura -->
                  <div class="mt-4">
                    {#if factura.fechaEmision && factura.fechaVencimiento}
                      {@const diasTotal = Math.max(1, Math.round((new Date(factura.fechaVencimiento).getTime() - new Date(factura.fechaEmision).getTime()) / 86400000))}
                      {@const diasRestantes = factura.diasVencido || 0}
                      {@const porcentajeSalud = Math.min(100, Math.max(0, (diasRestantes / diasTotal) * 100))}
                      <div class="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Salud de factura</span>
                        {#if diasRestantes < 0 && Math.abs(diasRestantes) > diasTotal}
                          <span class="text-red-600 font-medium">Crítica</span>
                        {:else if diasRestantes < 0}
                          <span class="text-orange-600 font-medium">Vencida</span>
                        {:else if porcentajeSalud < 30}
                          <span class="text-yellow-600 font-medium">Requiere atención</span>
                        {:else}
                          <span class="text-green-600 font-medium">Bueno</span>
                        {/if}
                      </div>
                      <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          class="h-2 rounded-full {diasRestantes < 0 && Math.abs(diasRestantes) > diasTotal ? 'bg-red-600' : diasRestantes < 0 ? 'bg-orange-600' : porcentajeSalud < 30 ? 'bg-yellow-600' : 'bg-green-600'}"
                          style="width: {porcentajeSalud}%"
                        ></div>
                      </div>
                      <div class="flex justify-between text-xs text-gray-600 mt-2">
                        <span>{formatearFecha(factura.fechaEmision)}</span>
                        <span>{formatearFecha(factura.fechaVencimiento)}</span>
                      </div>
                    {/if}
                  </div>
                </div>

                <!-- Pagos -->
                <div class="mb-6">
                  <h3 class="text-xs font-medium text-gray-500 uppercase mb-3">Pagos</h3>
                  <p class="text-sm text-gray-600">No hay pagos registrados</p>
                </div>

                <!-- Recordatorios -->
                <div class="mb-6">
                  <div class="flex items-center justify-between mb-3">
                    <h3 class="text-xs font-medium text-gray-500 uppercase">Recordatorios</h3>
                    {#if !agenteIAActivo}
                      <button
                        on:click={() => abrirModalRecordatorios(false)}
                        class="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Ver Historial
                      </button>
                    {/if}
                  </div>
                  {#if agenteIAActivo}
                    <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p class="text-xs text-blue-700">El cobrador IA está gestionando esta factura de forma autónoma. Para enviar recordatorios manualmente, desactiva el agente IA.</p>
                    </div>
                  {:else}
                    <div class="flex gap-6">
                      <div class="text-center">
                        <p class="text-xs text-gray-500 mb-1">ENVIADOS</p>
                        <p class="text-3xl font-bold text-blue-600">{statsRecordatorios.Enviados}</p>
                      </div>
                      <div class="text-center">
                        <p class="text-xs text-gray-500 mb-1">FALLIDOS</p>
                        <p class="text-3xl font-bold {statsRecordatorios.Fallidos > 0 ? 'text-red-500' : 'text-gray-400'}">{statsRecordatorios.Fallidos}</p>
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- Agente IA Cobranza -->
                <div>
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-medium text-gray-500 uppercase">Agente IA Cobranza</h3>
                    {#if factura.metodoPago === 'PUE'}
                      <span class="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">No disponible (PUE)</span>
                    {:else}
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        class="sr-only peer"
                        checked={agenteIAActivo}
                        disabled={guardandoAgenteIA}
                        on:change={toggleAgenteIA}
                      >
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 {guardandoAgenteIA ? 'opacity-50' : ''}"></div>
                      <span class="ml-3 text-sm font-medium {agenteIAActivo ? 'text-blue-600' : 'text-gray-500'}">
                        {guardandoAgenteIA ? 'Guardando...' : agenteIAActivo ? 'Activado' : 'Desactivado'}
                      </span>
                    </label>
                    {/if}
                  </div>
                  {#if factura.metodoPago === 'PUE'}
                    <p class="text-xs text-amber-700 mt-2">Las facturas PUE no requieren cobranza ya que el pago se recibe al momento de la facturación.</p>
                  {:else if agenteIAActivo}
                    <p class="text-xs text-blue-600 mt-2">El agente IA gestionará la cobranza de esta factura de forma autónoma.</p>
                  {:else}
                    <p class="text-xs text-gray-500 mt-2">La cobranza de esta factura se gestiona manualmente.</p>
                  {/if}
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

                  <!-- Factura -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="text-xs font-medium text-blue-600 uppercase">Factura</h4>
                      <p class="text-xs text-gray-500">EMITIDA POR:</p>
                    </div>
                    <p class="text-xs text-blue-600">{factura.usuarioCreadorCorreo || 'N/A'}</p>
                  </div>

                  <!-- Información del cliente -->
                  <div class="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Cliente</p>
                      <p class="text-sm font-medium text-blue-600">{factura.cliente?.razonSocial || 'N/A'}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">RFC</p>
                      <p class="text-sm font-medium text-gray-900">{factura.cliente?.rfc || 'N/A'}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Total</p>
                      <p class="text-sm font-medium text-gray-900">{formatearMoneda(factura.montoTotal || 0)}</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Saldo</p>
                      <p class="text-sm font-medium text-gray-900">{formatearMoneda(factura.saldoPendiente || 0)}</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Condiciones de pago</p>
                      <p class="text-sm font-medium text-gray-900">7 días</p>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 mb-1">Régimen Fiscal</p>
                      <p class="text-sm font-medium text-gray-900">{factura.cliente?.regimenFiscal || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <p class="text-xs text-gray-500 mb-1">Código Postal</p>
                    <p class="text-sm font-medium text-gray-900">{factura.cliente?.codigoPostal || 'N/A'}</p>
                  </div>

                  <!-- Sección de Recurrencia -->
                  {#if factura.facturaOrigenId}
                    <!-- Es una factura hija generada por recurrencia -->
                    <div class="pt-4 border-t">
                      <h4 class="text-xs font-medium text-gray-500 uppercase mb-2">Origen</h4>
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                          Recurrente
                        </span>
                        <a href="/dashboard/facturacion/{factura.facturaOrigenId}" class="text-sm text-blue-600 hover:underline">
                          Generada desde {factura.templateOrigenNumero || 'template'}
                        </a>
                      </div>
                    </div>
                  {/if}

                  {#if factura.recurrencia && (factura.recurrencia.activa || (factura.recurrencia.facturasGeneradas || 0) > 0)}
                    <!-- Es un template de recurrencia -->
                    <div class="pt-4 border-t">
                      <div class="flex items-center justify-between mb-3">
                        <h4 class="text-xs font-medium text-gray-500 uppercase">Recurrencia</h4>
                        {#if factura.recurrencia.activa}
                          <div class="flex items-center gap-2">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Activa</span>
                            <button
                              on:click={desactivarRecurrencia}
                              disabled={desactivandoRecurrencia || facturaCancelada}
                              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Desactivar recurrencia"
                            >
                              {#if desactivandoRecurrencia}
                                <svg class="animate-spin -ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              {/if}
                              Desactivar
                            </button>
                          </div>
                        {:else}
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Finalizada</span>
                        {/if}
                      </div>

                      <div class="text-sm text-gray-700 space-y-1">
                        <p>Período: <span class="font-medium">{factura.recurrencia.periodo || '—'}</span></p>
                        {#if factura.recurrencia.finRecurrencia === 'despues-de'}
                          <p>Ocurrencias: <span class="font-medium">{factura.recurrencia.facturasGeneradas}/{factura.recurrencia.numeroOcurrencias}</span></p>
                        {:else if factura.recurrencia.finRecurrencia === 'el-dia'}
                          <p>Hasta: <span class="font-medium">{factura.recurrencia.fechaFinRecurrencia ? formatearFecha(factura.recurrencia.fechaFinRecurrencia) : '—'}</span></p>
                        {:else}
                          <p>Generadas: <span class="font-medium">{factura.recurrencia.facturasGeneradas}</span></p>
                        {/if}
                        {#if factura.recurrencia.ultimaFacturaGenerada}
                          <p>Última generada: <span class="font-medium">{formatearFecha(factura.recurrencia.ultimaFacturaGenerada)}</span></p>
                        {/if}
                      </div>

                      <!-- Lista de facturas hijas -->
                      {#if factura.facturasHijas && factura.facturasHijas.length > 0}
                        <div class="mt-3">
                          <h5 class="text-xs font-medium text-gray-500 mb-2">Facturas generadas ({factura.facturasHijas.length})</h5>
                          <div class="space-y-1.5 max-h-48 overflow-y-auto">
                            {#each factura.facturasHijas as hija}
                              <a href="/dashboard/facturacion/{hija.id}" class="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors group">
                                <div class="flex items-center gap-2">
                                  <span class="text-sm font-medium text-blue-600 group-hover:underline">{hija.numeroFactura}</span>
                                  {#if hija.timbrado}
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500" title="Timbrada"></span>
                                  {:else}
                                    <span class="w-1.5 h-1.5 rounded-full bg-yellow-400" title="Sin timbrar"></span>
                                  {/if}
                                </div>
                                <div class="flex items-center gap-3 text-xs text-gray-500">
                                  <span>{formatearFecha(hija.fechaEmision)}</span>
                                  <span class="font-medium text-gray-700">{formatearMoneda(hija.montoTotal)}</span>
                                </div>
                              </a>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Columna derecha: DETALLES -->
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
            </div>
          </div>

          <!-- DOCUMENTOS CON RELACIÓN -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 class="text-sm font-bold text-gray-700 uppercase mb-6">DOCUMENTOS CON RELACIÓN</h3>
            <table class="w-full">
              <thead class="border-b border-gray-200">
                <tr>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">Folio</th>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">CFDI</th>
                  <th class="text-left text-sm text-gray-600 font-medium pb-3">UUID</th>
                  <th class="text-right text-sm text-gray-600 font-medium pb-3">Valor</th>
                  <th class="text-right text-sm text-gray-600 font-medium pb-3">Monto de pago</th>
                </tr>
              </thead>
              <tbody>
                <!-- Factura (Ingreso) -->
                <tr class="border-b border-gray-100">
                  <td class="py-4">
                    <span class="text-sm text-blue-600">{factura.numero_factura}</span>
                  </td>
                  <td class="py-4">
                    <span class="inline-flex items-center justify-center w-6 h-6 bg-blue-100 rounded text-xs text-blue-700 font-semibold">I</span>
                  </td>
                  <td class="py-4 text-sm text-gray-900 font-mono text-xs">{factura.uuid || '-'}</td>
                  <td class="py-4 text-right text-sm text-gray-900">{formatearMoneda(factura.montoTotal || 0)}</td>
                  <td class="py-4 text-right text-sm text-gray-400">-</td>
                </tr>
                <!-- Complementos de pago -->
                {#if factura.pagos && factura.pagos.length > 0}
                  {#each factura.pagos.filter(p => p.uuidPago) as pago}
                    <tr class="border-b border-gray-100">
                      <td class="py-4">
                        <span class="text-sm text-gray-700">Complemento</span>
                      </td>
                      <td class="py-4">
                        <span class="inline-flex items-center justify-center w-6 h-6 bg-green-100 rounded text-xs text-green-700 font-semibold">P</span>
                      </td>
                      <td class="py-4 text-sm text-gray-900 font-mono text-xs">{pago.uuidPago}</td>
                      <td class="py-4 text-right text-sm text-gray-400">-</td>
                      <td class="py-4 text-right text-sm text-gray-900">{formatearMoneda(pago.monto)}</td>
                    </tr>
                  {/each}
                {/if}
                <!-- Pagos sin timbrar -->
                {#if factura.pagos && factura.pagos.some(p => !p.uuidPago)}
                  {#each factura.pagos.filter(p => !p.uuidPago) as pago}
                    <tr class="border-b border-gray-100">
                      <td class="py-4">
                        <span class="text-sm text-gray-500">Pago</span>
                      </td>
                      <td class="py-4">
                        <span class="inline-flex items-center justify-center w-6 h-6 bg-gray-200 rounded text-xs text-gray-500">-</span>
                      </td>
                      <td class="py-4 text-sm text-gray-400 italic">Sin timbrar</td>
                      <td class="py-4 text-right text-sm text-gray-400">-</td>
                      <td class="py-4 text-right text-sm text-gray-900">{formatearMoneda(pago.monto)}</td>
                    </tr>
                  {/each}
                {/if}
                <!-- Sin pagos -->
                {#if !factura.pagos || factura.pagos.length === 0}
                  <tr>
                    <td colspan="5" class="py-4 text-center text-sm text-gray-400 italic">Sin complemento de pago</td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>

          <!-- FACTURA -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-sm font-bold text-gray-700 uppercase">FACTURA</h3>
              <div class="flex items-center gap-4">
                <button on:click={copiarDetallesFactura} class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Copiar detalles">
                  <Copy class="w-4 h-4 text-gray-600" />
                </button>
                <button on:click={cargarFactura} class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Actualizar">
                  <RefreshCw class="w-4 h-4 text-gray-600" />
                </button>
                <button on:click={descargarExcelFactura} class="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Descargar reporte Excel">
                  <FileText class="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            <div class="mb-4">
              <p class="text-xs text-blue-600 uppercase mb-1">EMITIDA POR:</p>
              <p class="text-sm text-blue-600">{factura.usuarioCreadorCorreo || 'N/A'}</p>
            </div>

            <div class="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-200">
              <div>
                <p class="text-sm text-gray-600 mb-2">Condiciones de pago</p>
                <p class="text-sm text-gray-900">{factura.condicionesPago || 'No especificado'}</p>
              </div>
              {#if factura.uuid}
                <div>
                  <p class="text-sm text-gray-600 mb-2">UUID (Timbrado)</p>
                  <p class="text-xs text-gray-900 font-mono">{factura.uuid}</p>
                </div>
              {/if}
            </div>

            <!-- Tabla de productos -->
            {#if factura.conceptos && factura.conceptos.length > 0}
              <table class="w-full mb-6">
                <thead class="border-b border-gray-200">
                  <tr>
                    <th class="text-left text-sm text-gray-600 font-medium pb-3">Producto</th>
                    <th class="text-center text-sm text-gray-600 font-medium pb-3">Cantidad</th>
                    <th class="text-right text-sm text-gray-600 font-medium pb-3">Subtotal (MXN)</th>
                    <th class="text-right text-sm text-gray-600 font-medium pb-3">Impuesto (MXN)</th>
                    <th class="text-right text-sm text-gray-600 font-medium pb-3">Total (MXN)</th>
                  </tr>
                </thead>
                <tbody>
                  {#each (factura.conceptos || []) as concepto}
                    <tr class="border-b border-gray-100">
                      <td class="py-4">
                        <p class="text-sm text-gray-900">{concepto.nombre}</p>
                        {#if concepto.descripcion}
                          <p class="text-xs text-gray-500 mt-1">{concepto.descripcion}</p>
                        {/if}
                        {#if concepto.claveProdServ}
                          <p class="text-xs text-gray-500 mt-1">Clave SAT: {concepto.claveProdServ}</p>
                        {/if}
                      </td>
                      <td class="py-4 text-center text-sm text-gray-900">
                        {concepto.cantidad}
                      </td>
                      <td class="py-4 text-right text-sm text-gray-900">
                        {formatearMoneda(concepto.subtotal || 0)}
                      </td>
                      <td class="py-4 text-right text-sm text-gray-900">
                        {formatearMoneda(concepto.totalImpuestos || 0)}
                      </td>
                      <td class="py-4 text-right text-sm text-gray-900">
                        {formatearMoneda(concepto.total || 0)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>

              <!-- Totales alineados a la derecha -->
              <div class="flex justify-end">
                <div class="w-80 space-y-2">
                  <div class="flex justify-between text-sm text-gray-600">
                    <span>Subtotal:</span>
                    <span>{formatearMoneda((factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.subtotal || 0), 0))}</span>
                  </div>
                  <div class="flex justify-between text-sm text-gray-600">
                    <span>Descuento:</span>
                    <span>$0 MXN</span>
                  </div>
                  <div class="flex justify-between text-sm text-gray-600">
                    <span>Impuestos:</span>
                    <span>{formatearMoneda((factura.conceptos || []).reduce((sum: number, c: any) => sum + (c.totalImpuestos || 0), 0))}</span>
                  </div>
                  <div class="flex justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Total:</span>
                    <span>{formatearMoneda(factura.montoTotal || 0)}</span>
                  </div>
                </div>
              </div>
            {:else}
              <p class="text-sm text-gray-500 py-8 text-center">No hay conceptos registrados</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Modal de Pagos -->
{#if factura}
  <ModalPagos
    bind:open={modalPagosAbierto}
    organizacionId={sessionStorage.getItem('organizacionActualId') || ''}
    facturaInicial={factura}
    clienteInicial={factura.cliente}
    abrirConFactura={true}
    on:pagoGuardado={cargarFactura}
  />
{/if}

<!-- Modal de Recordatorios -->
<ModalRecordatorios
  bind:abierto={modalRecordatoriosAbierto}
  bind:abrirFormulario={abrirFormularioRecordatorio}
  factura={factura}
  on:cerrar={cerrarModal}
/>
