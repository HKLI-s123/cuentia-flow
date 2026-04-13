<script lang="ts">
  import { onMount } from 'svelte';
  import { authFetch } from '$lib/api';
  import { Button } from '$lib/components/ui';
  import { Send, Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-svelte';
  import Swal from 'sweetalert2';

  // Estado del formulario
  let asunto = '';
  let categoria = 'general';
  let descripcion = '';
  let enviando = false;

  // Historial
  let tickets: any[] = [];
  let cargandoTickets = true;
  let historialExpandido = false;

  const categorias = [
    { value: 'general', label: 'General' },
    { value: 'facturacion', label: 'Facturación' },
    { value: 'pagos', label: 'Pagos' },
    { value: 'clientes', label: 'Clientes' },
    { value: 'cuenta', label: 'Mi cuenta' },
    { value: 'bug', label: 'Reportar error' },
    { value: 'otro', label: 'Otro' }
  ];

  onMount(() => {
    cargarTickets();
  });

  async function cargarTickets() {
    cargandoTickets = true;
    try {
      const response = await authFetch('/api/soporte');
      const data = await response.json();
      if (data.success) {
        tickets = data.tickets;
      }
    } catch (err) {
      console.error('Error al cargar tickets:', err);
    } finally {
      cargandoTickets = false;
    }
  }

  async function enviarSolicitud() {
    if (enviando) return;

    if (asunto.trim().length < 5) {
      Swal.fire({ icon: 'warning', title: 'Asunto requerido', text: 'El asunto debe tener al menos 5 caracteres', confirmButtonColor: '#3b82f6' });
      return;
    }
    if (descripcion.trim().length < 10) {
      Swal.fire({ icon: 'warning', title: 'Descripción requerida', text: 'La descripción debe tener al menos 10 caracteres', confirmButtonColor: '#3b82f6' });
      return;
    }

    enviando = true;
    try {
      const organizacionId = sessionStorage.getItem('organizacionActualId');

      const response = await authFetch('/api/soporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asunto: asunto.trim(),
          categoria,
          descripcion: descripcion.trim(),
          organizacionId
        })
      });

      const data = await response.json();

      if (data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Solicitud enviada',
          text: `Tu ticket #${data.ticketId} ha sido creado. Te responderemos lo antes posible.`,
          confirmButtonColor: '#3b82f6'
        });

        // Limpiar formulario
        asunto = '';
        categoria = 'general';
        descripcion = '';

        // Recargar historial
        await cargarTickets();
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'No se pudo enviar la solicitud', confirmButtonColor: '#3b82f6' });
      }
    } catch (err) {
      console.error('Error al enviar solicitud:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Error de conexión al enviar la solicitud', confirmButtonColor: '#3b82f6' });
    } finally {
      enviando = false;
    }
  }

  function formatearFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function estadoBadge(estado: string) {
    switch (estado) {
      case 'abierto': return 'bg-blue-100 text-blue-700';
      case 'en_proceso': return 'bg-yellow-100 text-yellow-700';
      case 'resuelto': return 'bg-green-100 text-green-700';
      case 'cerrado': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-500';
    }
  }

  function estadoLabel(estado: string) {
    switch (estado) {
      case 'abierto': return 'Abierto';
      case 'en_proceso': return 'En proceso';
      case 'resuelto': return 'Resuelto';
      case 'cerrado': return 'Cerrado';
      default: return estado;
    }
  }

  function categoriaLabel(cat: string) {
    return categorias.find(c => c.value === cat)?.label || cat;
  }
</script>

<svelte:head>
  <title>Soporte — CuentIA Flow</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-gray-900">Soporte</h1>
    <p class="text-gray-500 mt-1">¿Necesitas ayuda? Envíanos tu solicitud y te responderemos lo antes posible.</p>
  </div>

  <!-- WhatsApp directo -->
  <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.112.549 4.098 1.511 5.829L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.876 0-3.653-.504-5.19-1.384l-.372-.22-3.858 1.009 1.03-3.765-.243-.385A9.698 9.698 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
      </div>
      <div>
        <p class="text-sm font-medium text-green-800">¿Prefieres atención directa?</p>
        <p class="text-xs text-green-600">Escríbenos por WhatsApp y te atenderemos al momento</p>
      </div>
    </div>
    <a
      href="https://wa.me/526564053919?text=Hola%2C%20necesito%20ayuda%20con%20CuentIA%20Flow"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.112.549 4.098 1.511 5.829L0 24l6.335-1.652A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.876 0-3.653-.504-5.19-1.384l-.372-.22-3.858 1.009 1.03-3.765-.243-.385A9.698 9.698 0 012.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75z"/></svg>
      Abrir WhatsApp
    </a>
  </div>

  <!-- Formulario -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <h2 class="text-lg font-semibold text-gray-800 mb-4">Nueva solicitud</h2>

    <form on:submit|preventDefault={enviarSolicitud} class="space-y-4">
      <!-- Categoría y Asunto en fila -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label for="categoria" class="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select
            id="categoria"
            bind:value={categoria}
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {#each categorias as cat}
              <option value={cat.value}>{cat.label}</option>
            {/each}
          </select>
        </div>

        <div class="md:col-span-2">
          <label for="asunto" class="block text-sm font-medium text-gray-700 mb-1">Asunto</label>
          <input
            id="asunto"
            type="text"
            bind:value={asunto}
            placeholder="Describe brevemente tu problema"
            maxlength="200"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p class="text-xs text-gray-400 mt-1">{asunto.length}/200</p>
        </div>
      </div>

      <!-- Descripción -->
      <div>
        <label for="descripcion" class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          id="descripcion"
          bind:value={descripcion}
          placeholder="Explica con detalle tu solicitud, qué pasos seguiste y qué resultado esperabas..."
          rows="5"
          maxlength="5000"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
        ></textarea>
        <p class="text-xs text-gray-400 mt-1">{descripcion.length}/5000</p>
      </div>

      <!-- Botón enviar -->
      <div class="flex justify-end">
        <Button variant="primary" size="md" on:click={enviarSolicitud} disabled={enviando}>
          {#if enviando}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Enviando...
          {:else}
            <Send class="w-4 h-4 mr-2" />
            Enviar solicitud
          {/if}
        </Button>
      </div>
    </form>
  </div>

  <!-- Historial de tickets -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200">
    <button
      on:click={() => historialExpandido = !historialExpandido}
      class="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
    >
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold text-gray-800">Mis solicitudes</h2>
        {#if tickets.length > 0}
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            {tickets.length}
          </span>
        {/if}
      </div>
      {#if historialExpandido}
        <ChevronUp class="w-5 h-5 text-gray-400" />
      {:else}
        <ChevronDown class="w-5 h-5 text-gray-400" />
      {/if}
    </button>

    {#if historialExpandido}
      <div class="border-t border-gray-200">
        {#if cargandoTickets}
          <div class="p-6 text-center text-gray-500">
            <svg class="animate-spin h-6 w-6 mx-auto mb-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            Cargando...
          </div>
        {:else if tickets.length === 0}
          <div class="p-6 text-center text-gray-500">
            <AlertCircle class="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No tienes solicitudes de soporte previas</p>
          </div>
        {:else}
          <div class="divide-y divide-gray-100">
            {#each tickets as ticket}
              <div class="p-4 hover:bg-gray-50 transition-colors">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs text-gray-400 font-mono">#{ticket.id}</span>
                      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {estadoBadge(ticket.estado)}">
                        {estadoLabel(ticket.estado)}
                      </span>
                      <span class="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {categoriaLabel(ticket.categoria)}
                      </span>
                    </div>
                    <p class="text-sm font-medium text-gray-900 truncate">{ticket.asunto}</p>
                    <p class="text-xs text-gray-500 mt-1 line-clamp-2">{ticket.descripcion}</p>
                  </div>
                  <div class="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    {formatearFecha(ticket.createdat)}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
