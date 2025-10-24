<script lang="ts">
  import { authFetch } from '$lib/api';
  import { Button, Badge, Input, Modal } from '$lib/components/ui';
  import { CreditCard, AlertCircle, Loader, Trash2, Plus } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let open = false;
  export let organizacionId: string;

  // Estado del formulario
  let clienteSeleccionado: any = null;
  let busquedaCliente = '';
  let clientesEncontrados: any[] = [];
  let mostrarListaClientes = false;
  let cargandoClientes = false;

  let metodoPago = '';
  let metodosDisponibles: any[] = [];
  let cargandoMetodos = false;

  let fechaPago = new Date().toISOString().split('T')[0];
  let identificador = '';

  let facturasDisponibles: any[] = [];
  let facturasSeleccionadas: any[] = [];
  let cargandoFacturas = false;
  let busquedaFactura = '';
  let facturasEncontradas: any[] = [];
  let mostrarListaFacturas = false;

  let guardando = false;
  let errorMensaje: string | null = null;

  // Reactividad
  $: totalPendiente = facturasSeleccionadas.reduce((sum, f) => sum + (f.saldoPendiente || 0), 0);

  // Métodos
  async function buscarClientes() {
    if (busquedaCliente.trim().length < 2) {
      clientesEncontrados = [];
      return;
    }

    cargandoClientes = true;
    try {
      const response = await authFetch(
        `/api/pagos/clientes-disponibles?organizacionId=${organizacionId}&search=${encodeURIComponent(busquedaCliente)}`
      );
      const data = await response.json();

      if (data.success) {
        clientesEncontrados = data.clientes;
        mostrarListaClientes = true;
      } else {
        errorMensaje = data.message;
      }
    } catch (err) {
      errorMensaje = err instanceof Error ? err.message : 'Error al buscar clientes';
    } finally {
      cargandoClientes = false;
    }
  }

  async function seleccionarCliente(cliente: any) {
    clienteSeleccionado = cliente;
    busquedaCliente = cliente.razonSocial;
    mostrarListaClientes = false;
    clientesEncontrados = [];
    facturasSeleccionadas = [];
    busquedaFactura = '';
    facturasEncontradas = [];
    await cargarFacturasDisponibles();
  }

  function buscarFacturas() {
    if (!clienteSeleccionado?.id) {
      facturasEncontradas = [];
      mostrarListaFacturas = false;
      return;
    }

    const termino = busquedaFactura.toLowerCase().trim();

    // Si el campo está vacío, mostrar todas las facturas disponibles
    if (termino.length === 0) {
      facturasEncontradas = [...facturasDisponibles];
      mostrarListaFacturas = facturasDisponibles.length > 0;
      return;
    }

    // Filtrar facturas disponibles por término de búsqueda
    facturasEncontradas = facturasDisponibles.filter(f => {
      const numeroFactura = f.numeroFactura.toLowerCase();
      return numeroFactura.includes(termino);
    });

    mostrarListaFacturas = facturasEncontradas.length > 0;
  }

  function seleccionarFactura(factura: any) {
    agregarFactura(factura);
    busquedaFactura = '';
    facturasEncontradas = [];
    mostrarListaFacturas = false;
  }

  async function cargarMetodos() {
    if (metodosDisponibles.length > 0) return;

    cargandoMetodos = true;
    try {
      const response = await authFetch(`/api/pagos/metodos?organizacionId=${organizacionId}`);
      const data = await response.json();

      if (data.success) {
        metodosDisponibles = data.metodos;
      }
    } catch (err) {
      console.error('Error al cargar métodos:', err);
    } finally {
      cargandoMetodos = false;
    }
  }

  async function cargarFacturasDisponibles() {
    if (!clienteSeleccionado?.id) return;

    cargandoFacturas = true;
    try {
      const response = await authFetch(
        `/api/pagos/facturas-disponibles?organizacionId=${organizacionId}&clienteId=${clienteSeleccionado.id}`
      );
      const data = await response.json();

      if (data.success) {
        facturasDisponibles = data.facturas;
      } else {
        facturasDisponibles = [];
      }
    } catch (err) {
      console.error('Error al cargar facturas:', err);
    } finally {
      cargandoFacturas = false;
    }
  }

  function agregarFactura(factura: any) {
    if (!facturasSeleccionadas.find(f => f.id === factura.id)) {
      facturasSeleccionadas = [...facturasSeleccionadas, factura];
      facturasDisponibles = facturasDisponibles.filter(f => f.id !== factura.id);
    }
  }

  function removerFactura(facturaId: number) {
    const factura = facturasSeleccionadas.find(f => f.id === facturaId);
    if (factura) {
      facturasSeleccionadas = facturasSeleccionadas.filter(f => f.id !== facturaId);
      facturasDisponibles = [...facturasDisponibles, factura];
      facturasDisponibles.sort((a, b) => new Date(b.fechaVencimiento).getTime() - new Date(a.fechaVencimiento).getTime());
    }
  }

  async function guardarPago() {
    errorMensaje = null;

    if (!clienteSeleccionado?.id) {
      errorMensaje = 'Selecciona un cliente';
      return;
    }

    if (!metodoPago) {
      errorMensaje = 'Selecciona un método de pago';
      return;
    }

    if (facturasSeleccionadas.length === 0) {
      errorMensaje = 'Agrega al menos una factura';
      return;
    }

    guardando = true;

    try {
      const usuarioId = sessionStorage.getItem('usuarioId') || '1';

      // Crear un pago por cada factura
      for (const factura of facturasSeleccionadas) {
        const response = await authFetch(`/api/pagos?organizacionId=${organizacionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            facturaId: factura.id,
            usuarioId: parseInt(usuarioId),
            monto: factura.saldoPendiente,
            fechaPago,
            metodo: metodoPago
          })
        });

        const data = await response.json();
        if (!data.success) {
          errorMensaje = data.message || 'Error al guardar pago';
          guardando = false;
          return;
        }
      }

      // Si llegó aquí, todos los pagos se guardaron
      dispatch('pagoGuardado');
      cerrar();
    } catch (err) {
      errorMensaje = err instanceof Error ? err.message : 'Error al guardar pago';
    } finally {
      guardando = false;
    }
  }

  function cerrar() {
    open = false;
    resetearFormulario();
  }

  function resetearFormulario() {
    clienteSeleccionado = null;
    busquedaCliente = '';
    metodoPago = '';
    fechaPago = new Date().toISOString().split('T')[0];
    identificador = '';
    facturasSeleccionadas = [];
    facturasDisponibles = [];
    errorMensaje = null;
    mostrarListaClientes = false;
  }

  function formatearMoneda(monto: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(monto);
  }

  function formatearFecha(fecha: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(fecha));
  }

  function handleCloseModal() {
    cerrar();
  }
</script>

<Modal
  bind:open
  title="Agregar pago"
  size="lg"
  on:close={handleCloseModal}
>
  <svelte:fragment slot="header-icon">
    <CreditCard class="w-6 h-6 text-blue-600" />
  </svelte:fragment>

  <!-- Contenido Principal -->
  <form on:submit|preventDefault={guardarPago} class="space-y-6">
    <!-- Mensaje de Error -->
    {#if errorMensaje}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p class="text-red-700 text-sm">{errorMensaje}</p>
      </div>
    {/if}

    <!-- Sección: Datos del pago -->
    <div>
      <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CreditCard class="w-4 h-4 text-blue-600" />
        Datos del pago
      </h4>

      <div class="space-y-4">
        <!-- Búsqueda de cliente -->
        <div class="relative">
          <label for="busqueda-cliente" class="block text-sm font-medium text-gray-700 mb-2">
            Cliente <span class="text-red-500">*</span>
          </label>
          <div class="relative">
            <input
              id="busqueda-cliente"
              type="text"
              placeholder="Escribe para buscar cliente"
              bind:value={busquedaCliente}
              on:input={buscarClientes}
              on:focus={() => busquedaCliente && buscarClientes()}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />

            {#if cargandoClientes}
              <div class="absolute right-3 top-10 animate-spin">
                <Loader class="w-4 h-4 text-blue-600" />
              </div>
            {/if}
          </div>

          <!-- Lista de clientes -->
          {#if mostrarListaClientes && clientesEncontrados.length > 0}
            <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {#each clientesEncontrados as cliente}
                <button
                  type="button"
                  on:click={() => seleccionarCliente(cliente)}
                  class="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <p class="font-medium text-gray-900">{cliente.razonSocial}</p>
                  <p class="text-sm text-gray-500">{cliente.rfc}</p>
                  {#if cliente.facturasConSaldo > 0}
                    <p class="text-xs text-blue-600 mt-1">{cliente.facturasConSaldo} factura(s) con saldo</p>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}

          <!-- Cliente seleccionado -->
          {#if clienteSeleccionado}
            <div class="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p class="font-medium text-gray-900">{clienteSeleccionado.razonSocial}</p>
              <p class="text-sm text-gray-600">{clienteSeleccionado.rfc}</p>
            </div>
          {/if}
        </div>

        <!-- Método de pago -->
        <div>
          <label for="metodo-pago" class="block text-sm font-medium text-gray-700 mb-2">
            Método de pago <span class="text-red-500">*</span>
          </label>
          <select
            id="metodo-pago"
            bind:value={metodoPago}
            on:focus={cargarMetodos}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Selecciona un método</option>
            {#each metodosDisponibles as metodo}
              <option value={metodo.codigo}>
                {metodo.codigo} - {metodo.nombre}
              </option>
            {/each}
          </select>
        </div>

        <!-- Fecha y Identificador -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="fecha-pago" class="block text-sm font-medium text-gray-700 mb-2">
              Fecha de pago
            </label>
            <input
              id="fecha-pago"
              type="date"
              bind:value={fechaPago}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <Input
            label="Identificador (opcional)"
            type="text"
            bind:value={identificador}
            placeholder="Ref. de pago, número de cheque, etc."
          />
        </div>
      </div>
    </div>

    <!-- Sección: Agregar facturas -->
    <div>
      <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CreditCard class="w-4 h-4 text-blue-600" />
        Facturas a pagar
      </h4>

      {#if cargandoFacturas}
        <div class="flex items-center justify-center p-8">
          <Loader class="w-5 h-5 animate-spin text-gray-400" />
        </div>
      {:else if clienteSeleccionado && facturasDisponibles.length > 0}
        <!-- Búsqueda de facturas -->
        <div class="relative mb-4">
          <label for="busqueda-factura" class="block text-sm font-medium text-gray-700 mb-2">
            Buscar factura
          </label>
          <div class="relative">
            <input
              id="busqueda-factura"
              type="text"
              placeholder="Escribe número de factura"
              bind:value={busquedaFactura}
              on:input={buscarFacturas}
              on:focus={buscarFacturas}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />

            {#if busquedaFactura}
              <button
                type="button"
                on:click={() => {
                  busquedaFactura = '';
                  facturasEncontradas = [];
                  mostrarListaFacturas = false;
                }}
                class="absolute right-3 top-10 text-gray-400 hover:text-gray-600 p-1 rounded"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            {/if}
          </div>

          <!-- Lista de facturas encontradas -->
          {#if mostrarListaFacturas && facturasEncontradas.length > 0}
            <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {#each facturasEncontradas as factura}
                <button
                  type="button"
                  on:click={() => seleccionarFactura(factura)}
                  class="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <p class="font-medium text-gray-900">#{factura.numeroFactura}</p>
                  <p class="text-sm text-gray-600 mt-1">
                    Saldo: {formatearMoneda(factura.saldoPendiente)}
                  </p>
                  {#if factura.diasVencido > 0}
                    <Badge variant="danger" size="sm" class="mt-2">
                      Vencida hace {factura.diasVencido} días
                    </Badge>
                  {:else if factura.diasVencido < 0}
                    <Badge variant="warning" size="sm" class="mt-2">
                      Vence en {Math.abs(factura.diasVencido)} días
                    </Badge>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {:else if clienteSeleccionado && facturasDisponibles.length === 0}
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <p class="text-sm text-gray-600">No hay facturas disponibles para este cliente</p>
        </div>
      {/if}

      <!-- Facturas seleccionadas -->
      {#if facturasSeleccionadas.length > 0}
        <div class="mt-4 space-y-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p class="text-sm font-medium text-gray-900 mb-3">Facturas seleccionadas ({facturasSeleccionadas.length})</p>
          {#each facturasSeleccionadas as factura}
            <div class="flex items-center justify-between p-2 bg-white border border-blue-100 rounded">
              <div>
                <p class="font-medium text-gray-900">#{factura.numeroFactura}</p>
                <p class="text-sm text-gray-600">{formatearMoneda(factura.saldoPendiente)}</p>
              </div>
              <button
                type="button"
                on:click={() => removerFactura(factura.id)}
                class="text-red-600 hover:text-red-900 p-1 rounded"
                aria-label="Remover factura"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Resumen -->
    {#if facturasSeleccionadas.length > 0}
      <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p class="text-sm text-gray-600 mb-2">Total a pagar</p>
        <p class="text-3xl font-bold text-blue-600">{formatearMoneda(totalPendiente)}</p>
      </div>
    {/if}
  </form>

  <!-- Footer con botones -->
  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-3">
      <Button variant="secondary" on:click={handleCloseModal}>
        Cancelar
      </Button>
      <Button
        variant="primary"
        on:click={guardarPago}
        disabled={guardando || !clienteSeleccionado || !metodoPago || facturasSeleccionadas.length === 0}
        loading={guardando}
      >
        <CreditCard class="w-4 h-4" />
        Guardar Pago
      </Button>
    </div>
  </svelte:fragment>
</Modal>
