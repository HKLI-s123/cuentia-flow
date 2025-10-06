<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, Mail, RefreshCw, Plus } from 'lucide-svelte';
  import type { Factura } from './types';

  export let abierto = false;
  export const factura: Factura | null = null;
  export let abrirFormulario = false;

  const dispatch = createEventDispatcher();

  // Lista de recordatorios (mock - debería venir de la API)
  let recordatorios = [
    {
      id: 1,
      tipo: 'CORREO',
      fecha: '02/oct./2025',
      metodo: 'Manual',
      estado: 'Rechazado'
    }
  ];

  // Estado del formulario de nuevo recordatorio
  let mostrarFormulario = false;

  // Reactive: si abrirFormulario es true, abrir el formulario automáticamente
  $: if (abierto && abrirFormulario) {
    mostrarFormulario = true;
  }
  let tipoMensaje: 'SMS' | 'CORREO' | 'URL' = 'CORREO';
  let nuevoRecordatorio = {
    tipoMensaje: 'Recordatorio de pago',
    destinatario: '',
    cc: '',
    asunto: '{{customer.name}}, tu fecha límite de pago está cerca.',
    mensaje: '¡Hola {{customer.name}}!\n\nNos comunicamos contigo para recordarte que la fecha límite de pago de tu factura {{invoice.code}}, con un total de $ $ {{invoice.amount}} {{invoice.currency}}, está muy cerca.',
    etiquetas: [] as string[]
  };

  function cerrar() {
    abierto = false;
    mostrarFormulario = false;
    abrirFormulario = false;
    dispatch('cerrar');
  }

  function toggleFormulario() {
    mostrarFormulario = !mostrarFormulario;
  }

  function actualizarRecordatorios() {
    // Aquí se haría la llamada a la API para actualizar
  }

  async function guardarRecordatorio() {
    try {
      // Aquí iría la llamada a la API para crear el recordatorio

      // Simular éxito
      recordatorios = [...recordatorios, {
        id: recordatorios.length + 1,
        tipo: tipoMensaje,
        fecha: new Date().toLocaleDateString('es-ES'),
        metodo: 'Manual',
        estado: 'Pendiente'
      }];

      // Limpiar formulario
      nuevoRecordatorio = {
        tipoMensaje: 'Recordatorio de pago',
        destinatario: '',
        cc: '',
        asunto: '{{customer.name}}, tu fecha límite de pago está cerca.',
        mensaje: '¡Hola {{customer.name}}!\n\nNos comunicamos contigo para recordarte que la fecha límite de pago de tu factura {{invoice.code}}, con un total de $ $ {{invoice.amount}} {{invoice.currency}}, está muy cerca.',
        etiquetas: []
      };

      mostrarFormulario = false;
      dispatch('recordatorioCreado');
    } catch (error) {
      // Error al guardar recordatorio
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
            </div>

            <div class="p-6 space-y-4">
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
                    <div class="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                      {#if nuevoRecordatorio.destinatario}
                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm">
                          {nuevoRecordatorio.destinatario}
                          <button
                            type="button"
                            on:click={() => nuevoRecordatorio.destinatario = ''}
                            class="text-gray-500 hover:text-gray-700"
                          >
                            ✕
                          </button>
                        </span>
                      {/if}
                      <input
                        id="email-destinatario"
                        type="email"
                        bind:value={nuevoRecordatorio.destinatario}
                        placeholder="Correo del cliente"
                        class="flex-1 outline-none text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      class="px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
                    >
                      CC
                    </button>
                  </div>
                </div>

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
                  class="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  on:click={guardarRecordatorio}
                  class="px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  ENVIAR
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- Lista de recordatorios -->
        <div class="space-y-3">
          {#if recordatorios.length === 0}
            <div class="text-center py-12">
              <Mail class="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p class="text-gray-600">No hay recordatorios</p>
              <p class="text-sm text-gray-500 mt-1">Crea un nuevo recordatorio para esta factura</p>
            </div>
          {:else}
            {#each recordatorios as recordatorio}
              <div class="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                <!-- Icono -->
                <div class="p-3 bg-green-100 rounded-lg">
                  <Mail class="w-6 h-6 text-green-600" />
                </div>

                <!-- Información -->
                <div class="flex-1">
                  <h4 class="font-medium text-gray-900">{recordatorio.tipo}</h4>
                  <p class="text-sm text-gray-600">{recordatorio.fecha} / {recordatorio.metodo}</p>
                </div>

                <!-- Estado -->
                <div class="text-right">
                  <span class={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                    recordatorio.estado === 'Rechazado'
                      ? 'bg-red-100 text-red-700'
                      : recordatorio.estado === 'Enviado'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {recordatorio.estado}
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
