<script lang="ts">
  import { authFetch } from '$lib/api';
  import { Modal, Badge, Button } from '$lib/components/ui';
  import { CreditCard, FileText, User, Calendar, AlertCircle, Loader, XCircle, CheckCircle, Copy, Image, Link, Clock } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let open = false;
  export let pagoId: number | null = null;
  export let organizacionId: string;

  let pago: any = null;
  let cargando = false;
  let error: string | null = null;

  // Comprobante
  let comprobanteBase64: string | null = null;
  let cargandoComprobante = false;
  let comprobanteExpandido = false;

  $: if (open && pagoId) {
    cargarDetalle();
  }

  async function cargarDetalle() {
    if (!pagoId || !organizacionId) return;

    cargando = true;
    error = null;
    pago = null;

    try {
      const response = await authFetch(
        `/api/pagos/${pagoId}?organizacionId=${organizacionId}`
      );
      const data = await response.json();

      if (data.success) {
        pago = data.pago;
        // Si tiene comprobante, cargarlo
        if (pago.tieneComprobante) {
          cargarComprobante();
        }
      } else {
        error = data.message || 'Error al cargar el detalle del pago';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al cargar detalle';
    } finally {
      cargando = false;
    }
  }

  async function cargarComprobante() {
    cargandoComprobante = true;
    try {
      const response = await authFetch(
        `/api/pagos/${pagoId}/comprobante?organizacionId=${organizacionId}`
      );
      const data = await response.json();
      if (data.success) {
        comprobanteBase64 = data.imageBase64;
      }
    } catch (err) {
      console.error('Error cargando comprobante:', err);
    } finally {
      cargandoComprobante = false;
    }
  }

  function formatearMoneda(monto: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(monto || 0);
  }

  function formatearFecha(fecha: string): string {
    if (!fecha) return 'N/A';
    const fechaSolo = fecha.split('T')[0].split(' ')[0];
    const [year, month, day] = fechaSolo.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }

  function formatearFechaHora(fecha: string): string {
    if (!fecha) return 'N/A';
    const date = new Date(fecha);
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function getMetodoNombre(codigo: string): string {
    const metodos: Record<string, string> = {
      '01': 'Efectivo',
      '02': 'Cheque nominativo',
      '03': 'Transferencia electrónica',
      '04': 'Tarjeta de crédito',
      '05': 'Monedero electrónico',
      '06': 'Dinero electrónico',
      '08': 'Servicios de pago electrónico',
      '09': 'Tarjeta de débito',
      '28': 'Pago por subrogación',
      '29': 'Otros',
    };
    return metodos[codigo] || codigo;
  }

  function getMotivoNombre(motivo: string): string {
    const motivos: Record<string, string> = {
      '01': 'Comprobante emitido con errores con relación',
      '02': 'Comprobante emitido con errores sin relación',
      '03': 'No se llevó a cabo la operación',
      '04': 'Operación nominativa relacionada en la factura global'
    };
    return motivos[motivo] || motivo;
  }

  async function copiarUUID() {
    if (pago?.uuidPago) {
      await navigator.clipboard.writeText(pago.uuidPago);
    }
  }

  function cerrar() {
    open = false;
    pago = null;
    error = null;
    comprobanteBase64 = null;
    comprobanteExpandido = false;
  }

  function handleCancelar() {
    dispatch('cancelar', { pagoId: pago?.id });
    cerrar();
  }
</script>

<Modal
  bind:open
  title={pago ? `Pago #${pago.id}` : 'Detalle del Pago'}
  size="lg"
  on:close={cerrar}
>
  <svelte:fragment slot="header-icon">
    <CreditCard class="w-6 h-6 text-blue-600" />
  </svelte:fragment>

  {#if cargando}
    <div class="flex items-center justify-center py-16">
      <Loader class="w-8 h-8 animate-spin text-blue-600" />
      <span class="ml-3 text-gray-600">Cargando detalle...</span>
    </div>
  {:else if error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <AlertCircle class="w-10 h-10 text-red-500 mx-auto mb-3" />
      <p class="text-red-700 font-medium">{error}</p>
    </div>
  {:else if pago}
    <div class="space-y-6">
      <!-- Estado del pago -->
      {#if pago.cancelado}
        <div class="bg-red-50 border border-red-300 rounded-lg p-4 flex items-center gap-3">
          <XCircle class="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <p class="font-semibold text-red-800">Pago Cancelado</p>
            {#if pago.fechaCancelacion}
              <p class="text-sm text-red-600">Cancelado el {formatearFechaHora(pago.fechaCancelacion)}</p>
            {/if}
            {#if pago.motivoCancelacion}
              <p class="text-sm text-red-600 mt-1">Motivo: {getMotivoNombre(pago.motivoCancelacion)}</p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle class="w-5 h-5 text-green-600 flex-shrink-0" />
          <p class="font-medium text-green-800">Pago Activo</p>
        </div>
      {/if}

      <!-- Información del pago -->
      <div>
        <h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CreditCard class="w-4 h-4 text-blue-600" />
          Información del Pago
        </h4>
        <div class="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider">Monto</p>
            <p class="text-xl font-bold {pago.cancelado ? 'text-gray-400 line-through' : 'text-blue-600'}">
              {formatearMoneda(pago.monto)}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider">Fecha de Pago</p>
            <p class="text-sm font-medium text-gray-900">{formatearFecha(pago.fechaPago)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider">Método</p>
            <p class="text-sm font-medium text-gray-900">{pago.metodo} — {getMetodoNombre(pago.metodo)}</p>
          </div>
          {#if pago.uuidPago}
            <div>
              <p class="text-xs text-gray-500 uppercase tracking-wider">UUID Complemento</p>
              <div class="flex items-center gap-1.5">
                <p class="text-xs font-mono text-gray-700 truncate">{pago.uuidPago}</p>
                <button
                  on:click={copiarUUID}
                  class="text-gray-400 hover:text-blue-600 flex-shrink-0"
                  title="Copiar UUID"
                >
                  <Copy class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Factura Asociada -->
      {#if pago.factura}
        <div>
          <h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText class="w-4 h-4 text-blue-600" />
            Factura Asociada
          </h4>
          <div class="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 uppercase tracking-wider">Número de Factura</p>
              <p class="text-sm font-medium text-gray-900">{pago.factura.numero_factura || 'N/A'}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 uppercase tracking-wider">Monto Total</p>
              <p class="text-sm font-medium text-gray-900">{formatearMoneda(pago.factura.montoTotal)}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 uppercase tracking-wider">Saldo Pendiente</p>
              <p class="text-sm font-medium {pago.factura.saldoPendiente > 0 ? 'text-amber-600' : 'text-green-600'}">
                {formatearMoneda(pago.factura.saldoPendiente)}
              </p>
            </div>
            {#if pago.factura.fechaEmision}
              <div>
                <p class="text-xs text-gray-500 uppercase tracking-wider">Fecha Emisión</p>
                <p class="text-sm font-medium text-gray-900">{formatearFecha(pago.factura.fechaEmision)}</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Cliente -->
      {#if pago.factura?.cliente}
        <div>
          <h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <User class="w-4 h-4 text-blue-600" />
            Cliente
          </h4>
          <div class="bg-gray-50 rounded-lg p-4">
            <p class="font-medium text-gray-900">{pago.factura.cliente.razonSocial || 'N/A'}</p>
            {#if pago.factura.cliente.rfc}
              <p class="text-sm text-gray-600 mt-1">RFC: {pago.factura.cliente.rfc}</p>
            {/if}
            {#if pago.factura.cliente.correo}
              <p class="text-sm text-gray-600">Correo: {pago.factura.cliente.correo}</p>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Comprobante de Pago -->
      {#if pago.tieneComprobante}
        <div>
          <h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Image class="w-4 h-4 text-blue-600" />
            Comprobante de Pago
          </h4>
          {#if cargandoComprobante}
            <div class="flex items-center justify-center py-6 bg-gray-50 rounded-lg">
              <Loader class="w-5 h-5 animate-spin text-gray-400" />
              <span class="ml-2 text-sm text-gray-500">Cargando comprobante...</span>
            </div>
          {:else if comprobanteBase64}
            <div class="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                on:click={() => comprobanteExpandido = !comprobanteExpandido}
                class="w-full cursor-pointer"
              >
                <img
                  src={comprobanteBase64}
                  alt="Comprobante de pago"
                  class="mx-auto object-contain transition-all duration-200 {comprobanteExpandido ? 'max-h-[500px]' : 'max-h-48'}"
                />
              </button>
              <div class="px-3 py-2 bg-gray-100 text-xs text-gray-500 text-center">
                Haz clic en la imagen para {comprobanteExpandido ? 'reducir' : 'ampliar'}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Link pendiente de comprobante -->
      {#if pago.tieneTokenPendiente && !pago.tieneComprobante}
        <div>
          <h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Link class="w-4 h-4 text-purple-600" />
            Comprobante de Pago
          </h4>
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
            <Clock class="w-5 h-5 text-purple-500 flex-shrink-0" />
            <div>
              <p class="text-sm font-medium text-purple-800">Esperando comprobante del cliente</p>
              <p class="text-xs text-purple-600 mt-0.5">Se envió un link al cliente para subir su comprobante de pago.</p>
            </div>
          </div>
        </div>
      {/if}

      <!-- Metadatos -->
      <div class="border-t border-gray-200 pt-4">
        <div class="grid grid-cols-2 gap-4 text-xs text-gray-500">
          {#if pago.usuario}
            <div>
              <p class="uppercase tracking-wider">Registrado por</p>
              <p class="text-gray-700 mt-0.5">
                {[pago.usuario.nombre, pago.usuario.apellido].filter(Boolean).join(' ') || pago.usuario.correo || 'N/A'}
              </p>
            </div>
          {/if}
          {#if pago.createdAt}
            <div>
              <p class="uppercase tracking-wider">Fecha de registro</p>
              <p class="text-gray-700 mt-0.5">{formatearFechaHora(pago.createdAt)}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <div class="flex justify-between w-full">
      {#if pago && !pago.cancelado}
        <Button variant="danger" on:click={handleCancelar}>
          <XCircle class="w-4 h-4" />
          Cancelar Pago
        </Button>
      {:else}
        <div></div>
      {/if}
      <Button variant="secondary" on:click={cerrar}>
        Cerrar
      </Button>
    </div>
  </svelte:fragment>
</Modal>
