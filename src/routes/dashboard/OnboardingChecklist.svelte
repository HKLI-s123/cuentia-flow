<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { authFetch } from '$lib/api';
  import { CheckCircle, Circle, ChevronRight, ChevronDown, ChevronUp, X, Rocket } from 'lucide-svelte';

  export let organizacionId: string;

  const dispatch = createEventDispatcher();

  let cargando = true;
  let oculto = false;
  let minimizado = false;
  let pasos: Record<string, boolean> = {
    cliente: false,
    factura: false,
    pago: false,
    whatsapp: false
  };
  let completados = 0;
  let total = 4;
  let completo = false;

  const definicionPasos = [
    {
      key: 'cliente',
      titulo: 'Agregar tu primer cliente',
      descripcion: 'Registra los datos fiscales de un cliente',
      href: '/dashboard/clientes',
      icono: '👤'
    },
    {
      key: 'factura',
      titulo: 'Emitir tu primera factura',
      descripcion: 'Crea y timbra una factura electrónica',
      href: '/dashboard/facturacion/nueva',
      icono: '📄'
    },
    {
      key: 'pago',
      titulo: 'Registrar un pago',
      descripcion: 'Registra un pago para emitir complemento',
      href: '/dashboard/pagos',
      icono: '💰'
    },
    {
      key: 'whatsapp',
      titulo: 'Configurar WhatsApp',
      descripcion: 'Conecta WhatsApp para el Cobrador IA',
      href: '/dashboard/configuracion',
      icono: '💬',
      opcional: true
    }
  ];

  $: porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;

  export async function cargar() {
    // Usar el prop o leer de sessionStorage como fallback
    const orgId = organizacionId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('organizacionActualId') : null);
    if (!orgId) return;

    // Actualizar el prop si venía vacío
    if (!organizacionId && orgId) {
      organizacionId = orgId;
    }

    // Verificar si el usuario ocultó el onboarding
    const dismissKey = `onboarding_dismissed_${orgId}`;
    if (typeof localStorage !== 'undefined' && localStorage.getItem(dismissKey) === 'true') {
      oculto = true;
      cargando = false;
      return;
    }

    try {
      const response = await authFetch(`/api/dashboard/onboarding?organizacionId=${orgId}`);
      const data = await response.json();

      if (data.success) {
        pasos = data.pasos;
        completados = data.completados;
        total = data.total;
        completo = data.completo;

        // Si ya completó todo, ocultar automáticamente
        if (completo) {
          oculto = true;
        }
      }
    } catch (err) {
      console.error('Error al cargar onboarding:', err);
    } finally {
      cargando = false;
    }
  }

  function irAPaso(href: string) {
    goto(href);
  }

  function ocultarOnboarding() {
    const orgId = organizacionId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('organizacionActualId') : null);
    const dismissKey = `onboarding_dismissed_${orgId}`;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(dismissKey, 'true');
    }
    oculto = true;
  }

  function toggleMinimizado() {
    minimizado = !minimizado;
  }
</script>

{#if !cargando && !oculto && !completo}
  <!-- Floating widget bottom-right -->
  <div class="fixed bottom-6 right-6 z-50 w-80 shadow-2xl rounded-xl overflow-hidden border border-gray-200 transition-all duration-300"
       style="max-height: {minimizado ? '56px' : '480px'};">

    <!-- Header - siempre visible -->
    <button
      on:click={toggleMinimizado}
      class="w-full bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 flex items-center justify-between cursor-pointer"
    >
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
          <Rocket class="w-4 h-4 text-white" />
        </div>
        <div class="text-left">
          <span class="text-sm font-semibold text-white">Guía de inicio</span>
          <span class="text-xs text-blue-200 ml-1.5">{completados}/{total}</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <!-- Barra de progreso mini en header -->
        <div class="w-12 bg-white/20 rounded-full h-1.5 mr-2">
          <div class="bg-white rounded-full h-1.5 transition-all duration-500" style="width: {porcentaje}%"></div>
        </div>
        {#if minimizado}
          <ChevronUp class="w-4 h-4 text-blue-200" />
        {:else}
          <ChevronDown class="w-4 h-4 text-blue-200" />
        {/if}
      </div>
    </button>

    <!-- Body - colapsable -->
    {#if !minimizado}
      <div class="bg-white">
        <!-- Pasos -->
        <div class="divide-y divide-gray-100 max-h-[340px] overflow-y-auto">
          {#each definicionPasos as paso}
            {@const completado = pasos[paso.key]}
            <button
              on:click={() => !completado && irAPaso(paso.href)}
              class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors {completado ? 'bg-gray-50/50' : 'hover:bg-blue-50 cursor-pointer'}"
              disabled={completado}
            >
              <!-- Icono estado -->
              <div class="flex-shrink-0">
                {#if completado}
                  <div class="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle class="w-4 h-4 text-green-600" />
                  </div>
                {:else}
                  <div class="w-7 h-7 bg-blue-50 border-2 border-blue-200 rounded-full flex items-center justify-center">
                    <span class="text-sm">{paso.icono}</span>
                  </div>
                {/if}
              </div>

              <!-- Texto -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-xs font-semibold {completado ? 'text-gray-400 line-through' : 'text-gray-900'}">
                    {paso.titulo}
                  </p>
                  {#if paso.opcional}
                    <span class="text-[9px] font-medium text-gray-400 bg-gray-100 px-1 py-0.5 rounded">Opcional</span>
                  {/if}
                </div>
                <p class="text-[11px] {completado ? 'text-gray-300' : 'text-gray-500'} mt-0.5 leading-tight">{paso.descripcion}</p>
              </div>

              <!-- Flecha -->
              {#if !completado}
                <ChevronRight class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {/if}
            </button>
          {/each}
        </div>

        <!-- Footer -->
        <div class="px-4 py-2.5 border-t border-gray-100 flex justify-end">
          <button
            on:click={ocultarOnboarding}
            class="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            No mostrar de nuevo
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}
