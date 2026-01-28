<script lang="ts">
  import { authFetch } from '$lib/api';
  import { Button, Badge, Input, Modal } from '$lib/components/ui';
  import axios from 'axios';
  import { CreditCard, AlertCircle, Loader, Trash2, Plus } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  

  const dispatch = createEventDispatcher();

  const limpiarRazonSocial = (razonSocial: string, rfc: string): string => {
      const esPersonaFisica = rfc && rfc.length === 13;
    
      let resultado = razonSocial.toUpperCase(); // SOLO mayúsculas
    
      // ⚠️ NO eliminar acentos ni Ñ
    
      // Solo eliminar régimen societario si es persona moral
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
  // 🔹 NUEVAS PROPS
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
       // 🔹 Validaciones básicas
       if (!clienteSeleccionado) {
         errorMensaje = 'Debes seleccionar un cliente.';
         return;
       }
   
       if (!metodoPago) {
         errorMensaje = 'Debes seleccionar un método de pago.';
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
         guardando = false;
         return;
      }
   
       // 🔹 Validar montos de pago
       const facturasConMonto = facturasSeleccionadas.filter(f => f.montoPago && f.montoPago > 0);
       if (!facturasConMonto.length) {
         errorMensaje = 'Debes ingresar el monto a pagar de al menos una factura.';
         return;
       }

       // 🔹 Consultar parcialidades desde la BD
      const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
      const usuarioId = userData.id || '1';
       const facturasConMontoYParcialidad = await Promise.all(
         facturasConMonto.map(async (f) => {
           try {
             const resp = await authFetch(
               `/api/pagos/contador?facturaId=${f.id}&usuarioId=${usuarioId}`
             );
             const data = await resp.json();
             const parcialidad = (data.success ? data.totalPagos : 0) + 1;
             return { ...f, parcialidad };
           } catch (err) {
             console.error('Error al consultar parcialidad de factura', f.id, err);
             return { ...f, parcialidad: 1 };
           }
         })
       );
       
       console.log(clienteSeleccionado.razonSocial);
   
       // 🔹 Construir payload de Facturapi
       const facturapiPayload = {
         type: 'P',
         customer: {
           legal_name: clienteSeleccionado.razonSocial.toUpperCase(),
           email: clienteSeleccionado.email,
           tax_id: clienteSeleccionado.rfc,
           tax_system: "626",
           address: {
             zip: clienteSeleccionado.codigoPostal || '00000'
           }
         },
         complements: [
           {
             type: 'pago',
             data: [
               {
                 payment_form: metodoPago, // Ejemplo: '03' transferencia
                 date: new Date(fechaPago).toISOString(),
                 related_documents: facturasConMontoYParcialidad.map(f => ({
                   uuid: f.uuid, // UUID de la factura original
                   amount: parseFloat(f.montoPago),
                   installment: f.parcialidad || 1,
                  ...(parseFloat(f.saldoPendiente) - parseFloat(f.montoPago) > 0
                      ? { last_balance: parseFloat(f.saldoPendiente) - parseFloat(f.montoPago) }
                      : {last_balance: parseFloat(f.saldoPendiente)}), // si es 0 o menor, no se envía
                   taxes: [
                     {
                       base: parseFloat((f.montoPago / 1.16).toFixed(2)),
                       type: 'IVA',
                       rate: 0.16
                     }
                   ]
                 })              
                )
               }
             ]
           }
         ]
       };
   
       console.log('📦 Payload a enviar a Facturapi:', facturapiPayload);

       const payloadString = JSON.stringify(facturapiPayload);
       console.log('📤 JSON ENVIADO A FACTURAPI:', payloadString);
   
       guardando = true;
       errorMensaje = null;
   
       const apiKey = 'REDACTED_FACTURAPI_LIVE_KEY';

       console.log(
        'LEGAL_NAME:',
        facturapiPayload.customer.legal_name,
        [...facturapiPayload.customer.legal_name].map(
          c => `${c}(${c.charCodeAt(0)})`
        )
      );

       // 🔹 Llamada a Facturapi
       const response = await axios.post(
         'https://www.facturapi.io/v2/invoices',
         facturapiPayload,
         {
           auth: {
             username: apiKey, // Clave privada de la organización
             password: ''
           }
         }
       );

       console.log('🧾 RESPUESTA COMPLETA FACTURAPI:', response);

       // 🔹 Actualizar saldo pendiente de cada factura
       for (const f of facturasConMonto) {
         const newSaldo = parseFloat(f.saldoPendiente) - parseFloat(f.montoPago);
         await authFetch(`/api/facturas/${f.id}/actualizar-saldo`, {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ saldoPendiente: newSaldo})
         });
       
         // opcional: actualizar el objeto local para reflejarlo inmediatamente en UI
         f.saldoPendiente = newSaldo;
       }
          
     
       try {   
         // Crear un pago por cada factura
         for (const factura of facturasSeleccionadas) {

           const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
           const usuarioId = userData.id || '1';
           const response = await authFetch(`/api/pagos?organizacionId=${organizacionId}`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               facturaId: factura.id,
               usuarioId: parseInt(usuarioId),
               monto: factura.montoPago,
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
   
       // 🔹 Emitir evento y cerrar modal
       dispatch('pagoGuardado');
       cerrar();
   
     } catch (error: any) {
       console.error('❌ Error al timbrar con Facturapi:', error);
       errorMensaje = error?.response?.data?.message || 'Error al crear el CFDI de pago en Facturapi.';
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

    facturaInicial = null;
    clienteInicial = null;
    abrirConFactura = false;
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
            <div class="flex items-center justify-between p-3 bg-white border border-blue-100 rounded-lg">
              <div class="flex flex-col">
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
                      // Asegura que el monto no exceda el saldo
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
