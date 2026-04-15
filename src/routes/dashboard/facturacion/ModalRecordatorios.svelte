<script lang="ts">
  import { get } from 'svelte/store';
  import { organizacionId as orgIdStore } from '$lib/stores/organizacion';
  import { createEventDispatcher } from 'svelte';
  import { X, Mail, RefreshCw, Plus, CheckCircle, AlertCircle, MessageCircle } from 'lucide-svelte';
  import type { Factura } from './types';
  import { authFetch } from '$lib/api';
  import { hoyLocal } from '$lib/utils/date';

  export let abierto = false;
  export let factura: Factura | null = null;
  export let abrirFormulario = false;

  const dispatch = createEventDispatcher();

  // Constantes de validación
  const MAX_ASUNTO = 200;
  const MAX_MENSAJE = 5000;
  const MAX_MENSAJE_WA = 4096;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Estado para mensajes de exito/error
  let enviando = false;
  let mensajeExito = '';
  let mensajeError = '';
  let cargandoDatos = false;
  let limiteAlcanzado = false;
  let verificandoLimite = false;

  // Lista de recordatorios desde la API
  let recordatorios: any[] = [];
  let cargandoRecordatorios = false;

  // Estado del formulario de nuevo recordatorio
  let mostrarFormulario = false;

  // Reactive: si abrirFormulario es true, abrir el formulario automaticamente
  $: if (abierto && abrirFormulario) {
    mostrarFormulario = true;
    if (factura) {
      cargarDatosCliente();
    }
  }

  // Cargar recordatorios cuando se abre el modal
  $: if (abierto && factura) {
    cargarRecordatorios();
    verificarLimiteDiario();
  }

  let tipoMensaje: 'WHATSAPP' | 'CORREO' = 'CORREO';
  let nuevoRecordatorio = {
    tipoMensaje: 'Recordatorio de pago',
    cc: [] as string[],
    asunto: '',
    mensaje: ''
  };

  // CC inputs
  let inputCC = '';
  let mostrarCampoCC = false;

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
        mensajeError = 'El correo electronico no tiene un formato valido';
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

  // Funcion para obtener el nombre del cliente
  function getNombreCliente(): string {
    if (!factura?.cliente) return 'Estimado cliente';
    return factura.cliente.nombreComercial || factura.cliente.razonSocial || 'Estimado cliente';
  }

  // Funcion para formatear moneda
  function formatearMoneda(monto: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(monto);
  }

  // Funcion para formatear fecha
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
      const organizacionId = get(orgIdStore)?.toString() || null;
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

  async function verificarLimiteDiario() {
    if (!factura) return;
    verificandoLimite = true;
    try {
      const hoy = hoyLocal();
      // Verificar si ya hay un recordatorio exitoso hoy mirando los recordatorios cargados
      // Esto se validará también en el backend, aquí es solo UX
      const organizacionId = get(orgIdStore)?.toString() || null;
      if (!organizacionId) return;

      const response = await authFetch(`/api/facturas/${factura.id}/recordatorios?organizacionId=${organizacionId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.recordatorios) {
          const hoyStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
          const recordatorioHoy = data.recordatorios.find((r: any) => {
            if (r.estado !== 'Enviado') return false;
            const fechaEnvio = new Date(r.fechaenvio).toLocaleDateString('en-CA');
            return fechaEnvio === hoyStr;
          });
          limiteAlcanzado = !!recordatorioHoy;
        }
      }
    } catch (error) {
      console.error('Error verificando limite diario:', error);
    } finally {
      verificandoLimite = false;
    }
  }

  async function cargarDatosCliente() {
    if (!factura) return;

    cargandoDatos = true;

    try {
      const nombreCliente = getNombreCliente();
      const numeroFactura = factura.numero_factura || 'N/A';
      const montoTotal = formatearMoneda(factura.montoTotal || 0);
      const fechaVencimiento = factura.fechaVencimiento ? formatearFecha(factura.fechaVencimiento) : 'proximamente';

      nuevoRecordatorio.asunto = `${nombreCliente}, recordatorio de pago - Factura ${numeroFactura}`;
      nuevoRecordatorio.mensaje = `Hola ${nombreCliente}!\n\nNos comunicamos contigo para recordarte que la fecha limite de pago de tu factura ${numeroFactura}, con un total de ${montoTotal}, vence el ${fechaVencimiento}.\n\nTe pedimos por favor realizar el pago a la brevedad posible.\n\nSi ya realizaste el pago, por favor ignora este mensaje.\n\nGracias por tu preferencia!`;
    } catch (error) {
      console.error('Error al cargar datos del cliente:', error);
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
    limiteAlcanzado = false;
    nuevoRecordatorio = {
      tipoMensaje: 'Recordatorio de pago',
      cc: [],
      asunto: '',
      mensaje: ''
    };
    inputCC = '';
    mostrarCampoCC = false;
    dispatch('cerrar');
  }

  function toggleFormulario() {
    mostrarFormulario = !mostrarFormulario;
    if (mostrarFormulario && factura) {
      cargarDatosCliente();
    }
  }

  function actualizarRecordatorios() {
    cargarRecordatorios();
  }

  // Obtener correo del cliente desde factura
  function getCorreoCliente(): string {
    return factura?.cliente?.correo || '';
  }

  // Obtener telefono WhatsApp del cliente
  function getTelefonoCliente(): string {
    return factura?.cliente?.telefonoWhatsApp || factura?.cliente?.telefono || '';
  }

  async function guardarRecordatorio() {
    if (!factura) {
      mensajeError = 'No se ha seleccionado ninguna factura';
      return;
    }

    mensajeError = '';
    mensajeExito = '';

    // Validar límite diario (frontend)
    if (limiteAlcanzado) {
      mensajeError = 'Ya se envió un recordatorio para esta factura hoy. Límite: 1 por día.';
      return;
    }

    if (!nuevoRecordatorio.mensaje.trim()) {
      mensajeError = 'El mensaje es requerido';
      return;
    }

    // Validar longitud del mensaje según el canal
    const maxLen = tipoMensaje === 'WHATSAPP' ? MAX_MENSAJE_WA : MAX_MENSAJE;
    if (nuevoRecordatorio.mensaje.trim().length > maxLen) {
      mensajeError = `El mensaje no puede exceder ${maxLen} caracteres`;
      return;
    }

    // Capturar cualquier CC pendiente en el input antes de enviar
    if (inputCC.trim()) {
      const pendingEmail = inputCC.trim().replace(/,$/g, '');
      if (pendingEmail && validarEmail(pendingEmail) && !nuevoRecordatorio.cc.includes(pendingEmail)) {
        nuevoRecordatorio.cc = [...nuevoRecordatorio.cc, pendingEmail];
      } else if (pendingEmail && !validarEmail(pendingEmail)) {
        mensajeError = 'Hay un correo CC con formato inválido';
        return;
      }
      inputCC = '';
    }

    enviando = true;

    try {
      const organizacionId = get(orgIdStore)?.toString() || null;

      if (!organizacionId) {
        mensajeError = 'No se pudo obtener la informacion de la organizacion';
        enviando = false;
        return;
      }

      if (tipoMensaje === 'CORREO') {
        const correoDestinatario = getCorreoCliente();
        if (!correoDestinatario) {
          mensajeError = 'El cliente no tiene correo electronico configurado';
          enviando = false;
          return;
        }

        if (!nuevoRecordatorio.asunto.trim()) {
          mensajeError = 'El asunto es requerido';
          enviando = false;
          return;
        }

        if (nuevoRecordatorio.asunto.trim().length > MAX_ASUNTO) {
          mensajeError = `El asunto no puede exceder ${MAX_ASUNTO} caracteres`;
          enviando = false;
          return;
        }

        const response = await authFetch(`/api/facturas/${factura.id}/enviar-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizacionId: parseInt(organizacionId),
            destinatario: correoDestinatario,
            cc: nuevoRecordatorio.cc.join(', '),
            asunto: nuevoRecordatorio.asunto.trim(),
            mensaje: nuevoRecordatorio.mensaje.trim()
          })
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 403) {
            mensajeError = data.error || 'Tu plan actual no incluye envío de correos. Actualiza tu plan desde Configuración.';
            enviando = false;
            return;
          }
          if (response.status === 429) {
            limiteAlcanzado = true;
          }
          mensajeError = data.error || data.details || 'Error al enviar el correo';
          enviando = false;
          return;
        }

        if (data.success) {
          mensajeExito = `Correo enviado exitosamente a ${correoDestinatario}`;
        } else {
          mensajeError = data.error || 'Error al enviar el correo';
          enviando = false;
          return;
        }

      } else if (tipoMensaje === 'WHATSAPP') {
        const telefonoDestinatario = getTelefonoCliente();
        if (!telefonoDestinatario) {
          mensajeError = 'El cliente no tiene telefono WhatsApp configurado';
          enviando = false;
          return;
        }

        const response = await authFetch(`/api/facturas/${factura.id}/enviar-recordatorio-whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mensaje: nuevoRecordatorio.mensaje.trim(),
            tipoMensaje: nuevoRecordatorio.tipoMensaje
          })
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 403) {
            mensajeError = data.error || 'Tu plan actual no incluye WhatsApp. Actualiza tu plan desde Configuración.';
            enviando = false;
            return;
          }
          if (response.status === 429) {
            limiteAlcanzado = true;
          }
          mensajeError = data.error || 'Error al enviar por WhatsApp';
          enviando = false;
          return;
        }

        if (data.success) {
          mensajeExito = `Recordatorio enviado por WhatsApp a ${telefonoDestinatario}`;
        } else {
          mensajeError = data.error || 'Error al enviar por WhatsApp';
          enviando = false;
          return;
        }
      }

      // Recargar la lista de recordatorios
      await cargarRecordatorios();

      // Actualizar límite diario
      limiteAlcanzado = true;

      // Limpiar formulario despues de 2.5 segundos
      setTimeout(() => {
        mostrarFormulario = false;
        mensajeExito = '';
      }, 2500);

      dispatch('recordatorioCreado');

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
            MAS RECIENTES
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
              <h3 class="text-lg font-semibold text-gray-900">ENVIAR RECORDATORIO</h3>
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
              <!-- Alerta de limite diario -->
              {#if limiteAlcanzado}
                <div class="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-amber-800">Ya se envió un recordatorio para esta factura hoy.</p>
                    <p class="text-xs text-amber-600 mt-1">Límite: 1 recordatorio por factura por día (correo o WhatsApp).</p>
                  </div>
                </div>
              {/if}

              <!-- Alertas de exito/error -->
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

              <!-- Pestanas VIA -->
              <div>
                <div class="block text-sm font-medium text-gray-700 mb-3">VIA :</div>
                <div class="flex gap-4 border-b border-gray-200">
                  <button
                    type="button"
                    on:click={() => tipoMensaje = 'CORREO'}
                    class="pb-3 px-4 text-sm font-medium transition-colors relative {tipoMensaje === 'CORREO' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}"
                  >
                    Correo
                    {#if tipoMensaje === 'CORREO'}
                      <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                    {/if}
                  </button>
                  <button
                    type="button"
                    on:click={() => tipoMensaje = 'WHATSAPP'}
                    class="pb-3 px-4 text-sm font-medium transition-colors relative {tipoMensaje === 'WHATSAPP' ? 'text-green-600' : 'text-gray-600 hover:text-gray-900'}"
                  >
                    WhatsApp
                    {#if tipoMensaje === 'WHATSAPP'}
                      <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
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
                  <option value="Dia de pago">Dia de pago</option>
                  <option value="Pago tardio">Pago tardio</option>
                  <option value="Emision de factura">Emision de factura</option>
                </select>
              </div>

              {#if tipoMensaje === 'CORREO'}
                <!-- Destinatario auto-detectado -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Para:</label>
                  <div class="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                    {#if getCorreoCliente()}
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                          {getCorreoCliente()}
                        </span>
                        <span class="text-xs text-gray-500">(correo del cliente)</span>
                      </div>
                    {:else}
                      <p class="text-sm text-amber-600">El cliente no tiene correo electronico configurado</p>
                    {/if}
                  </div>
                </div>

                <!-- CC (condicional) -->
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    on:click={() => mostrarCampoCC = !mostrarCampoCC}
                    class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {mostrarCampoCC ? '- Ocultar CC' : '+ Agregar CC'}
                  </button>
                </div>

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
                            x
                          </button>
                        </span>
                      {/each}
                      <input
                        id="email-cc"
                        type="text"
                        bind:value={inputCC}
                        on:keydown={agregarCC}
                        on:blur={() => {
                          if (inputCC.trim()) {
                            const email = inputCC.trim().replace(/,$/g, '');
                            if (email && validarEmail(email) && !nuevoRecordatorio.cc.includes(email)) {
                              nuevoRecordatorio.cc = [...nuevoRecordatorio.cc, email];
                              inputCC = '';
                            }
                          }
                        }}
                        placeholder={nuevoRecordatorio.cc.length === 0 ? 'Correos en copia (presiona Enter)' : ''}
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
                    maxlength={MAX_ASUNTO}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-blue-600"
                  />
                  <p class="text-xs text-gray-500 mt-1 text-right">{nuevoRecordatorio.asunto.length}/{MAX_ASUNTO}</p>
                </div>

                <!-- Mensaje -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Mensaje:</label>
                  <textarea
                    bind:value={nuevoRecordatorio.mensaje}
                    rows="6"
                    maxlength={MAX_MENSAJE}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                  ></textarea>
                  <p class="text-xs {nuevoRecordatorio.mensaje.length > MAX_MENSAJE * 0.9 ? 'text-amber-600' : 'text-gray-500'} mt-1 text-right">{nuevoRecordatorio.mensaje.length}/{MAX_MENSAJE}</p>
                </div>
              {/if}

              {#if tipoMensaje === 'WHATSAPP'}
                <!-- Destinatario WhatsApp auto-detectado -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Enviar a:</label>
                  <div class="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                    {#if getTelefonoCliente()}
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                          {getTelefonoCliente()}
                        </span>
                        <span class="text-xs text-gray-500">(WhatsApp del cliente)</span>
                      </div>
                    {:else}
                      <p class="text-sm text-amber-600">El cliente no tiene telefono WhatsApp configurado</p>
                    {/if}
                  </div>
                </div>

                <!-- Mensaje WhatsApp -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Mensaje:</label>
                  <textarea
                    bind:value={nuevoRecordatorio.mensaje}
                    rows="6"
                    maxlength={MAX_MENSAJE_WA}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none text-sm"
                  ></textarea>
                  <p class="text-xs {nuevoRecordatorio.mensaje.length > MAX_MENSAJE_WA * 0.9 ? 'text-amber-600' : 'text-gray-500'} mt-1 text-right">{nuevoRecordatorio.mensaje.length}/{MAX_MENSAJE_WA}</p>
                </div>

                <!-- Info WhatsApp -->
                <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p class="text-xs text-green-800">
                    El mensaje se enviara directamente al WhatsApp del cliente. Asegurate de que la organizacion tenga WhatsApp conectado en Configuracion.
                  </p>
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
                  disabled={enviando || limiteAlcanzado || (tipoMensaje === 'CORREO' && !getCorreoCliente()) || (tipoMensaje === 'WHATSAPP' && !getTelefonoCliente())}
                  class="px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 {tipoMensaje === 'WHATSAPP' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}"
                >
                  {#if enviando}
                    <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ENVIANDO...
                  {:else}
                    {tipoMensaje === 'WHATSAPP' ? 'ENVIAR POR WHATSAPP' : 'ENVIAR POR CORREO'}
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
                <!-- Icono segun tipo -->
                <div class="p-3 {recordatorio.metodoenvio === 'WhatsApp' || recordatorio.tipomensaje === 'WHATSAPP' ? 'bg-green-100' : recordatorio.visto ? 'bg-green-100' : 'bg-blue-100'} rounded-lg">
                  {#if recordatorio.metodoenvio === 'WhatsApp' || recordatorio.tipomensaje === 'WHATSAPP'}
                    <MessageCircle class="w-6 h-6 text-green-600" />
                  {:else}
                    <Mail class="w-6 h-6 {recordatorio.visto ? 'text-green-600' : 'text-blue-600'}" />
                  {/if}
                </div>

                <!-- Informacion -->
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <h4 class="font-medium text-gray-900">{recordatorio.tipomensaje}</h4>
                    {#if recordatorio.visto}
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                        Visto
                      </span>
                    {/if}
                  </div>
                  {#if recordatorio.asunto}
                    <p class="text-sm text-gray-900 font-medium mb-1">{recordatorio.asunto}</p>
                  {/if}
                  <p class="text-xs text-gray-600">
                    Para: {recordatorio.destinatario}
                    {#if recordatorio.cc}
                      | CC: {recordatorio.cc}
                    {/if}
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    {new Date(recordatorio.fechaenvio).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })} | {recordatorio.metodoenvio}
                  </p>
                  {#if recordatorio.visto && recordatorio.fechavisto}
                    <p class="text-xs text-green-600 mt-1">
                      Abierto: {new Date(recordatorio.fechavisto).toLocaleDateString('es-MX', {
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
                    recordatorio.estado === 'Fallido'
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

  .scrollbar-custom {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }
</style>
