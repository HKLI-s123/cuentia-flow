<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';
  import {
    Bot,
    Users,
    MessageSquare,
    Calendar,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    Clock,
    Phone,
    FileText,
    ChevronDown,
    ChevronUp,
    Shield,
    Zap,
    RefreshCw,
    Search,
    ToggleLeft,
    ToggleRight,
    HandCoins,
    Image,
    XCircle,
    Eye,
    CreditCard
  } from 'lucide-svelte';
  import { authFetch } from '$lib/api';
  import { hoyLocal, fechaLocal } from '$lib/utils/date';
  import { Badge } from '$lib/components/ui';
  import Swal from 'sweetalert2';

  // Datos del API
  let clientes: any[] = [];
  let metricas = {
    totalClientes: 0,
    totalFacturas: 0,
    facturasContactadasHoy: 0,
    facturasConPromesa: 0,
    facturasRequierenHumano: 0,
    facturasPendienteConfirmacion: 0,
    montoTotalPendiente: 0
  };

  let cargando = true;
  let error = '';
  let filtroTexto = '';
  let clienteExpandido: number | null = null;

  // Recordatorio de WhatsApp
  let whatsappBannerDismissed = false;

  function checkWhatsAppBannerDismissed() {
    const orgId = get(orgIdStore)?.toString() || null;
    if (orgId) {
      whatsappBannerDismissed = localStorage.getItem(`wa_banner_dismissed_${orgId}`) === 'true';
    }
  }

  function dismissWhatsAppBanner() {
    const orgId = get(orgIdStore)?.toString() || null;
    if (orgId) {
      localStorage.setItem(`wa_banner_dismissed_${orgId}`, 'true');
    }
    whatsappBannerDismissed = true;
  }

  // Modal confirmar pago
  let modalConfirmarPago = false;
  let facturaConfirmando: any = null;
  let clienteConfirmando: any = null;
  let montoConfirmacion = 0;
  let metodoConfirmacion = '03';
  let fechaConfirmacion = hoyLocal();
  let confirmandoPago = false;

  // Comprobantes de pago recibidos
  let comprobantes: any[] = [];
  let cargandoComprobantes = false;
  let modalComprobante = false;
  let comprobanteSeleccionado: any = null;
  let comprobanteImagen: string | null = null;
  let cargandoImagen = false;
  let procesandoComprobante = false;
  let motivoRechazoInput = '';
  // Editable fields for confirmation
  let comprobanteMontoEdit = 0;
  let comprobanteMetodoEdit = '03';
  let comprobanteFechaEdit = '';
  // Multi-factura: facturas del cliente para distribuir pago
  let facturasCliente: any[] = [];
  let facturasSeleccionadas: Record<number, boolean> = {};
  let montosFacturas: Record<number, number> = {};
  let cargandoFacturas = false;
  let aplicarParcial = false;

  // Calcula el total asignado a facturas seleccionadas
  $: totalAsignado = Object.entries(facturasSeleccionadas)
    .filter(([_, sel]) => sel)
    .reduce((sum, [id]) => sum + (montosFacturas[parseInt(id)] || 0), 0);

  // Monto restante sin asignar
  $: montoRestante = comprobanteMontoEdit - totalAsignado;

  // Detectar si alguna factura seleccionada recibirá un pago parcial (monto < saldo)
  $: hayPagoParcial = facturasCliente.some((f: any) =>
    facturasSeleccionadas[f.facturaid] &&
    (montosFacturas[f.facturaid] || 0) < parseFloat(f.saldopendiente)
  );

  // Formatear moneda
  function formatMoney(n: number): string {
    return (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  // Formatear fecha (UTC para evitar desfase de timezone)
  function formatDate(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  // Formatear fecha relativa (UTC para evitar desfase)
  function formatRelativeDate(d: string | null): string {
    if (!d) return '—';
    const date = new Date(d);
    const now = new Date();
    // Comparar solo fechas en UTC
    const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const diffDays = Math.round((utcDate - utcNow) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays === -1) return 'Ayer';
    if (diffDays > 0) return `En ${diffDays} días`;
    return `Hace ${Math.abs(diffDays)} días`;
  }

  // Obtener badge de resultado
  function getResultadoBadge(resultado: string | null): { variant: 'success' | 'warning' | 'danger' | 'info' | 'gray'; label: string } {
    switch (resultado) {
      case 'contactado': return { variant: 'info', label: 'Contactado' };
      case 'promesa_pago': return { variant: 'warning', label: 'Promesa de Pago' };
      case 'confirma_pago': return { variant: 'success', label: 'Confirma Pago' };
      case 'no_contesta': return { variant: 'gray', label: 'No Contesta' };
      case 'disputa': return { variant: 'danger', label: 'Disputa' };
      case 'solicita_hablar_humano': return { variant: 'danger', label: 'Requiere Humano' };
      case 'pago_parcial': return { variant: 'warning', label: 'Pago Parcial' };
      default: return { variant: 'gray', label: resultado || 'Sin contactar' };
    }
  }

  // Cargar datos
  async function cargarDatos() {
    cargando = true;
    error = '';
    try {
      const res = await authFetch('/api/cobrador-ia');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al cargar datos');
      }
      const data = await res.json();
      clientes = data.clientes || [];
      metricas = data.metricas || metricas;
    } catch (err: any) {
      error = err.message || 'Error de conexión';
      console.error('[COBRADOR-IA] Error:', err);
    } finally {
      cargando = false;
    }
  }

  // Toggle auto complemento
  async function toggleAutoComplemento(clienteId: number, valorActual: boolean) {
    try {
      const res = await authFetch('/api/cobrador-ia', {
        method: 'PATCH',
        body: JSON.stringify({
          clienteId,
          autoComplementoPago: !valorActual
        })
      });

      if (res.ok) {
        // Actualizar localmente
        clientes = clientes.map(c => {
          if (c.clienteId === clienteId) {
            return { ...c, autoComplementoPago: !valorActual };
          }
          return c;
        });
      } else {
        const data = await res.json();
        Swal.fire('Error', data.error || 'Error al actualizar', 'error');
      }
    } catch (err) {
      console.error('[COBRADOR-IA] Error toggle:', err);
      Swal.fire('Error', 'Error de conexión', 'error');
    }
  }

  // Abrir modal confirmar pago
  function abrirConfirmarPago(cliente: any, factura: any) {
    clienteConfirmando = cliente;
    facturaConfirmando = factura;
    montoConfirmacion = factura.montoComprobante || factura.saldoPendiente;
    metodoConfirmacion = '03';
    fechaConfirmacion = hoyLocal();
    modalConfirmarPago = true;
  }

  // Confirmar pago
  async function confirmarPago() {
    if (!facturaConfirmando || confirmandoPago) return;
    confirmandoPago = true;

    try {
      const res = await authFetch('/api/cobrador-ia/confirmar-pago', {
        method: 'POST',
        body: JSON.stringify({
          facturaId: facturaConfirmando.facturaId,
          monto: montoConfirmacion,
          metodoPago: metodoConfirmacion,
          fechaPago: fechaConfirmacion
        })
      });

      const data = await res.json();

      if (res.status === 403) {
        Swal.fire({
          icon: 'warning',
          title: 'Función no disponible',
          html: `<p>${data.error}</p><p class="mt-2 text-sm text-gray-500">Actualiza tu plan para usar el Cobrador IA.</p>`,
          confirmButtonText: 'Ver planes',
          showCancelButton: true,
          cancelButtonText: 'Cerrar',
          confirmButtonColor: '#7c3aed'
        }).then((r) => { if (r.isConfirmed) window.location.href = '/dashboard/configuracion'; });
      } else if (res.ok && data.success) {
        modalConfirmarPago = false;
        facturaConfirmando = null;
        clienteConfirmando = null;
        await cargarDatos();
        Swal.fire({
          title: 'Pago Confirmado',
          text: 'El pago se registró correctamente',
          icon: 'success',
          timer: 3000,
          showConfirmButton: true
        });
      } else {
        Swal.fire('Error', data.error || 'Error al confirmar pago', 'error');
      }
    } catch (err) {
      console.error('[COBRADOR-IA] Error confirmar:', err);
      Swal.fire('Error', 'Error de conexión', 'error');
    } finally {
      confirmandoPago = false;
    }
  }

  // Expandir/colapsar cliente
  function toggleCliente(clienteId: number) {
    clienteExpandido = clienteExpandido === clienteId ? null : clienteId;
  }

  // Filtrar clientes
  $: clientesFiltrados = clientes.filter(c => {
    if (!filtroTexto) return true;
    const texto = filtroTexto.toLowerCase();
    return (
      c.clienteNombre?.toLowerCase().includes(texto) ||
      c.clienteRFC?.toLowerCase().includes(texto) ||
      c.clienteTelefono?.includes(texto) ||
      c.facturas?.some((f: any) => f.numeroFactura?.toLowerCase().includes(texto))
    );
  });

  // Métodos de pago SAT
  const metodosPago: Record<string, string> = {
    '01': 'Efectivo',
    '02': 'Cheque nominativo',
    '03': 'Transferencia electrónica',
    '04': 'Tarjeta de crédito',
    '28': 'Tarjeta de débito',
    '99': 'Por definir'
  };

  // Helpers para calcular estado de cliente
  function clienteTieneAlerta(cliente: any): boolean {
    return cliente.facturas.some((f: any) => f.requiereAtencionHumana);
  }
  function clienteTienePendiente(cliente: any): boolean {
    return cliente.facturas.some((f: any) => f.pendienteConfirmacion && !f.pagoConfirmado);
  }
  function clienteContactadoHoy(cliente: any): boolean {
    return cliente.facturas.some((f: any) => f.mensajesHoy > 0);
  }
  function clienteSaldoTotal(cliente: any): number {
    return cliente.facturas.reduce((s: number, f: any) => s + (f.saldoPendiente || 0), 0);
  }

  // Cargar comprobantes pendientes
  async function cargarComprobantes() {
    cargandoComprobantes = true;
    try {
      const res = await authFetch('/api/cobrador-ia/comprobantes?estado=pendiente');
      if (res.status === 403) {
        const data = await res.json();
        Swal.fire({
          icon: 'warning',
          title: 'Función no disponible',
          html: `<p>${data.error}</p><p class="mt-2 text-sm text-gray-500">Actualiza tu plan para usar el Cobrador IA.</p>`,
          confirmButtonText: 'Ver planes',
          showCancelButton: true,
          cancelButtonText: 'Cerrar',
          confirmButtonColor: '#7c3aed'
        }).then((r) => { if (r.isConfirmed) window.location.href = '/dashboard/configuracion'; });
        return;
      }
      if (res.ok) {
        const data = await res.json();
        comprobantes = data.comprobantes || [];
      }
    } catch (err) {
      console.error('[COBRADOR-IA] Error cargando comprobantes:', err);
    } finally {
      cargandoComprobantes = false;
    }
  }

  // Ver comprobante (abrir modal + cargar imagen + facturas del cliente)
  async function verComprobante(comp: any) {
    comprobanteSeleccionado = comp;
    comprobanteImagen = null;
    motivoRechazoInput = '';
    comprobanteMontoEdit = comp.montodetectado || comp.saldopendiente || 0;
    comprobanteMetodoEdit = comp.metodopagodetectado || '03';
    comprobanteFechaEdit = comp.fechapagodetectada
      ? fechaLocal(comp.fechapagodetectada)
      : hoyLocal();
    facturasCliente = [];
    facturasSeleccionadas = {};
    montosFacturas = {};
    aplicarParcial = false;
    modalComprobante = true;

    // Cargar imagen y facturas del cliente en paralelo
    cargandoImagen = true;
    cargandoFacturas = true;

    const [imagenRes, facturasRes] = await Promise.allSettled([
      authFetch(`/api/cobrador-ia/comprobantes/imagen?id=${comp.id}`).then(r => r.json()),
      authFetch('/api/cobrador-ia/comprobantes', {
        method: 'POST',
        body: JSON.stringify({ comprobanteId: comp.id })
      }).then(r => r.json())
    ]);

    // Procesar imagen
    if (imagenRes.status === 'fulfilled' && imagenRes.value.success && imagenRes.value.imageBase64) {
      comprobanteImagen = `data:${imagenRes.value.mimetype};base64,${imagenRes.value.imageBase64}`;
    }
    cargandoImagen = false;

    // Procesar facturas del cliente
    if (facturasRes.status === 'fulfilled' && facturasRes.value.success) {
      facturasCliente = facturasRes.value.facturas || [];
      // Pre-seleccionar la factura original del comprobante y asignar su saldo
      for (const f of facturasCliente) {
        const saldo = parseFloat(f.saldopendiente);
        if (f.facturaid === comp.facturaid) {
          facturasSeleccionadas[f.facturaid] = true;
          montosFacturas[f.facturaid] = Math.min(comprobanteMontoEdit, saldo);
        } else {
          facturasSeleccionadas[f.facturaid] = false;
          montosFacturas[f.facturaid] = 0;
        }
      }
      // Si monto del comprobante > saldo de factura original, auto-distribuir el sobrante
      autoDistribuirMonto();
    }
    cargandoFacturas = false;
  }

  // Auto-distribuir monto entre facturas seleccionadas (más antigua primero)
  function autoDistribuirMonto() {
    const montoTotal = comprobanteMontoEdit;
    let restante = montoTotal;

    for (const f of facturasCliente) {
      if (!facturasSeleccionadas[f.facturaid]) {
        montosFacturas[f.facturaid] = 0;
        continue;
      }
      const saldo = parseFloat(f.saldopendiente);
      const asignar = Math.min(restante, saldo);
      montosFacturas[f.facturaid] = parseFloat(asignar.toFixed(2));
      restante = parseFloat((restante - asignar).toFixed(2));
    }
    // Trigger reactivity
    montosFacturas = { ...montosFacturas };
  }

  // Calcular total asignado manualmente (no depende de reactive $: que puede estar desfasado)
  function calcularTotalAsignadoActual(): number {
    return Object.entries(facturasSeleccionadas)
      .filter(([_, sel]) => sel)
      .reduce((sum, [id]) => sum + (montosFacturas[parseInt(id)] || 0), 0);
  }

  // Toggle factura on/off y redistribuir
  function toggleFactura(facturaId: number) {
    facturasSeleccionadas[facturaId] = !facturasSeleccionadas[facturaId];
    facturasSeleccionadas = { ...facturasSeleccionadas };
    if (facturasSeleccionadas[facturaId]) {
      // Al seleccionar, calcular cuánto queda disponible del comprobante
      const f = facturasCliente.find((x: any) => x.facturaid === facturaId);
      if (f) {
        const saldo = parseFloat(f.saldopendiente);
        // Sumar lo asignado a OTRAS facturas seleccionadas (excluir esta)
        const asignadoOtras = Object.entries(facturasSeleccionadas)
          .filter(([id, sel]) => sel && parseInt(id) !== facturaId)
          .reduce((sum, [id]) => sum + (montosFacturas[parseInt(id)] || 0), 0);
        const disponible = comprobanteMontoEdit - asignadoOtras;
        montosFacturas[facturaId] = parseFloat(Math.min(disponible > 0 ? disponible : 0, saldo).toFixed(2));
        montosFacturas = { ...montosFacturas };
      }
    } else {
      // Al deseleccionar, poner monto a 0
      montosFacturas[facturaId] = 0;
      montosFacturas = { ...montosFacturas };
    }
  }

  // Confirmar comprobante (multi-factura)
  async function confirmarComprobante() {
    if (!comprobanteSeleccionado || procesandoComprobante) return;

    // Construir lista de facturas seleccionadas
    const facSeleccionadas = facturasCliente
      .filter((f: any) => facturasSeleccionadas[f.facturaid] && montosFacturas[f.facturaid] > 0)
      .map((f: any) => ({
        facturaId: f.facturaid,
        monto: montosFacturas[f.facturaid]
      }));

    if (facSeleccionadas.length === 0) {
      Swal.fire('Error', 'Selecciona al menos una factura para aplicar el pago', 'warning');
      return;
    }

    procesandoComprobante = true;

    try {
      const res = await authFetch('/api/cobrador-ia/comprobantes', {
        method: 'PATCH',
        body: JSON.stringify({
          comprobanteId: comprobanteSeleccionado.id,
          accion: 'confirmar',
          metodoPago: comprobanteMetodoEdit,
          fechaPago: comprobanteFechaEdit,
          facturasSeleccionadas: facSeleccionadas
        })
      });

      const data = await res.json();
      if (res.status === 403) {
        Swal.fire({
          icon: 'warning',
          title: 'Función no disponible',
          html: `<p>${data.error}</p><p class="mt-2 text-sm text-gray-500">Actualiza tu plan para usar el Cobrador IA.</p>`,
          confirmButtonText: 'Ver planes',
          showCancelButton: true,
          cancelButtonText: 'Cerrar',
          confirmButtonColor: '#7c3aed'
        }).then((r) => { if (r.isConfirmed) window.location.href = '/dashboard/configuracion'; });
      } else if (res.ok && data.success) {
        modalComprobante = false;
        comprobanteSeleccionado = null;
        await Promise.all([cargarDatos(), cargarComprobantes()]);

        const resultados = data.resultados || [];
        const timbrados = resultados.filter((r: any) => r.timbrado).length;

        if (resultados.length > 1) {
          const detalles = resultados.map((r: any) =>
            `<li>${r.numeroFactura}: ${formatMoney(r.montoAplicado)} ${r.timbrado ? '🧾' : ''} ${r.nuevoSaldo <= 0 ? '✅' : `(saldo: ${formatMoney(r.nuevoSaldo)})`}</li>`
          ).join('');
          Swal.fire({
            title: `Pago aplicado a ${resultados.length} facturas`,
            html: `<ul style="text-align:left;list-style:none;padding:0">${detalles}</ul>${timbrados > 0 ? `<br><small>${timbrados} complemento${timbrados > 1 ? 's' : ''} timbrado${timbrados > 1 ? 's' : ''} en Facturapi</small>` : ''}`,
            icon: 'success',
            timer: 8000,
            showConfirmButton: true
          });
        } else if (resultados.length === 1 && resultados[0].timbrado) {
          Swal.fire({
            title: 'Pago Confirmado y Timbrado',
            html: `Complemento timbrado en Facturapi<br><small>UUID: ${resultados[0].uuidComplemento}</small>`,
            icon: 'success',
            timer: 5000,
            showConfirmButton: true
          });
        } else {
          Swal.fire({
            title: 'Pago Confirmado',
            text: 'Pago registrado correctamente',
            icon: 'success',
            timer: 4000,
            showConfirmButton: true
          });
        }
      } else {
        Swal.fire('Error', data.error || 'Error al confirmar comprobante', 'error');
      }
    } catch (err) {
      console.error('[COBRADOR-IA] Error confirmando comprobante:', err);
      Swal.fire('Error', 'Error de conexión al confirmar comprobante', 'error');
    } finally {
      procesandoComprobante = false;
    }
  }

  // Rechazar comprobante
  async function rechazarComprobante() {
    if (!comprobanteSeleccionado || procesandoComprobante) return;
    procesandoComprobante = true;

    try {
      const res = await authFetch('/api/cobrador-ia/comprobantes', {
        method: 'PATCH',
        body: JSON.stringify({
          comprobanteId: comprobanteSeleccionado.id,
          accion: 'rechazar',
          motivoRechazo: motivoRechazoInput.trim() || null
        })
      });

      const data = await res.json();
      if (res.status === 403) {
        Swal.fire({
          icon: 'warning',
          title: 'Función no disponible',
          html: `<p>${data.error}</p><p class="mt-2 text-sm text-gray-500">Actualiza tu plan para usar el Cobrador IA.</p>`,
          confirmButtonText: 'Ver planes',
          showCancelButton: true,
          cancelButtonText: 'Cerrar',
          confirmButtonColor: '#7c3aed'
        }).then((r) => { if (r.isConfirmed) window.location.href = '/dashboard/configuracion'; });
      } else if (res.ok && data.success) {
        modalComprobante = false;
        comprobanteSeleccionado = null;
        await Promise.all([cargarDatos(), cargarComprobantes()]);
        Swal.fire({
          title: 'Comprobante Rechazado',
          text: 'El comprobante fue rechazado correctamente',
          icon: 'info',
          timer: 3000,
          showConfirmButton: true
        });
      } else {
        Swal.fire('Error', data.error || 'Error al rechazar comprobante', 'error');
      }
    } catch (err) {
      console.error('[COBRADOR-IA] Error rechazando comprobante:', err);
      Swal.fire('Error', 'Error de conexión al rechazar comprobante', 'error');
    } finally {
      procesandoComprobante = false;
    }
  }

  // Formatear fecha y hora
  function formatDateTime(d: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  onMount(() => {
    checkWhatsAppBannerDismissed();
    cargarDatos();
    cargarComprobantes();
  });
</script>

<!-- Recordatorio WhatsApp -->
{#if metricas.totalFacturas > 0 && !whatsappBannerDismissed}
  <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
    <div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
      <span class="text-lg">💡</span>
    </div>
    <div class="flex-1">
      <h4 class="text-sm font-semibold text-blue-800">Recuerda validar tu conexión de WhatsApp</h4>
      <p class="text-sm text-blue-700 mt-1">
        Para que el Cobrador IA funcione correctamente, accede a
        <a href="/dashboard/configuracion" class="font-medium underline hover:text-blue-900">Configuración → WhatsApp</a>
        y espera 30 segundos para validar tu conexión.
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

<!-- KPI Cards -->
<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
    <div class="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-blue-100 rounded-lg">
      <Users class="w-5 h-5 text-blue-600" />
    </div>
    <p class="text-2xl font-bold text-slate-900">{metricas.totalClientes}</p>
    <p class="text-xs text-slate-500 mt-1">Clientes IA</p>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
    <div class="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-green-100 rounded-lg">
      <MessageSquare class="w-5 h-5 text-green-600" />
    </div>
    <p class="text-2xl font-bold text-slate-900">{metricas.facturasContactadasHoy}</p>
    <p class="text-xs text-slate-500 mt-1">Facturas Contactadas Hoy</p>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
    <div class="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-yellow-100 rounded-lg">
      <Calendar class="w-5 h-5 text-yellow-600" />
    </div>
    <p class="text-2xl font-bold text-slate-900">{metricas.facturasConPromesa}</p>
    <p class="text-xs text-slate-500 mt-1">Facturas con Promesa</p>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
    <div class="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-red-100 rounded-lg">
      <AlertTriangle class="w-5 h-5 text-red-600" />
    </div>
    <p class="text-2xl font-bold text-slate-900">{metricas.facturasRequierenHumano}</p>
    <p class="text-xs text-slate-500 mt-1">Facturas Atención Humana</p>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
    <div class="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-orange-100 rounded-lg">
      <HandCoins class="w-5 h-5 text-orange-600" />
    </div>
    <p class="text-2xl font-bold text-slate-900">{metricas.facturasPendienteConfirmacion}</p>
    <p class="text-xs text-slate-500 mt-1">Facturas Pendiente Confirmar</p>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
    <div class="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-purple-100 rounded-lg">
      <FileText class="w-5 h-5 text-purple-600" />
    </div>
    <p class="text-2xl font-bold text-slate-900">{metricas.totalFacturas}</p>
    <p class="text-xs text-slate-500 mt-1">Facturas Activas</p>
  </div>

  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 text-center">
    <div class="flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-emerald-100 rounded-lg">
      <DollarSign class="w-5 h-5 text-emerald-600" />
    </div>
    <p class="text-2xl font-bold text-slate-900 text-base">{formatMoney(metricas.montoTotalPendiente)}</p>
    <p class="text-xs text-slate-500 mt-1">Monto Pendiente</p>
  </div>
</div>

<!-- Toolbar -->
<div class="flex items-center gap-3 mb-4">
  <div class="relative flex-1 max-w-md">
    <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
    <input
      type="text"
      bind:value={filtroTexto}
      placeholder="Buscar por cliente, RFC o factura..."
      class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
    />
  </div>

  <button
    on:click={cargarDatos}
    class="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
    disabled={cargando}
  >
    <RefreshCw class="w-4 h-4 {cargando ? 'animate-spin' : ''}" />
    Actualizar
  </button>
</div>

<!-- Comprobantes de pago pendientes -->
{#if comprobantes.length > 0}
  <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 mb-6">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
        <Image class="w-5 h-5 text-orange-600" />
      </div>
      <div>
        <h3 class="text-sm font-bold text-orange-900">Comprobantes de Pago Recibidos</h3>
        <p class="text-xs text-orange-700">{comprobantes.length} comprobante{comprobantes.length !== 1 ? 's' : ''} pendiente{comprobantes.length !== 1 ? 's' : ''} de revisión</p>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each comprobantes as comp (comp.id)}
        <div class="bg-white rounded-lg border border-orange-200 p-4 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-900 truncate">{comp.clientenombre}</p>
              <p class="text-xs text-slate-500">{comp.numerofactura}</p>
            </div>
            <Badge variant="warning" size="sm">Pendiente</Badge>
          </div>
          {#if comp.recibidofueradeciclo}
            <div class="mb-1">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">⏰ Fuera de ciclo</span>
            </div>
          {/if}

          <div class="space-y-1.5 mb-3">
            {#if comp.montodetectado}
              <div class="flex items-center gap-2 text-sm">
                <DollarSign class="w-3.5 h-3.5 text-emerald-600" />
                <span class="font-semibold text-emerald-700">{formatMoney(comp.montodetectado)}</span>
                {#if comp.saldopendiente}
                  <span class="text-xs text-slate-400">/ {formatMoney(comp.saldopendiente)} saldo</span>
                {/if}
              </div>
            {/if}
            {#if comp.bancoorigen}
              <div class="flex items-center gap-2 text-xs text-slate-600">
                <CreditCard class="w-3.5 h-3.5 text-slate-400" />
                <span>{comp.bancoorigen}{comp.bancodestino ? ` → ${comp.bancodestino}` : ''}</span>
              </div>
            {/if}
            {#if comp.referenciabancaria}
              <div class="text-xs text-slate-500">
                Ref: <span class="font-mono">{comp.referenciabancaria}</span>
              </div>
            {/if}
            <div class="text-xs text-slate-400">
              Recibido: {formatDateTime(comp.fecharecepcion)}
            </div>
          </div>

          <button
            class="w-full flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition-colors"
            on:click={() => verComprobante(comp)}
          >
            <Eye class="w-3.5 h-3.5" />
            Revisar Comprobante
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- Error state -->
{#if error}
  <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
    <div class="flex items-center gap-2 text-red-700">
      <AlertTriangle class="w-5 h-5" />
      <p class="text-sm font-medium">{error}</p>
    </div>
  </div>
{/if}

<!-- Loading state -->
{#if cargando}
  <div class="flex justify-center py-16">
    <div class="text-center">
      <Bot class="w-12 h-12 text-blue-500 mx-auto mb-3 animate-pulse" />
      <p class="text-slate-500 text-sm">Cargando reporte del Cobrador IA...</p>
    </div>
  </div>

<!-- Empty state -->
{:else if clientesFiltrados.length === 0}
  <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
    <Bot class="w-16 h-16 text-slate-300 mx-auto mb-4" />
    <h3 class="text-lg font-semibold text-slate-700 mb-2">
      {filtroTexto ? 'Sin resultados' : 'Sin clientes con Cobrador IA'}
    </h3>
    <p class="text-sm text-slate-500 max-w-md mx-auto">
      {filtroTexto
        ? 'No se encontraron clientes que coincidan con tu búsqueda.'
        : 'Para activar el cobrador IA, ve a la sección "Facturación" y activa el agente IA en las facturas que desees cobrar automáticamente.'}
    </p>
  </div>

<!-- Client list -->
{:else}
  <div class="space-y-3">
    {#each clientesFiltrados as cliente (cliente.clienteId)}

      <div class="bg-white rounded-xl shadow-sm border {clienteTieneAlerta(cliente) ? 'border-red-300 ring-1 ring-red-100' : clienteTienePendiente(cliente) ? 'border-orange-300 ring-1 ring-orange-100' : 'border-slate-200'}">
        <!-- Client header row -->
        <div class="w-full px-5 py-4 flex items-center gap-4">
          <!-- Clickable area -->
          <div
            class="flex items-center gap-4 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            on:click={() => toggleCliente(cliente.clienteId)}
            on:keydown={(e) => e.key === 'Enter' && toggleCliente(cliente.clienteId)}
            role="button"
            tabindex="0"
          >
          <!-- Status indicator -->
          <div class="flex-shrink-0">
            {#if clienteTieneAlerta(cliente)}
              <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle class="w-5 h-5 text-red-600" />
              </div>
            {:else if clienteTienePendiente(cliente)}
              <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <HandCoins class="w-5 h-5 text-orange-600" />
              </div>
            {:else if clienteContactadoHoy(cliente)}
              <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle class="w-5 h-5 text-green-600" />
              </div>
            {:else}
              <div class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                <Clock class="w-5 h-5 text-slate-400" />
              </div>
            {/if}
          </div>

          <!-- Client info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <h3 class="text-sm font-semibold text-slate-900 truncate">{cliente.clienteNombre}</h3>
              {#if clienteTieneAlerta(cliente)}
                <Badge variant="danger" size="sm">Atención Humana</Badge>
              {/if}
              {#if clienteTienePendiente(cliente)}
                <Badge variant="warning" size="sm">Pago Pendiente</Badge>
              {/if}
              {#if clienteContactadoHoy(cliente)}
                <Badge variant="success" size="sm">Contactado Hoy</Badge>
              {/if}
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span>{cliente.clienteRFC}</span>
              {#if cliente.clienteTelefono}
                <span class="flex items-center gap-1">
                  <Phone class="w-3 h-3" />
                  {cliente.clienteTelefono}
                </span>
              {/if}
              <span>{cliente.facturas.length} factura{cliente.facturas.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <!-- Summary amounts -->
          <div class="flex-shrink-0 text-right mr-2">
            <p class="text-sm font-bold text-slate-900">
              {formatMoney(clienteSaldoTotal(cliente))}
            </p>
            <p class="text-xs text-slate-500">Saldo pendiente</p>
          </div>

          <!-- Expand chevron -->
          <div class="flex-shrink-0">
            {#if clienteExpandido === cliente.clienteId}
              <ChevronUp class="w-5 h-5 text-slate-400" />
            {:else}
              <ChevronDown class="w-5 h-5 text-slate-400" />
            {/if}
          </div>
          </div>

          <!-- Auto-complement toggle (outside clickable area) -->
          <button
            class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {cliente.autoComplementoPago ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}"
            on:click={() => toggleAutoComplemento(cliente.clienteId, cliente.autoComplementoPago)}
            title={cliente.autoComplementoPago ? 'Complemento automático activado' : 'Complemento automático desactivado'}
          >
            {#if cliente.autoComplementoPago}
              <Zap class="w-3.5 h-3.5" />
              <span>Auto</span>
            {:else}
              <Shield class="w-3.5 h-3.5" />
              <span>Manual</span>
            {/if}
          </button>
        </div>

        <!-- Expanded: Invoice details -->
        {#if clienteExpandido === cliente.clienteId}
          <div class="border-t border-slate-100 px-5 pb-4">
            <div class="overflow-x-auto">
              <table class="w-full text-sm mt-3">
                <thead>
                  <tr class="text-xs text-slate-500 uppercase tracking-wider">
                    <th class="text-left py-2 px-2 font-medium">Factura</th>
                    <th class="text-right py-2 px-2 font-medium">Monto</th>
                    <th class="text-right py-2 px-2 font-medium">Saldo</th>
                    <th class="text-center py-2 px-2 font-medium">Estado</th>
                    <th class="text-center py-2 px-2 font-medium">Último Resultado</th>
                    <th class="text-center py-2 px-2 font-medium">Última Gestión</th>
                    <th class="text-center py-2 px-2 font-medium">Próximo Contacto</th>
                    <th class="text-center py-2 px-2 font-medium">Promesa Pago</th>
                    <th class="text-right py-2 px-2 font-medium">Monto Promesa</th>
                    <th class="text-center py-2 px-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {#each cliente.facturas as factura (factura.facturaId)}
                    {@const badge = getResultadoBadge(factura.ultimoResultado)}
                    <tr class="hover:bg-slate-50/50">
                      <td class="py-3 px-2">
                        <div class="font-medium text-slate-900">{factura.numeroFactura}</div>
                        <div class="text-xs text-slate-500">
                          {factura.diasVencido > 0 ? `Vencida ${factura.diasVencido}d` : factura.diasVencido === 0 ? 'Vence hoy' : `Vence en ${Math.abs(factura.diasVencido)}d`}
                        </div>
                      </td>
                      <td class="py-3 px-2 text-right font-medium text-slate-900">{formatMoney(factura.montoTotal)}</td>
                      <td class="py-3 px-2 text-right font-medium text-slate-900">{formatMoney(factura.saldoPendiente)}</td>
                      <td class="py-3 px-2 text-center">
                        {#if factura.diasVencido > 0}
                          <Badge variant="danger" size="sm">Vencida</Badge>
                        {:else}
                          <Badge variant="info" size="sm">Vigente</Badge>
                        {/if}
                      </td>
                      <td class="py-3 px-2 text-center">
                        <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                      </td>
                      <td class="py-3 px-2 text-center text-xs text-slate-600">
                        {formatDate(factura.ultimaGestion)}
                        {#if factura.mensajesHoy > 0}
                          <div class="text-green-600 font-medium">{factura.mensajesHoy} msg hoy</div>
                        {/if}
                      </td>
                      <td class="py-3 px-2 text-center text-xs text-slate-600">
                        {#if factura.proximaGestion}
                          <div>{formatDate(factura.proximaGestion)}</div>
                          <div class="text-slate-400">{formatRelativeDate(factura.proximaGestion)}</div>
                        {:else}
                          <span class="text-slate-400">—</span>
                        {/if}
                      </td>
                      <td class="py-3 px-2 text-center text-xs">
                        {#if factura.promesaPagoFecha}
                          <div class="text-yellow-700 font-medium">{formatDate(factura.promesaPagoFecha)}</div>
                          <div class="text-slate-400">{formatRelativeDate(factura.promesaPagoFecha)}</div>
                        {:else}
                          <span class="text-slate-400">—</span>
                        {/if}
                      </td>
                      <td class="py-3 px-2 text-right text-sm">
                        {#if factura.promesaPagoMonto}
                          <span class="font-medium text-yellow-700">{formatMoney(factura.promesaPagoMonto)}</span>
                        {:else}
                          <span class="text-slate-400">—</span>
                        {/if}
                      </td>
                      <td class="py-3 px-2 text-center">
                        {#if factura.pendienteConfirmacion && !factura.pagoConfirmado && !cliente.autoComplementoPago}
                          <button
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                            on:click={() => abrirConfirmarPago(cliente, factura)}
                          >
                            <CheckCircle class="w-3.5 h-3.5" />
                            Confirmar Pago
                          </button>
                        {:else if factura.pagoConfirmado}
                          <span class="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle class="w-3.5 h-3.5" />
                            Confirmado
                          </span>
                        {:else if factura.requiereAtencionHumana}
                          <div class="flex flex-col items-center gap-1">
                            <Badge variant="danger" size="sm">Requiere atención</Badge>
                            {#if factura.motivoEscalamiento}
                              <span class="text-xs text-red-600 max-w-[200px] text-center leading-tight" title={factura.motivoEscalamiento}>
                                {factura.motivoEscalamiento.length > 60 ? factura.motivoEscalamiento.substring(0, 60) + '...' : factura.motivoEscalamiento}
                              </span>
                            {:else if factura.resultadoEscalamiento}
                              <span class="text-xs text-red-500">
                                {factura.resultadoEscalamiento === 'promesa_pago' ? 'Promesa posterior a vencimiento' : 
                                 factura.resultadoEscalamiento === 'disputa' ? 'Cliente en disputa' : 
                                 factura.resultadoEscalamiento === 'solicita_hablar_humano' ? 'Solicita hablar con persona' : 
                                 factura.resultadoEscalamiento}
                              </span>
                            {/if}
                          </div>
                        {:else}
                          <span class="text-slate-400 text-xs">—</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Auto-complement explanation -->
            <div class="mt-3 p-3 bg-slate-50 rounded-lg flex items-start gap-3">
              <div class="flex-shrink-0 mt-0.5">
                {#if cliente.autoComplementoPago}
                  <Zap class="w-4 h-4 text-emerald-600" />
                {:else}
                  <Shield class="w-4 h-4 text-slate-500" />
                {/if}
              </div>
              <div class="text-xs text-slate-600">
                {#if cliente.autoComplementoPago}
                  <span class="font-medium text-emerald-700">Complemento automático activado.</span>
                  Cuando el cliente envíe un comprobante de pago (transferencia, ticket de depósito), el bot generará automáticamente el complemento de pago.
                {:else}
                  <span class="font-medium text-slate-700">Complemento manual.</span>
                  Cuando el cliente envíe un comprobante de pago, aparecerá el botón "Confirmar Pago" aquí para que valides el pago en tu cuenta bancaria antes de generar el complemento.
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<!-- Modal Confirmar Pago -->
{#if modalConfirmarPago && facturaConfirmando}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
      <!-- Header -->
      <div class="px-6 pt-6 pb-4 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle class="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-900">Confirmar Pago</h3>
            <p class="text-sm text-slate-500">
              {clienteConfirmando?.clienteNombre} — {facturaConfirmando.numeroFactura}
            </p>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-4 space-y-4">
        <div class="bg-slate-50 rounded-lg p-3 text-sm">
          <div class="flex justify-between mb-1">
            <span class="text-slate-500">Saldo pendiente:</span>
            <span class="font-medium">{formatMoney(facturaConfirmando.saldoPendiente)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Monto total factura:</span>
            <span class="font-medium">{formatMoney(facturaConfirmando.montoTotal)}</span>
          </div>
        </div>

        <div>
          <label for="monto" class="block text-sm font-medium text-slate-700 mb-1">Monto del pago</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <input
              id="monto"
              type="number"
              bind:value={montoConfirmacion}
              step="0.01"
              min="0.01"
              max={facturaConfirmando.saldoPendiente}
              class="w-full pl-8 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label for="metodo" class="block text-sm font-medium text-slate-700 mb-1">Método de pago</label>
          <select
            id="metodo"
            bind:value={metodoConfirmacion}
            class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
          >
            {#each Object.entries(metodosPago) as [code, name]}
              <option value={code}>{code} - {name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="fecha" class="block text-sm font-medium text-slate-700 mb-1">Fecha del pago</label>
          <input
            id="fecha"
            type="date"
            bind:value={fechaConfirmacion}
            class="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
        <button
          class="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          on:click={() => { modalConfirmarPago = false; facturaConfirmando = null; }}
          disabled={confirmandoPago}
        >
          Cancelar
        </button>
        <button
          class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          on:click={confirmarPago}
          disabled={confirmandoPago || montoConfirmacion <= 0}
        >
          {#if confirmandoPago}
            <RefreshCw class="w-4 h-4 animate-spin" />
            Procesando...
          {:else}
            <CheckCircle class="w-4 h-4" />
            Confirmar Pago
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal Revisar Comprobante -->
{#if modalComprobante && comprobanteSeleccionado}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 pt-6 pb-4 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <Image class="w-5 h-5 text-orange-600" />
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-bold text-slate-900">Revisar Comprobante de Pago</h3>
            <p class="text-sm text-slate-500">
              {comprobanteSeleccionado.clientenombre}
            </p>
          </div>
          <button
            class="p-1 text-slate-400 hover:text-slate-600"
            on:click={() => { modalComprobante = false; comprobanteSeleccionado = null; }}
          >
            <XCircle class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Columna izquierda: Imagen + datos IA -->
          <div>
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Comprobante Enviado</p>
            <div class="bg-slate-100 rounded-lg overflow-hidden min-h-[200px] flex items-center justify-center">
              {#if cargandoImagen}
                <div class="text-center py-8">
                  <RefreshCw class="w-6 h-6 text-slate-400 mx-auto animate-spin mb-2" />
                  <p class="text-xs text-slate-500">Cargando imagen...</p>
                </div>
              {:else if comprobanteImagen}
                <img
                  src={comprobanteImagen}
                  alt="Comprobante de pago"
                  class="w-full h-auto max-h-[350px] object-contain"
                />
              {:else}
                <div class="text-center py-8">
                  <Image class="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p class="text-xs text-slate-400">No se pudo cargar la imagen</p>
                </div>
              {/if}
            </div>
            {#if comprobanteSeleccionado.mensajetexto}
              <div class="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
                <span class="font-medium">Mensaje:</span> "{comprobanteSeleccionado.mensajetexto}"
              </div>
            {/if}

            <!-- Datos bancarios IA -->
            {#if comprobanteSeleccionado.bancoorigen || comprobanteSeleccionado.referenciabancaria}
              <div class="mt-2 bg-blue-50 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                {#if comprobanteSeleccionado.bancoorigen}
                  <p><span class="font-medium">Banco origen:</span> {comprobanteSeleccionado.bancoorigen}</p>
                {/if}
                {#if comprobanteSeleccionado.bancodestino}
                  <p><span class="font-medium">Banco destino:</span> {comprobanteSeleccionado.bancodestino}</p>
                {/if}
                {#if comprobanteSeleccionado.referenciabancaria}
                  <p><span class="font-medium">Referencia:</span> <span class="font-mono">{comprobanteSeleccionado.referenciabancaria}</span></p>
                {/if}
              </div>
            {/if}

            <!-- Método y fecha -->
            <div class="mt-3 space-y-2">
              <div>
                <label for="comp-metodo" class="block text-xs font-medium text-slate-700 mb-1">
                  Método de pago
                  {#if comprobanteSeleccionado.metodopagodetectado}
                    <span class="text-orange-600 font-normal">(IA: {comprobanteSeleccionado.metodopagodetectado})</span>
                  {/if}
                </label>
                <select
                  id="comp-metodo"
                  bind:value={comprobanteMetodoEdit}
                  class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
                >
                  {#each Object.entries(metodosPago) as [code, name]}
                    <option value={code}>{code} - {name}</option>
                  {/each}
                </select>
              </div>

              <div>
                <label for="comp-fecha" class="block text-xs font-medium text-slate-700 mb-1">
                  Fecha del pago
                  {#if comprobanteSeleccionado.fechapagodetectada}
                    <span class="text-orange-600 font-normal">(IA: {formatDate(comprobanteSeleccionado.fechapagodetectada)})</span>
                  {/if}
                </label>
                <input
                  id="comp-fecha"
                  type="date"
                  bind:value={comprobanteFechaEdit}
                  class="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
            </div>

            <!-- Rechazo -->
            <div class="mt-3 pt-3 border-t border-slate-200">
              <label for="motivo-rechazo" class="block text-xs font-medium text-slate-700 mb-1">Motivo de rechazo (si aplica)</label>
              <textarea
                id="motivo-rechazo"
                bind:value={motivoRechazoInput}
                placeholder="Ej: El monto no coincide, pago no reflejado..."
                rows="2"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Columna derecha: Monto detectado + facturas del cliente -->
          <div>
            <!-- Monto detectado por IA -->
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
              <p class="text-xs font-medium text-orange-700 uppercase tracking-wider mb-1">Monto del Comprobante</p>
              <div class="flex items-center gap-2">
                <DollarSign class="w-5 h-5 text-orange-600" />
                <div class="relative flex-1">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <input
                    id="comp-monto-total"
                    type="number"
                    bind:value={comprobanteMontoEdit}
                    step="0.01"
                    min="0.01"
                    class="w-full pl-8 pr-4 py-1.5 border border-orange-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
              {#if comprobanteSeleccionado.montodetectado}
                <p class="text-xs text-orange-600 mt-1">Detectado por IA: {formatMoney(comprobanteSeleccionado.montodetectado)}</p>
              {/if}
            </div>

            <!-- Facturas del cliente -->
            <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Facturas Pendientes del Cliente
              {#if facturasCliente.length > 1}
                <span class="text-purple-600 font-normal">({facturasCliente.length} facturas)</span>
              {/if}
            </p>

            {#if cargandoFacturas}
              <div class="text-center py-4">
                <RefreshCw class="w-5 h-5 text-slate-400 mx-auto animate-spin mb-1" />
                <p class="text-xs text-slate-500">Cargando facturas...</p>
              </div>
            {:else if facturasCliente.length === 0}
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                No se encontraron facturas pendientes para este cliente.
              </div>
            {:else}
              <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {#each facturasCliente as fac (fac.facturaid)}
                  {@const isSelected = facturasSeleccionadas[fac.facturaid]}
                  {@const saldo = parseFloat(fac.saldopendiente)}
                  {@const vencida = new Date(fac.fechavencimiento) < new Date()}
                  <div
                    class="border rounded-lg p-2.5 cursor-pointer transition-all {isSelected ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}"
                    on:click={() => toggleFactura(fac.facturaid)}
                    on:keydown={(e) => { if (e.key === 'Enter') toggleFactura(fac.facturaid); }}
                    role="button"
                    tabindex="0"
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        on:change={() => toggleFactura(fac.facturaid)}
                        on:click|stopPropagation
                        class="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                          <span class="text-sm font-medium text-slate-900">{fac.numero_factura}</span>
                          <span class="text-sm font-semibold {isSelected ? 'text-emerald-700' : 'text-slate-600'}">
                            {formatMoney(saldo)}
                          </span>
                        </div>
                        <div class="flex items-center gap-2 mt-0.5">
                          <span class="text-xs text-slate-400">Vence: {formatDate(fac.fechavencimiento)}</span>
                          {#if vencida}
                            <span class="text-xs text-red-600 font-medium">Vencida</span>
                          {/if}
                          {#if fac.facturaid === comprobanteSeleccionado.facturaid}
                            <span class="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Original</span>
                          {/if}
                        </div>
                      </div>
                    </div>

                    <!-- Monto a aplicar (visible solo si está seleccionada) -->
                    {#if isSelected}
                      <div class="mt-2 flex items-center gap-2">
                        <span class="text-xs text-slate-500">Aplicar:</span>
                        <div class="relative flex-1">
                          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                          <input
                            type="number"
                            bind:value={montosFacturas[fac.facturaid]}
                            step="0.01"
                            min="0.01"
                            max={saldo}
                            on:click|stopPropagation
                            class="w-full pl-6 pr-2 py-1 border border-emerald-300 rounded text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          />
                        </div>
                        <span class="text-xs text-slate-400">/ {formatMoney(saldo)}</span>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>

              <!-- Resumen de distribución -->
              <div class="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-slate-600">Monto comprobante:</span>
                  <span class="font-medium">{formatMoney(comprobanteMontoEdit)}</span>
                </div>
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-slate-600">Total asignado:</span>
                  <span class="font-medium text-emerald-700">{formatMoney(totalAsignado)}</span>
                </div>
                {#if montoRestante > 0.01}
                  <div class="flex justify-between text-sm pt-1 border-t border-slate-200">
                    <span class="text-amber-700 font-medium">Sin asignar:</span>
                    <span class="font-semibold text-amber-700">{formatMoney(montoRestante)}</span>
                  </div>
                  <p class="text-xs text-amber-600 mt-1">Este monto no será aplicado. El operador puede gestionarlo manualmente después.</p>
                {:else if montoRestante < -0.01}
                  <div class="flex justify-between text-sm pt-1 border-t border-slate-200">
                    <span class="text-red-700 font-medium">Excede comprobante por:</span>
                    <span class="font-semibold text-red-700">{formatMoney(Math.abs(montoRestante))}</span>
                  </div>
                  <p class="text-xs text-red-600 mt-1">El total asignado supera el monto del comprobante.</p>
                  <label class="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      bind:checked={aplicarParcial}
                      class="w-4 h-4 rounded text-orange-600 border-slate-300 focus:ring-orange-500"
                    />
                    <span class="text-xs font-medium text-orange-700">Aplicar parcial — emitir complementos solo por los montos asignados</span>
                  </label>
                {:else}
                  {#if hayPagoParcial}
                    <div class="flex justify-between text-sm pt-1 border-t border-slate-200">
                      <span class="text-purple-700 font-medium">Pago parcial</span>
                      <DollarSign class="w-4 h-4 text-purple-600" />
                    </div>
                    <p class="text-xs text-purple-600 mt-1">El comprobante no cubre el saldo total de la(s) factura(s). Se emitirá complemento por el monto asignado y el saldo restante quedará pendiente.</p>
                  {:else}
                    <div class="flex justify-between text-sm pt-1 border-t border-slate-200">
                      <span class="text-emerald-700 font-medium">Distribución completa</span>
                      <CheckCircle class="w-4 h-4 text-emerald-600" />
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-100 flex justify-between">
        <button
          class="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          on:click={rechazarComprobante}
          disabled={procesandoComprobante}
        >
          <XCircle class="w-4 h-4" />
          Rechazar
        </button>

        <div class="flex gap-3">
          <button
            class="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            on:click={() => { modalComprobante = false; comprobanteSeleccionado = null; }}
            disabled={procesandoComprobante}
          >
            Cerrar
          </button>
          <button
            class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            on:click={confirmarComprobante}
            disabled={procesandoComprobante || totalAsignado <= 0 || (montoRestante < -0.01 && !aplicarParcial)}
          >
            {#if procesandoComprobante}
              <RefreshCw class="w-4 h-4 animate-spin" />
              Procesando...
            {:else}
              <CheckCircle class="w-4 h-4" />
              Confirmar Pago{facturasCliente.filter(f => facturasSeleccionadas[f.facturaid]).length > 1 ? ` (${facturasCliente.filter(f => facturasSeleccionadas[f.facturaid]).length} facturas)` : ''}
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
