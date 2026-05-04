<script lang="ts">
  import { authFetch } from '$lib/api';
  import { get } from 'svelte/store';
  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';
  import { page } from '$app/stores';
  import { Button, Badge, Input, Modal } from '$lib/components/ui';
  import { CreditCard, AlertCircle, Loader, Trash2, Plus, Upload, Link, CheckCircle, Copy, Image } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import { hoyLocal } from '$lib/utils/date';

  const dispatch = createEventDispatcher();

  const limpiarRazonSocial = (razonSocial: string, rfc: string): string => {
      const esPersonaFisica = rfc && rfc.length === 13;
    
      let resultado = razonSocial.toUpperCase(); // SOLO may├║sculas
    
      // ÔÜá´©Å NO eliminar acentos ni ├æ
    
      // Solo eliminar r├®gimen societario si es persona moral
      if (!esPersonaFisica) {
        resultado = resultado
          .replace(/\s+S\.?\s?A\.?\s+(DE\s+)?C\.?\s?V\.?$/i, '')
          .replace(/\s+S\.?\s?DE\s+R\.?\s?L\.?(\s+DE\s+C\.?\s?V\.?)?$/i, '')
          .replace(/\s+S\.?\s?C\.?$/i, '')
          .replace(/\s+A\.?\s?C\.?$/i, '');
      }
    
      return resultado.trim();
  };

  // Props
  export let open = false;
  export let organizacionId: string;
  // ­ƒö╣ NUEVAS PROPS
  export let facturaInicial: any = null;
  export let clienteInicial: any = null;
  export let abrirConFactura = false;


  // Estado del formulario
  let clienteSeleccionado: any = null;
  let busquedaCliente = '';
  let clientesEncontrados: any[] = [];
  let mostrarListaClientes = false;
  let cargandoClientes = false;

  let metodoPago = '';
  let metodosDisponibles: any[] = [];
  let cargandoMetodos = false;

  let fechaPago = hoyLocal();
  let identificador = '';

  let facturasDisponibles: any[] = [];
  let facturasSeleccionadas: any[] = [];
  let cargandoFacturas = false;
  let busquedaFactura = '';
  let facturasEncontradas: any[] = [];
  let mostrarListaFacturas = false;

  let guardando = false;
  let errorMensaje: string | null = null;

  // Estado de comprobante por factura: 'ninguno' | 'subir' | 'link'
  let modoComprobante: Record<number, string> = {};
  let archivosComprobante: Record<number, { base64: string; mimetype: string; nombre: string } | null> = {};

  // Estado post-guardado (├®xito)
  let mostrarExito = false;
  let pagosGuardados: { pagoId: number; facturaId: number; monto: number }[] = [];
  let linksGenerados: Record<number, string> = {};
  let procesandoComprobantes = false;

  // Reactividad
  $: totalPendiente = facturasSeleccionadas.reduce(
    (sum, f) => sum + (parseFloat(f.montoPago) || 0),
    0
  );

  $: if (open && abrirConFactura && facturaInicial && clienteInicial) {
  // Cliente
  clienteSeleccionado = clienteInicial;
  busquedaCliente = clienteInicial.razonSocial;

  // Factura
  facturasSeleccionadas = [
    {
      ...facturaInicial,
      montoPago: facturaInicial.saldoPendiente
    }
  ];

  // Evita que vuelva a cargarlas
  facturasDisponibles = [];
}


  // M├®todos
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
    console.log(clienteSeleccionado);
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

    // Si el campo est├í vac├¡o, mostrar todas las facturas disponibles
    if (termino.length === 0) {
      facturasEncontradas = [...facturasDisponibles];
      mostrarListaFacturas = facturasDisponibles.length > 0;
      return;
    }

    // Filtrar facturas disponibles por t├®rmino de b├║squeda
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
      console.error('Error al cargar m├®todos:', err);
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
      facturasSeleccionadas = [
        ...facturasSeleccionadas,
        { ...factura, montoPago: factura.saldoPendiente } // nuevo campo editable
      ];
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
     try {
       // Validaciones b├ísicas
       if (!clienteSeleccionado) {
         errorMensaje = 'Debes seleccionar un cliente.';
         return;
       }
   
       if (!metodoPago) {
         errorMensaje = 'Debes seleccionar un m├®todo de pago.';
         return;
       }
   
       if (!fechaPago) {
         errorMensaje = 'Debes seleccionar una fecha de pago.';
         return;
       }
   
       if (!facturasSeleccionadas.length) {
         errorMensaje = 'Debes seleccionar al menos una factura.';
         return;
       }

      if (facturasSeleccionadas.some(f => f.montoPago <= 0)) {
         errorMensaje = 'Todos los montos deben ser mayores a cero';
         return;
      }
   
       const facturasConMonto = facturasSeleccionadas.filter(f => f.montoPago && f.montoPago > 0);
       if (!facturasConMonto.length) {
         errorMensaje = 'Debes ingresar el monto a pagar de al menos una factura.';
         return;
       }

       guardando = true;
       errorMensaje = null;

       // Llamar al endpoint seguro del servidor para timbrar
       const response = await authFetch(`/api/pagos/timbrar?organizacionId=${organizacionId}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           clienteId: clienteSeleccionado.id,
           facturas: facturasConMonto.map(f => ({
             facturaId: f.id,
             montoPago: parseFloat(f.montoPago)
           })),
           fechaPago,
           metodoPago
         })
       });

       const data = await response.json();

       if (!data.success) {
         errorMensaje = data.error || data.details || 'Error al timbrar el complemento de pago';
         guardando = false;
         return;
       }

       // Timbrado exitoso - procesar comprobantes
       pagosGuardados = data.pagos || [];
       
       await procesarComprobantes();

       mostrarExito = true;
       guardando = false;
       dispatch('pagoGuardado');

     } catch (err) {
       errorMensaje = err instanceof Error ? err.message : 'Error al guardar pago';
       guardando = false;
     }
  }

  async function procesarComprobantes() {
    procesandoComprobantes = true;
    linksGenerados = {};

    for (const pago of pagosGuardados) {
      const modo = modoComprobante[pago.facturaId] || 'ninguno';

      if (modo === 'subir') {
        const archivo = archivosComprobante[pago.facturaId];
        if (archivo) {
          try {
            await authFetch(`/api/pagos/${pago.pagoId}/comprobante?organizacionId=${organizacionId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imagenBase64: archivo.base64,
                mimetype: archivo.mimetype
              })
            });
          } catch (err) {
            console.error(`Error subiendo comprobante para pago ${pago.pagoId}:`, err);
          }
        }
      } else if (modo === 'link') {
        try {
          const resp = await authFetch(`/api/pagos/${pago.pagoId}/generar-link?organizacionId=${organizacionId}`, {
            method: 'POST'
          });
          const linkData = await resp.json();
          if (linkData.success && linkData.link) {
            linksGenerados[pago.pagoId] = linkData.link;
          }
        } catch (err) {
          console.error(`Error generando link para pago ${pago.pagoId}:`, err);
        }
      }
    }

    linksGenerados = { ...linksGenerados };
    procesandoComprobantes = false;
  }

  function seleccionarArchivoComprobante(facturaId: number) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        errorMensaje = 'La imagen no debe superar los 5 MB';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        archivosComprobante[facturaId] = {
          base64: reader.result as string,
          mimetype: file.type,
          nombre: file.name
        };
        archivosComprobante = { ...archivosComprobante };
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function copiarLink(link: string) {
    await navigator.clipboard.writeText(link);
  }
   
  function cerrar() {
    if (mostrarExito) {
      mostrarExito = false;
    }
    open = false;
    resetearFormulario();
    dispatch('cerrar');
  }

  function resetearFormulario() {
    clienteSeleccionado = null;
    busquedaCliente = '';
    metodoPago = '';
    fechaPago = hoyLocal();
    identificador = '';
    facturasSeleccionadas = [];
    facturasDisponibles = [];
    errorMensaje = null;
    mostrarListaClientes = false;

    facturaInicial = null;
    clienteInicial = null;
    abrirConFactura = false;

    modoComprobante = {};
    archivosComprobante = {};
    mostrarExito = false;
    pagosGuardados = [];
    linksGenerados = {};
    procesandoComprobantes = false;
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
  {#if !mostrarExito}
  <form on:submit|preventDefault={guardarPago} class="space-y-6">
    <!-- Mensaje de Error -->
    {#if errorMensaje}
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p class="text-red-700 text-sm">{errorMensaje}</p>
      </div>
    {/if}

    <!-- Secci├│n: Datos del pago -->
    <div>
      <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CreditCard class="w-4 h-4 text-blue-600" />
        Datos del pago
      </h4>

      <div class="space-y-4">
        <!-- B├║squeda de cliente -->
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
              disabled={!!clienteInicial}
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

        <!-- M├®todo de pago -->
        <div>
          <label for="metodo-pago" class="block text-sm font-medium text-gray-700 mb-2">
            M├®todo de pago <span class="text-red-500">*</span>
          </label>
          <select
            id="metodo-pago"
            bind:value={metodoPago}
            on:focus={cargarMetodos}
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Selecciona un m├®todo</option>
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
              max={new Date().toISOString().split('T')[0]}
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <Input
            label="Identificador (opcional)"
            type="text"
            bind:value={identificador}
            placeholder="Ref. de pago, n├║mero de cheque, etc."
          />
        </div>
      </div>
    </div>

    <!-- Secci├│n: Agregar facturas -->
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
        <!-- B├║squeda de facturas -->
        <div class="relative mb-4">
          <label for="busqueda-factura" class="block text-sm font-medium text-gray-700 mb-2">
            Buscar factura
          </label>
          <div class="relative">
            <input
              id="busqueda-factura"
              type="text"
              placeholder="Escribe n├║mero de factura"
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
                aria-label="Limpiar b├║squeda"
              >
                Ô£ò
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
                      Vencida hace {factura.diasVencido} d├¡as
                    </Badge>
                  {:else if factura.diasVencido < 0}
                    <Badge variant="warning" size="sm" class="mt-2">
                      Vence en {Math.abs(factura.diasVencido)} d├¡as
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
            <div class="p-3 bg-white border border-blue-100 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex flex-col flex-1">
                  <p class="font-medium text-gray-900">#{factura.numeroFactura}</p>
                  <p class="text-xs text-gray-500">Saldo pendiente: {formatearMoneda(factura.saldoPendiente)}</p>
                  <div class="mt-2 flex items-center gap-2">
                    <label for={"monto-" + factura.id} class="text-sm text-gray-700">Monto a pagar:</label>
                    <input
                      id={"monto-" + factura.id}
                      type="number"
                      min="0"
                      max={factura.saldoPendiente}
                      step="0.01"
                      bind:value={factura.montoPago}
                      on:input={() => {
                        if (factura.montoPago > factura.saldoPendiente) factura.montoPago = factura.saldoPendiente;
                        facturasSeleccionadas = [...facturasSeleccionadas];
                      }}
                      class="w-32 px-2 py-1 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
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

              <!-- Comprobante de pago -->
              <div class="mt-3 pt-3 border-t border-blue-100">
                <p class="text-xs font-medium text-gray-600 mb-2">Comprobante de pago</p>
                <div class="flex gap-2">
                  <button
                    type="button"
                    on:click={() => { modoComprobante[factura.id] = 'ninguno'; modoComprobante = {...modoComprobante}; }}
                    class="px-2 py-1 text-xs rounded-md border transition-colors {(!modoComprobante[factura.id] || modoComprobante[factura.id] === 'ninguno') ? 'bg-gray-200 border-gray-400 text-gray-800' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}"
                  >
                    Ninguno
                  </button>
                  <button
                    type="button"
                    on:click={() => { modoComprobante[factura.id] = 'subir'; modoComprobante = {...modoComprobante}; }}
                    class="px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 {modoComprobante[factura.id] === 'subir' ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}"
                  >
                    <Upload class="w-3 h-3" />
                    Subir
                  </button>
                  <button
                    type="button"
                    on:click={() => { modoComprobante[factura.id] = 'link'; modoComprobante = {...modoComprobante}; }}
                    class="px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 {modoComprobante[factura.id] === 'link' ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}"
                  >
                    <Link class="w-3 h-3" />
                    Enviar link
                  </button>
                </div>

                {#if modoComprobante[factura.id] === 'subir'}
                  <div class="mt-2">
                    {#if archivosComprobante[factura.id]}
                      <div class="bg-green-50 border border-green-200 rounded-lg p-2 space-y-2">
                        <div class="flex items-center gap-2">
                          <Image class="w-4 h-4 text-green-600" />
                          <span class="text-xs text-green-700 flex-1 truncate">{archivosComprobante[factura.id]?.nombre}</span>
                          <button
                            type="button"
                            on:click={() => { archivosComprobante[factura.id] = null; archivosComprobante = {...archivosComprobante}; }}
                            class="text-red-500 hover:text-red-700 text-xs"
                          >
                            Ô£ò
                          </button>
                        </div>
                        {#if archivosComprobante[factura.id]?.base64}
                          <img
                            src={archivosComprobante[factura.id]?.base64}
                            alt="Vista previa del comprobante"
                            class="max-h-32 mx-auto rounded object-contain"
                          />
                        {/if}
                      </div>
                    {:else}
                      <button
                        type="button"
                        on:click={() => seleccionarArchivoComprobante(factura.id)}
                        class="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-1"
                      >
                        <Upload class="w-3 h-3" />
                        Seleccionar imagen (JPEG, PNG, WebP ÔÇö m├íx 5MB)
                      </button>
                    {/if}
                  </div>
                {/if}

                {#if modoComprobante[factura.id] === 'link'}
                  <div class="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-2">
                    <p class="text-xs text-purple-700">Se generar├í un link para que el cliente suba su comprobante despu├®s de guardar el pago.</p>
                  </div>
                {/if}
              </div>
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
  {/if}

  <!-- Vista de ├®xito -->
  {#if mostrarExito}
    <div class="space-y-6">
      <div class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <CheckCircle class="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 class="text-lg font-semibold text-green-800">Pago registrado exitosamente</h3>
        <p class="text-sm text-green-600 mt-1">
          Se timbr├│ el complemento de pago y se registraron {pagosGuardados.length} pago(s).
        </p>
      </div>

      {#if procesandoComprobantes}
        <div class="flex items-center justify-center gap-2 py-4">
          <Loader class="w-5 h-5 animate-spin text-blue-600" />
          <span class="text-sm text-gray-600">Procesando comprobantes...</span>
        </div>
      {/if}

      {#if Object.keys(linksGenerados).length > 0}
        <div>
          <h4 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Link class="w-4 h-4 text-purple-600" />
            Links para comprobantes
          </h4>
          <div class="space-y-2">
            {#each Object.entries(linksGenerados) as [pagoId, link]}
              <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-3">
                <div class="flex-1 min-w-0">
                  <p class="text-xs text-purple-600 mb-1">Pago #{pagoId}</p>
                  <p class="text-sm text-purple-800 font-mono truncate">{link}</p>
                </div>
                <button
                  type="button"
                  on:click={() => copiarLink(link)}
                  class="flex-shrink-0 p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg transition-colors"
                  title="Copiar link"
                >
                  <Copy class="w-4 h-4" />
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Footer con botones -->
  <svelte:fragment slot="footer">
    {#if mostrarExito}
      <div class="flex justify-end">
        <Button variant="primary" on:click={cerrar}>
          Cerrar
        </Button>
      </div>
    {:else}
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
    {/if}
  </svelte:fragment>
</Modal>
