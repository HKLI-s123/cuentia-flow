<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Mail, RefreshCw, Plus, CheckCircle, AlertCircle } from 'lucide-svelte';
  import type { Factura } from './types';
  import { authFetch } from '$lib/api';

  export let abierto = false;
  export let factura: Factura | null = null;
  export let abrirFormulario = false;

  const dispatch = createEventDispatcher();

  // Estado para mensajes de éxito/error
  let enviando = false;
  let mensajeExito = '';
  let mensajeError = '';
  let cargandoDatos = false;

  // Lista de recordatorios desde la API
  let recordatorios: any[] = [];
  let cargandoRecordatorios = false;

  // Estado del formulario de nuevo recordatorio
  let mostrarFormulario = false;

  // Reactive: si abrirFormulario es true, abrir el formulario automáticamente
  $: if (abierto && abrirFormulario) {
    mostrarFormulario = true;
    // Cargar datos cuando se abre el formulario automáticamente
    if (factura) {
      cargarDatosCliente();
    }
  }

  // Cargar recordatorios cuando se abre el modal
  $: if (abierto && factura) {
    cargarRecordatorios();
  }

  let tipoMensaje: 'SMS' | 'CORREO' | 'URL' = 'CORREO';
  let nuevoRecordatorio = {
    tipoMensaje: 'Recordatorio de pago',
    destinatarios: [] as string[],
    cc: [] as string[],
    asunto: '',
    mensaje: '',
    etiquetas: [] as string[]
  };

  // Estados para inputs temporales
  let inputDestinatario = '';
  let inputCC = '';
  let mostrarCampoCC = false;

  // Funciones para manejar destinatarios
  function agregarDestinatario(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const email = inputDestinatario.trim().replace(/,$/g, '');

      if (email && validarEmail(email)) {
        if (!nuevoRecordatorio.destinatarios.includes(email)) {
          nuevoRecordatorio.destinatarios = [...nuevoRecordatorio.destinatarios, email];
        }
        inputDestinatario = '';
      } else if (email) {
        mensajeError = 'El correo electrónico no tiene un formato válido';
        setTimeout(() => { mensajeError = ''; }, 3000);
      }
    }
  }

  function removerDestinatario(email: string) {
    nuevoRecordatorio.destinatarios = nuevoRecordatorio.destinatarios.filter(e => e !== email);
  }

  function agregarCC(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const email = inputCC.trim().replace(/,$/g, '');

      if (email && validarEmail(email)) {
        if (!nuevoRecordatorio.cc.includes(email)) {
          nuevoRecordatorio.cc = [...nuevoRecordatorio.cc, email];
        }
        inputCC = '';
      } else if (email) {
        mensajeError = 'El correo electrónico no tiene un formato válido';
        setTimeout(() => { mensajeError = ''; }, 3000);
      }
    }
  }

  function removerCC(email: string) {
    nuevoRecordatorio.cc = nuevoRecordatorio.cc.filter(e => e !== email);
  }

  function validarEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Función para obtener el nombre del cliente
  function getNombreCliente(): string {
    if (!factura?.cliente) return 'Estimado cliente';
    return factura.cliente.razonSocial || 'Estimado cliente';
  }

  // Función para formatear moneda
  function formatearMoneda(monto: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(monto);
  }

  // Función para formatear fecha
  function formatearFecha(fecha: string | Date): string {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async function cargarRecordatorios() {
    if (!factura) return;

    cargandoRecordatorios = true;

    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');
      if (!organizacionId) return;

      const response = await authFetch(`/api/facturas/${factura.id}/recordatorios?organizacionId=${organizacionId}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          recordatorios = data.recordatorios;
        }
      }
    } catch (error) {
      console.error('Error al cargar recordatorios:', error);
    } finally {
      cargandoRecordatorios = false;
    }
  }

  async function cargarDatosCliente() {
    if (!factura) {
      console.log('❌ No hay factura seleccionada');
      return;
    }

    console.log('📊 Cargando datos del cliente:', factura.clienteId);
    cargandoDatos = true;

    try {
      // Obtener organizacionId del sessionStorage
      const organizacionId = sessionStorage.getItem('organizacionActualId');

      if (!organizacionId) {
        console.log('❌ No hay organizacionId en sessionStorage');
        return;
      }

      console.log('🔍 Obteniendo cliente ID:', factura.clienteId, 'Org:', organizacionId);

      // Obtener datos completos del cliente
      const response = await authFetch(`/api/clientes/${factura.clienteId}?organizacionId=${organizacionId}`);

      if (!response.ok) {
        throw new Error('Error al obtener datos del cliente');
      }

      const cliente = await response.json();
      console.log('✅ Cliente obtenido:', cliente);

      // Verificar si hay error en la respuesta
      if (cliente.error) {
        throw new Error(cliente.error);
      }

      // Pre-llenar el destinatario con el correo del cliente
      if (cliente.CorreoPrincipal) {
        nuevoRecordatorio.destinatarios = [cliente.CorreoPrincipal];
      }

      // Pre-llenar asunto y mensaje con datos reales
      const nombreCliente = cliente.NombreComercial || cliente.RazonSocial || 'Estimado cliente';
      const numeroFactura = factura.numero_factura || 'N/A';
      const montoTotal = formatearMoneda(factura.montoTotal || 0);
      const fechaVencimiento = factura.fechaVencimiento ? formatearFecha(factura.fechaVencimiento) : 'próximamente';

      nuevoRecordatorio.asunto = `${nombreCliente}, recordatorio de pago - Factura ${numeroFactura}`;
      nuevoRecordatorio.mensaje = `¡Hola ${nombreCliente}!\n\nNos comunicamos contigo para recordarte que la fecha límite de pago de tu factura ${numeroFactura}, con un total de ${montoTotal}, vence el ${fechaVencimiento}.\n\nTe pedimos por favor realizar el pago a la brevedad posible.\n\nSi ya realizaste el pago, por favor ignora este mensaje.\n\n¡Gracias por tu preferencia!`;

      console.log('✅ Formulario pre-llenado:', {
        destinatario: nuevoRecordatorio.destinatario,
        asunto: nuevoRecordatorio.asunto
      });
    } catch (error) {
      console.error('❌ Error al cargar datos del cliente:', error);
      mensajeError = 'Error al cargar los datos del cliente';
    } finally {
      cargandoDatos = false;
    }
  }

  function cerrar() {
    abierto = false;
    mostrarFormulario = false;
    abrirFormulario = false;
    mensajeExito = '';
    mensajeError = '';
    // Limpiar formulario
    nuevoRecordatorio = {
      tipoMensaje: 'Recordatorio de pago',
      destinatarios: [],
      cc: [],
      asunto: '',
      mensaje: '',
      etiquetas: []
    };
    inputDestinatario = '';
    inputCC = '';
    mostrarCampoCC = false;
    dispatch('cerrar');
  }

  function toggleFormulario() {
    mostrarFormulario = !mostrarFormulario;
    // Si se está abriendo el formulario, cargar datos del cliente
    if (mostrarFormulario && factura) {
      cargarDatosCliente();
    }
  }

  function actualizarRecordatorios() {
    cargarRecordatorios();
  }

  async function guardarRecordatorio() {
    if (!factura) {
      mensajeError = 'No se ha seleccionado ninguna factura';
      return;
    }

    // Validar que sea tipo CORREO (por ahora solo soportamos correo)
    if (tipoMensaje !== 'CORREO') {
      mensajeError = 'Por ahora solo se soporta envío por correo electrónico';
      return;
    }

    // Limpiar mensajes previos
    mensajeError = '';
    mensajeExito = '';
    enviando = true;

    try {
      // Obtener organizacionId del sessionStorage
      const organizacionId = sessionStorage.getItem('organizacionActualId');

      if (!organizacionId) {
        mensajeError = 'No se pudo obtener la información de la organización';
        enviando = false;
        return;
      }

      // Validar campos del formulario
      if (nuevoRecordatorio.destinatarios.length === 0) {
        mensajeError = 'Debes agregar al menos un destinatario';
        enviando = false;
        return;
      }

      if (!nuevoRecordatorio.asunto.trim()) {
        mensajeError = 'El asunto es requerido';
        enviando = false;
        return;
      }

      if (!nuevoRecordatorio.mensaje.trim()) {
        mensajeError = 'El mensaje es requerido';
        enviando = false;
        return;
      }

      // Llamar al endpoint de envío de correo con los datos del formulario
      const response = await authFetch(`/api/facturas/${factura.id}/enviar-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizacionId: parseInt(organizacionId),
          destinatario: nuevoRecordatorio.destinatarios.join(', '),
          cc: nuevoRecordatorio.cc.join(', '),
          asunto: nuevoRecordatorio.asunto.trim(),
          mensaje: nuevoRecordatorio.mensaje.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Error del servidor (400, 500, etc.)
        mensajeError = data.error || data.details || 'Error al enviar el correo';
        console.error('Error del servidor:', data);
        enviando = false;
        return;
      }

      if (data.success) {
        mensajeExito = `Correo enviado exitosamente a ${data.destinatario}`;

        // Recargar la lista de recordatorios
        await cargarRecordatorios();

        // Limpiar formulario después de 2 segundos
        setTimeout(() => {
          mostrarFormulario = false;
          mensajeExito = '';
        }, 2000);

        dispatch('recordatorioCreado');
      } else {
        mensajeError = data.error || 'Error al enviar el correo';
      }
    } catch (error) {
      console.error('Error al enviar recordatorio:', error);
      mensajeError = error instanceof Error ? error.message : 'Error al conectar con el servidor';
    } finally {
      enviando = false;
    }
  }
</script>

{#if abierto}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center gap-3">
          <button
            on:click={cerrar}
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X class="w-6 h-6" />
          </button>
          <h2 class="text-xl font-semibold text-gray-900">Recordatorios</h2>
        </div>
        <div class="flex gap-2">
          <button
            on:click={actualizarRecordatorios}
            class="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <RefreshCw class="w-4 h-4" />
            MÁS RECIENTES
          </button>
          <button
            on:click={toggleFormulario}
            class="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            NUEVO
          </button>
        </div>
      </div>

      <!-- Contenido scrollable -->
      <div class="flex-1 overflow-y-auto p-6 scrollbar-custom">
        {#if mostrarFormulario}
          <!-- Formulario de nuevo recordatorio -->
          <div class="bg-white rounded-lg mb-6 border border-gray-200 max-h-[600px] overflow-y-auto scrollbar-custom">
            <div class="bg-white sticky top-0 z-10 border-b border-gray-200 px-6 py-4">
              <h3 class="text-lg font-semibold text-gray-900">ENVIAR MENSAJE</h3>
              {#if factura}
                <div class="mt-3 p-3 bg-blue-50 rounded-lg">
                  <div class="flex items-center justify-between text-sm">
                    <div>
                      <span class="font-medium text-gray-700">Factura:</span>
                      <span class="text-blue-600 ml-2">#{factura.numero_factura}</span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-700">Cliente:</span>
                      <span class="text-gray-900 ml-2">{factura.cliente?.razonSocial || 'N/A'}</span>
                    </div>
                    <div>
                      <span class="font-medium text-gray-700">Total:</span>
                      <span class="text-gray-900 ml-2">{formatearMoneda(factura.montoTotal || 0)}</span>
                    </div>
                  </div>
                </div>
              {/if}
            </div>

            <div class="p-6 space-y-4">
              <!-- Alertas de éxito/error -->
              {#if mensajeExito}
                <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-green-800">{mensajeExito}</p>
                  </div>
                </div>
              {/if}

              {#if mensajeError}
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-red-800">{mensajeError}</p>
                  </div>
                </div>
              {/if}

              <!-- Pestañas VÍA -->
              <div>
                <div class="block text-sm font-medium text-gray-700 mb-3">VÍA :</div>
                <div class="flex gap-4 border-b border-gray-200">
                  <button
                    type="button"
                    on:click={() => tipoMensaje = 'SMS'}
                    class="pb-3 px-4 text-sm font-medium transition-colors relative {tipoMensaje === 'SMS' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}"
                  >
                    💬 SMS
                    {#if tipoMensaje === 'SMS'}
                      <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                    {/if}
                  </button>
                  <button
                    type="button"
                    on:click={() => tipoMensaje = 'CORREO'}
                    class="pb-3 px-4 text-sm font-medium transition-colors relative {tipoMensaje === 'CORREO' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}"
                  >
                    ✉️ Correo
                    {#if tipoMensaje === 'CORREO'}
                      <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                    {/if}
                  </button>
                  <button
                    type="button"
                    on:click={() => tipoMensaje = 'URL'}
                    class="pb-3 px-4 text-sm font-medium transition-colors relative {tipoMensaje === 'URL' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}"
                  >
                    🔗 URL & Referencias
                    {#if tipoMensaje === 'URL'}
                      <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                    {/if}
                  </button>
                </div>
              </div>

              <!-- Tipo de mensaje -->
              <div>
                <label for="tipo-mensaje" class="block text-sm font-medium text-gray-700 mb-2">Tipo de mensaje</label>
                <select
                  id="tipo-mensaje"
                  bind:value={nuevoRecordatorio.tipoMensaje}
                  class="w-full px-4 py-3 border-2 border-blue-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none cursor-pointer text-gray-900 font-medium"
                  style="background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e'); background-repeat: no-repeat; background-position: right 0.75rem center; background-size: 1.5em 1.5em; padding-right: 2.5rem;"
                >
                  <option value="Recordatorio de pago">Recordatorio de pago</option>
                  <option value="Día de pago">Día de pago</option>
                  <option value="Pago tardío">Pago tardío</option>
                  <option value="Emisión de factura">Emisión de factura</option>
                </select>
              </div>

              {#if tipoMensaje === 'CORREO'}
                <!-- Para -->
                <div>
                  <label for="email-destinatario" class="block text-sm font-medium text-gray-700 mb-2">Para:</label>
                  <div class="flex items-center gap-2">
                    <div class="flex-1 flex flex-wrap items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg min-h-[42px]">
                      {#each nuevoRecordatorio.destinatarios as email}
                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                          {email}
                          <button
                            type="button"
                            on:click={() => removerDestinatario(email)}
                            class="text-blue-600 hover:text-blue-800"
                          >
                            ✕
                          </button>
                        </span>
                      {/each}
                      <input
                        id="email-destinatario"
                        type="email"
                        bind:value={inputDestinatario}
                        on:keydown={agregarDestinatario}
                        placeholder={nuevoRecordatorio.destinatarios.length === 0 ? 'Correo del cliente (presiona Enter o coma para agregar)' : ''}
                        class="flex-1 outline-none text-sm min-w-[200px]"
                      />
                    </div>
                    <button
                      type="button"
                      on:click={() => mostrarCampoCC = !mostrarCampoCC}
                      class="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {mostrarCampoCC ? 'Ocultar CC' : 'CC'}
                    </button>
                  </div>
                </div>

                <!-- CC (condicional) -->
                {#if mostrarCampoCC}
                  <div>
                    <label for="email-cc" class="block text-sm font-medium text-gray-700 mb-2">CC (Copia):</label>
                    <div class="flex flex-wrap items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg min-h-[42px]">
                      {#each nuevoRecordatorio.cc as email}
                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm">
                          {email}
                          <button
                            type="button"
                            on:click={() => removerCC(email)}
                            class="text-gray-600 hover:text-gray-800"
                          >
                            ✕
                          </button>
                        </span>
                      {/each}
                      <input
                        id="email-cc"
                        type="email"
                        bind:value={inputCC}
                        on:keydown={agregarCC}
                        placeholder={nuevoRecordatorio.cc.length === 0 ? 'Correos en copia (presiona Enter o coma para agregar)' : ''}
                        class="flex-1 outline-none text-sm min-w-[200px]"
                      />
                    </div>
                  </div>
                {/if}

                <!-- Asunto -->
                <div>
                  <label for="asunto-correo" class="block text-sm font-medium text-gray-700 mb-2">Asunto:</label>
                  <input
                    id="asunto-correo"
                    type="text"
                    bind:value={nuevoRecordatorio.asunto}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-blue-600"
                  />
                </div>

                <!-- Añadir etiqueta -->
                <div>
                  <button
                    type="button"
                    class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    ▶ Añadir etiqueta
                  </button>
                </div>

                <!-- Mensaje -->
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <div class="flex gap-2">
                      <button type="button" class="p-1 hover:bg-gray-100 rounded">
                        <span class="text-gray-600">≡</span>
                      </button>
                      <button type="button" class="p-1 hover:bg-gray-100 rounded">
                        <span class="text-gray-600">≡</span>
                      </button>
                      <button type="button" class="p-1 hover:bg-gray-100 rounded">
                        <span class="text-gray-600">≡</span>
                      </button>
                      <button type="button" class="p-1 hover:bg-gray-100 rounded">
                        <span class="text-gray-600">≡</span>
                      </button>
                      <button type="button" class="p-1 hover:bg-gray-100 rounded font-italic">
                        <span class="text-gray-600">I</span>
                      </button>
                      <button type="button" class="p-1 hover:bg-gray-100 rounded font-bold">
                        <span class="text-gray-600">B</span>
                      </button>
                      <button type="button" class="p-1 hover:bg-gray-100 rounded underline">
                        <span class="text-gray-600">U</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    bind:value={nuevoRecordatorio.mensaje}
                    rows="6"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                  ></textarea>
                </div>
              {/if}

              {#if tipoMensaje === 'SMS'}
                <!-- Destinatario SMS -->
                <div>
                  <label for="telefono-sms" class="block text-sm font-medium text-gray-700 mb-2">Número de teléfono:</label>
                  <input
                    id="telefono-sms"
                    type="tel"
                    bind:value={nuevoRecordatorio.destinatario}
                    placeholder="+52 000 000 0000"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <!-- Mensaje SMS -->
                <div>
                  <label for="mensaje-sms" class="block text-sm font-medium text-gray-700 mb-2">Mensaje:</label>
                  <textarea
                    id="mensaje-sms"
                    bind:value={nuevoRecordatorio.mensaje}
                    rows="4"
                    maxlength="160"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                  ></textarea>
                  <p class="text-xs text-gray-500 mt-1">{nuevoRecordatorio.mensaje.length}/160 caracteres</p>
                </div>
              {/if}

              {#if tipoMensaje === 'URL'}
                <!-- URL & Referencias -->
                <div>
                  <label for="url-referencia" class="block text-sm font-medium text-gray-700 mb-2">URL de referencia:</label>
                  <input
                    id="url-referencia"
                    type="url"
                    placeholder="https://"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label for="mensaje-url" class="block text-sm font-medium text-gray-700 mb-2">Mensaje adicional:</label>
                  <textarea
                    id="mensaje-url"
                    bind:value={nuevoRecordatorio.mensaje}
                    rows="4"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                  ></textarea>
                </div>
              {/if}

              <!-- Botones del formulario -->
              <div class="flex gap-3 justify-end pt-4 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  on:click={toggleFormulario}
                  disabled={enviando}
                  class="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  on:click={guardarRecordatorio}
                  disabled={enviando}
                  class="px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {#if enviando}
                    <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ENVIANDO...
                  {:else}
                    ENVIAR
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- Lista de recordatorios -->
        <div class="space-y-3">
          {#if cargandoRecordatorios}
            <div class="text-center py-12">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p class="mt-2 text-gray-600">Cargando recordatorios...</p>
            </div>
          {:else if recordatorios.length === 0}
            <div class="text-center py-12">
              <Mail class="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p class="text-gray-600">No hay recordatorios</p>
              <p class="text-sm text-gray-500 mt-1">Crea un nuevo recordatorio para esta factura</p>
            </div>
          {:else}
            {#each recordatorios as recordatorio}
              <div class="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                <!-- Icono -->
                <div class="p-3 {recordatorio.Visto ? 'bg-green-100' : 'bg-blue-100'} rounded-lg">
                  <Mail class="w-6 h-6 {recordatorio.Visto ? 'text-green-600' : 'text-blue-600'}" />
                </div>

                <!-- Información -->
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <h4 class="font-medium text-gray-900">{recordatorio.TipoMensaje}</h4>
                    {#if recordatorio.Visto}
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        ✓ Visto
                      </span>
                    {/if}
                  </div>
                  <p class="text-sm text-gray-900 font-medium mb-1">{recordatorio.Asunto}</p>
                  <p class="text-xs text-gray-600">
                    Para: {recordatorio.Destinatario}
                    {#if recordatorio.CC}
                      • CC: {recordatorio.CC}
                    {/if}
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    {new Date(recordatorio.FechaEnvio).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })} • {recordatorio.MetodoEnvio}
                  </p>
                  {#if recordatorio.Visto && recordatorio.FechaVisto}
                    <p class="text-xs text-green-600 mt-1">
                      Abierto: {new Date(recordatorio.FechaVisto).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  {/if}
                </div>

                <!-- Estado -->
                <div class="text-right">
                  <span class={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                    recordatorio.Estado === 'Fallido'
                      ? 'bg-red-100 text-red-700'
                      : recordatorio.Estado === 'Enviado'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {recordatorio.Estado}
                  </span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Scrollbar personalizada */
  .scrollbar-custom::-webkit-scrollbar {
    width: 8px;
  }

  .scrollbar-custom::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* Para Firefox */
  .scrollbar-custom {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }
</style>
