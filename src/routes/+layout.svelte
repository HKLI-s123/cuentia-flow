<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { obtenerCSRFToken } from '$lib/auth';

  let showCookieConsent = false;

  onMount(async () => {
    await obtenerCSRFToken();
    if (!localStorage.getItem('cookies_accepted')) {
      showCookieConsent = true;
    }
  });

  function acceptAll() {
    localStorage.setItem('cookies_accepted', 'true');
    showCookieConsent = false;
  }

  function acceptEssential() {
    localStorage.setItem('cookies_accepted', 'essential');
    showCookieConsent = false;
  }
</script>

<svelte:head>
  <meta name="description" content="CuentIA Flow — Plataforma de facturación electrónica y cobranza inteligente con IA" />
  <link rel="icon" href="/favicon.ico" />
  <title>CuentIA Flow</title>
</svelte:head>

<div class="bg-gray-100">
  <slot />
</div>

{#if showCookieConsent}
  <div class="fixed bottom-0 inset-x-0 z-[9999] px-4 pb-4 sm:px-6 sm:pb-6">
    <div class="mx-auto max-w-4xl rounded-xl bg-white shadow-2xl ring-1 ring-slate-200 p-5 sm:p-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <svg class="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 class="text-sm font-semibold text-slate-800">Uso de cookies</h3>
          </div>
          <p class="text-sm text-slate-600">
            Utilizamos cookies esenciales para el funcionamiento de la plataforma y cookies analíticas para mejorar tu experiencia. 
            Puedes aceptar todas o solo las esenciales. Consulta nuestro <a href="/aviso-privacidad" class="text-indigo-600 hover:text-indigo-700 underline">Aviso de Privacidad</a> para más información.
          </p>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0 w-full sm:w-auto">
          <button on:click={acceptEssential} class="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Solo esenciales</button>
          <button on:click={acceptAll} class="flex-1 sm:flex-initial px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm">Aceptar todas</button>
        </div>
      </div>
    </div>
  </div>
{/if}
