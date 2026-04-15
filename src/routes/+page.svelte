<script lang="ts">
  import { onMount } from 'svelte';

  export let data: { autenticado: boolean };

  let visible = false;
  let mobileMenuOpen = false;

  // Animated counters
  let countFacturas = 0;
  let countClientes = 0;
  let countRecuperacion = 0;

  onMount(() => {
    visible = true;

    const duration = 2000;
    const frames = 60;
    const targets = { facturas: 50000, clientes: 1200, recuperado: 95 };
    let frame = 0;

    const interval = setInterval(() => {
      frame++;
      const progress = frame / frames;
      const eased = 1 - Math.pow(1 - progress, 3);
      countFacturas = Math.round(targets.facturas * eased);
      countClientes = Math.round(targets.clientes * eased);
      countRecuperacion = Math.round(targets.recuperado * eased);
      if (frame >= frames) clearInterval(interval);
    }, duration / frames);
  });

  const toggleMobileMenu = () => {
    mobileMenuOpen = !mobileMenuOpen;
  };

  // Chart bar heights
  const barHeights = [35, 55, 40, 70, 45, 65, 80, 50, 90, 60, 75, 95];
</script>

<svelte:head>
  <meta name="description" content="CuentIA Flow: Plataforma de facturación electrónica y cobranza autónoma con inteligencia artificial. Automatiza tu flujo de cobro." />
  <title>CuentIA Flow — Cobranza inteligente con IA</title>
</svelte:head>

<div class="min-h-screen bg-white overflow-x-hidden">
  <!-- Nav -->
  <nav class="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/40">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-2">
          <img src="/logo-cuentia-flow.png" alt="CuentIA Flow" class="h-8" />
        </div>

        <div class="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
          <a href="#funcionalidades" class="px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all">Funcionalidades</a>
          <a href="#como-funciona" class="px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all">Cómo funciona</a>
          <a href="#diferenciador" class="px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all">IA Autónoma</a>
          <a href="#planes" class="px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all">Planes</a>
          <a href="/nosotros" class="px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all">Nosotros</a>
          <a href="/faq" class="px-4 py-2 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all">FAQ</a>
        </div>

        <div class="hidden md:flex items-center gap-3">
          {#if data.autenticado}
            <a href="/dashboard" class="text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/50">Ir al Dashboard</a>
          {:else}
            <a href="/login" class="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors px-4 py-2">Iniciar sesión</a>
            <a href="/register" class="text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200/50 hover:shadow-lg hover:shadow-indigo-300/50">Prueba gratis</a>
          {/if}
        </div>

        <button class="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Menú" on:click={toggleMobileMenu}>
          <svg class="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            {#if mobileMenuOpen}
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            {/if}
          </svg>
        </button>
      </div>

      {#if mobileMenuOpen}
        <div class="md:hidden pb-4 border-t border-slate-100 mt-2 pt-4 space-y-1">
          <a href="#funcionalidades" class="block px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-700" on:click={() => mobileMenuOpen = false}>Funcionalidades</a>
          <a href="#como-funciona" class="block px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-700" on:click={() => mobileMenuOpen = false}>Cómo funciona</a>
          <a href="#diferenciador" class="block px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-700" on:click={() => mobileMenuOpen = false}>IA Autónoma</a>
          <a href="#planes" class="block px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-700" on:click={() => mobileMenuOpen = false}>Planes</a>
          <a href="/nosotros" class="block px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-700" on:click={() => mobileMenuOpen = false}>Nosotros</a>
          <a href="/faq" class="block px-4 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-700" on:click={() => mobileMenuOpen = false}>FAQ</a>
          <div class="pt-3 flex flex-col gap-2 px-4">
            {#if data.autenticado}
              <a href="/dashboard" class="text-center text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 rounded-xl">Ir al Dashboard</a>
            {:else}
              <a href="/login" class="text-center text-sm font-medium text-slate-700 py-2.5 rounded-xl border border-slate-200">Iniciar sesión</a>
              <a href="/register" class="text-center text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 rounded-xl">Prueba gratis</a>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </nav>

  <!-- Hero -->
  <section class="relative pt-28 pb-4 px-4 sm:px-6 lg:px-8 overflow-hidden">
    <div class="absolute inset-0 -z-10">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl hero-blob-1"></div>
      <div class="absolute top-20 right-1/4 w-80 h-80 bg-violet-200/30 rounded-full blur-3xl hero-blob-2"></div>
      <div class="absolute bottom-0 left-1/2 w-72 h-72 bg-cyan-200/20 rounded-full blur-3xl hero-blob-3"></div>
      <div class="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
    </div>

    <div class="max-w-7xl mx-auto">
      <div class="grid lg:grid-cols-2 gap-12 items-center">
        <div class:hero-animate={visible} class="text-center lg:text-left">
          <div class="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 text-sm font-semibold px-4 py-2 rounded-full mb-6 border border-indigo-100/60 shadow-sm">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            Cobrador autónomo con IA — Nuevo
          </div>

          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
            Tu cobranza en
            <span class="relative">
              <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">piloto automático</span>
              <svg class="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path d="M2 10C50 4 150 2 298 6" stroke="url(#underline-grad)" stroke-width="3" stroke-linecap="round" />
                <defs>
                  <linearGradient id="underline-grad" x1="0" y1="0" x2="300" y2="0">
                    <stop stop-color="#4f46e5" />
                    <stop offset="1" stop-color="#7c3aed" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          <p class="mt-8 text-lg sm:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Emite CFDI, gestiona cuentas por cobrar y deja que nuestra <strong class="text-slate-800">IA contacte a tus clientes por WhatsApp</strong> para cobrar por ti. Sin intervención manual.
          </p>

          <div class="mt-10 flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
            <a href="/register" class="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold px-8 py-4 rounded-2xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-xl shadow-indigo-300/30 hover:shadow-2xl hover:shadow-indigo-400/30 hover:-translate-y-0.5 text-base">
              Comenzar gratis
              <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a href="#como-funciona" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-slate-700 font-semibold px-8 py-4 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm hover:shadow-md">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ver cómo funciona
            </a>
          </div>

          <div class="mt-6 flex items-center justify-center lg:justify-start gap-6 text-sm text-slate-500">
            <span class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
              Sin tarjeta
            </span>
            <span class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
              Setup en 5 min
            </span>
            <span class="flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
              CFDI 4.0
            </span>
          </div>
        </div>

        <!-- Mock Dashboard Panel -->
        <div class:hero-animate-right={visible} class="relative">
          <div class="absolute -top-4 -left-4 z-20 bg-white rounded-2xl shadow-2xl shadow-slate-200/60 p-4 border border-slate-100 floating-card-1">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p class="text-xs text-slate-500">Pago recibido</p>
                <p class="text-sm font-bold text-slate-900">+$48,500 MXN</p>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-200/60 p-6 sm:p-8">
            <div class="flex items-center justify-between mb-6">
              <div>
                <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Panel de Cobranza</p>
                <p class="text-lg font-bold text-slate-900">Marzo 2026</p>
              </div>
              <div class="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> En tiempo real
              </div>
            </div>

            <!-- Chart bars -->
            <div class="flex items-end gap-1.5 h-24 mb-6">
              {#each barHeights as height, i}
                <div
                  class="flex-1 rounded-t-md transition-all duration-700"
                  class:bg-indigo-500={i === 11}
                  class:bg-indigo-400={i === 10 || i === 8}
                  class:bg-indigo-300={i !== 11 && i !== 10 && i !== 8}
                  style="height: {visible ? height : 0}%; transition-delay: {i * 60}ms"
                ></div>
              {/each}
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div class="bg-slate-50 rounded-xl p-3 text-center">
                <p class="text-xs text-slate-400 mb-1">Por cobrar</p>
                <p class="text-base font-bold text-slate-900">$2.4M</p>
                <p class="text-xs text-amber-600 font-medium">12 cuentas</p>
              </div>
              <div class="bg-emerald-50 rounded-xl p-3 text-center">
                <p class="text-xs text-slate-400 mb-1">Cobrado</p>
                <p class="text-base font-bold text-emerald-700">$1.8M</p>
                <p class="text-xs text-emerald-600 font-medium">+23% vs mes ant.</p>
              </div>
              <div class="bg-indigo-50 rounded-xl p-3 text-center">
                <p class="text-xs text-slate-400 mb-1">Recuperación</p>
                <p class="text-base font-bold text-indigo-700">87%</p>
                <p class="text-xs text-indigo-600 font-medium">Meta: 85%</p>
              </div>
            </div>

            <div class="mt-5 space-y-3">
              <div class="flex items-center gap-3 bg-green-50 rounded-xl p-3 border border-green-100">
                <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-green-800">IA cobró vía WhatsApp</p>
                  <p class="text-xs text-green-600 truncate">Distribuidora MX confirmó pago de $148,500</p>
                </div>
                <span class="text-xs text-green-500 flex-shrink-0">Hace 2 min</span>
              </div>
            </div>
          </div>

          <div class="absolute -bottom-3 -right-3 z-20 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl shadow-xl shadow-indigo-300/40 p-4 floating-card-2">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span class="text-sm font-bold">IA activa</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats Banner -->
  <section class="py-16 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <div class="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-3xl p-1">
        <div class="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-[calc(1.5rem-2px)] px-8 py-10">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            <div class="text-center">
              <p class="text-3xl sm:text-4xl font-black text-white">{countFacturas.toLocaleString()}+</p>
              <p class="text-indigo-200 text-sm mt-1 font-medium">Facturas emitidas</p>
            </div>
            <div class="text-center">
              <p class="text-3xl sm:text-4xl font-black text-white">{countClientes.toLocaleString()}+</p>
              <p class="text-indigo-200 text-sm mt-1 font-medium">Clientes activos</p>
            </div>
            <div class="text-center">
              <p class="text-3xl sm:text-4xl font-black text-white">{countRecuperacion}%</p>
              <p class="text-indigo-200 text-sm mt-1 font-medium">Tasa de recuperación</p>
            </div>
            <div class="text-center">
              <p class="text-3xl sm:text-4xl font-black text-white">24/7</p>
              <p class="text-indigo-200 text-sm mt-1 font-medium">IA siempre activa</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section id="funcionalidades" class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">Plataforma completa</div>
        <h2 class="text-3xl sm:text-4xl font-black text-slate-900">Todo lo que necesitas para cobrar más rápido</h2>
        <p class="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">Facturación, cobranza y automatización inteligente en una sola plataforma.</p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="group relative p-7 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100/50 hover:shadow-xl hover:shadow-blue-100/40 transition-all duration-500 hover:-translate-y-1">
          <div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-200/50 group-hover:scale-110 transition-transform duration-500">
            <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Facturación CFDI 4.0</h3>
          <p class="text-slate-500 text-sm leading-relaxed">Emite facturas válidas ante el SAT en segundos. Compatible con todos los regímenes fiscales de México.</p>
        </div>

        <div class="group relative p-7 rounded-3xl bg-gradient-to-br from-emerald-50 to-green-50/50 border border-emerald-100/50 hover:shadow-xl hover:shadow-emerald-100/40 transition-all duration-500 hover:-translate-y-1">
          <div class="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-200/50 group-hover:scale-110 transition-transform duration-500">
            <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Cuentas por cobrar</h3>
          <p class="text-slate-500 text-sm leading-relaxed">Visualiza saldos, antigüedad de cartera y prioriza cobros con inteligencia artificial integrada.</p>
        </div>

        <div class="group relative p-7 rounded-3xl bg-gradient-to-br from-violet-50 to-purple-50/50 border border-violet-100/50 hover:shadow-xl hover:shadow-violet-100/40 transition-all duration-500 hover:-translate-y-1">
          <div class="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-violet-200/50 group-hover:scale-110 transition-transform duration-500">
            <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Cobro por WhatsApp</h3>
          <p class="text-slate-500 text-sm leading-relaxed">Recordatorios de pago automáticos y personalizados directo al WhatsApp de tus clientes.</p>
        </div>

        <div class="group relative p-7 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-100/50 hover:shadow-xl hover:shadow-amber-100/40 transition-all duration-500 hover:-translate-y-1">
          <div class="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-amber-200/50 group-hover:scale-110 transition-transform duration-500">
            <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Dashboard en Tiempo Real</h3>
          <p class="text-slate-500 text-sm leading-relaxed">KPIs, aging de cartera y reportes exportables para tomar decisiones informadas al instante.</p>
        </div>

        <div class="group relative p-7 rounded-3xl bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-100/50 hover:shadow-xl hover:shadow-rose-100/40 transition-all duration-500 hover:-translate-y-1">
          <div class="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-rose-200/50 group-hover:scale-110 transition-transform duration-500">
            <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Multi-Organización</h3>
          <p class="text-slate-500 text-sm leading-relaxed">Gestiona múltiples empresas desde una sola cuenta. Ideal para despachos y grupos empresariales.</p>
        </div>

        <div class="group relative p-7 rounded-3xl bg-gradient-to-br from-cyan-50 to-teal-50/50 border border-cyan-100/50 hover:shadow-xl hover:shadow-cyan-100/40 transition-all duration-500 hover:-translate-y-1">
          <div class="w-14 h-14 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-cyan-200/50 group-hover:scale-110 transition-transform duration-500">
            <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Seguridad Empresarial</h3>
          <p class="text-slate-500 text-sm leading-relaxed">Cifrado de datos, autenticación robusta y cumplimiento con la LFPDPPP integrados.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- How it works -->
  <section id="como-funciona" class="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50/80">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">3 pasos simples</div>
        <h2 class="text-3xl sm:text-4xl font-black text-slate-900">Activa tu cobrador en minutos</h2>
        <p class="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">Sin instalaciones complicadas. Registra tu cuenta y la IA se encarga del resto.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-8 relative">
        <div class="hidden md:block absolute top-16 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-0.5 bg-gradient-to-r from-indigo-300 via-violet-300 to-purple-300"></div>

        <div class="relative text-center">
          <div class="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200/50 relative z-10 rotate-3 hover:rotate-0 transition-transform duration-300">
            <span class="text-2xl font-black text-white">1</span>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Registra tu empresa</h3>
          <p class="text-sm text-slate-500 leading-relaxed">Crea tu cuenta, conecta tu RFC y nuestro PAC autorizado se encarga de emitir CFDI válidos ante el SAT.</p>
        </div>

        <div class="relative text-center">
          <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-200/50 relative z-10 -rotate-3 hover:rotate-0 transition-transform duration-300">
            <span class="text-2xl font-black text-white">2</span>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">Carga tus clientes</h3>
          <p class="text-sm text-slate-500 leading-relaxed">Importa tu cartera de clientes y facturas pendientes. La IA analiza patrones de pago desde el día uno.</p>
        </div>

        <div class="relative text-center">
          <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-purple-200/50 relative z-10 rotate-3 hover:rotate-0 transition-transform duration-300">
            <span class="text-2xl font-black text-white">3</span>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-2">La IA cobra por ti</h3>
          <p class="text-sm text-slate-500 leading-relaxed">Nuestro cobrador autónomo contacta a tus clientes por WhatsApp y gestiona el cobro 24/7.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- AI Differentiator -->
  <section id="diferenciador" class="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white overflow-hidden">
    <div class="absolute inset-0">
      <div class="absolute top-1/4 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl"></div>
      <div class="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
    </div>

    <div class="max-w-7xl mx-auto relative z-10">
      <div class="grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <div class="inline-flex items-center gap-2 bg-white/5 text-indigo-300 text-sm font-semibold px-4 py-2 rounded-full mb-6 backdrop-blur border border-white/10">
            <svg class="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            Lo que nos hace diferentes
          </div>

          <h2 class="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight">
            Un cobrador que <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-300 to-violet-300">nunca descansa</span>
          </h2>

          <p class="mt-6 text-lg text-slate-300 leading-relaxed">
            Mientras otras plataformas solo envían notificaciones, CuentIA Flow incluye un <strong class="text-white">agente de IA que conversa con tus clientes vía WhatsApp</strong>, negocia fechas de pago y escala automáticamente el seguimiento.
          </p>

          <ul class="mt-8 space-y-4">
            {#each [
              'Contacta a tus clientes por WhatsApp y gestiona el cobro de forma autónoma',
              'Envía recordatorios en el momento óptimo según el historial de cada cliente',
              'Escala la intensidad del seguimiento según la antigüedad de la deuda',
              'Conversa, resuelve dudas y facilita la confirmación del pago',
              'Genera predicciones de cobrabilidad por cuenta con machine learning'
            ] as item}
              <li class="flex items-start gap-3 group/item">
                <div class="w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-emerald-500/20 group-hover/item:scale-110 transition-transform">
                  <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span class="text-slate-300 group-hover/item:text-white transition-colors">{item}</span>
              </li>
            {/each}
          </ul>
        </div>

        <!-- AI Chat Demo -->
        <div class="relative">
          <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 rounded-3xl blur-xl"></div>
          <div class="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-5 shadow-2xl">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
                  <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <div>
                  <p class="text-sm font-bold text-white">Agente IA CuentIA</p>
                  <p class="text-xs text-indigo-300">Gestionando cartera activa</p>
                </div>
              </div>
              <div class="flex items-center gap-1.5 bg-emerald-400/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-400/20">
                <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Activo
              </div>
            </div>

            <div class="space-y-3">
              <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                <div class="flex items-center gap-2 mb-2">
                  <p class="text-xs font-semibold text-indigo-300">Análisis de cartera</p>
                </div>
                <p class="text-sm text-slate-200">Cliente <span class="text-white font-semibold">"Distribuidora MX"</span> tiene 45 días de atraso. Historial: paga tras 2do recordatorio. Probabilidad de cobro: <span class="text-emerald-400 font-bold">87%</span></p>
              </div>

              <div class="bg-green-500/10 rounded-xl p-4 border border-green-400/10">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.103-1.127l-.29-.174-2.868.852.852-2.868-.174-.29A8 8 0 1112 20z" />
                  </svg>
                  <p class="text-xs font-semibold text-green-400">Mensaje enviado por WhatsApp</p>
                </div>
                <p class="text-sm text-green-100 italic">"Hola, le recordamos que tiene 3 facturas pendientes por $148,500 MXN. ¿Desea confirmar su fecha de pago?"</p>
              </div>

              <div class="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/10">
                <div class="flex items-center gap-2 mb-2">
                  <p class="text-xs font-semibold text-emerald-400">Cobro exitoso</p>
                </div>
                <p class="text-sm text-emerald-100">Cliente respondió. <span class="text-white font-semibold">Pago confirmado para el viernes</span>. 3 facturas por $148,500 MXN recuperados.</p>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <div class="flex gap-1">
                <span class="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                <span class="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                <span class="w-2 h-2 bg-indigo-400/60 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
              </div>
              <span class="text-xs text-indigo-400">Analizando siguiente cuenta...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Testimonials -->
  <section class="py-20 px-4 sm:px-6 lg:px-8 bg-white">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">Casos de éxito</div>
        <h2 class="text-3xl sm:text-4xl font-black text-slate-900">Empresas que ya cobran en automático</h2>
      </div>

      <div class="grid md:grid-cols-3 gap-8">
        <div class="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-300">
          <div class="flex items-center gap-1 mb-4">
            {#each Array(5) as _}<svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>{/each}
          </div>
          <p class="text-slate-600 text-sm leading-relaxed mb-6">"Redujimos nuestros días de cobranza de <strong class="text-slate-900">45 a 18 días</strong>. El cobrador con IA por WhatsApp es increíble, los clientes responden mucho más rápido."</p>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-sm">MA</div>
            <div>
              <p class="text-sm font-bold text-slate-900">María Alejandra R.</p>
              <p class="text-xs text-slate-500">Dir. Finanzas — Grupo Industrial del Norte</p>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-300">
          <div class="flex items-center gap-1 mb-4">
            {#each Array(5) as _}<svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>{/each}
          </div>
          <p class="text-slate-600 text-sm leading-relaxed mb-6">"Manejamos la facturación de <strong class="text-slate-900">8 empresas</strong> desde una sola cuenta. Antes usábamos 3 herramientas diferentes. CuentIA Flow lo unificó todo."</p>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm">CR</div>
            <div>
              <p class="text-sm font-bold text-slate-900">Carlos Rodríguez P.</p>
              <p class="text-xs text-slate-500">Socio — Despacho Contable Rodríguez & Asoc.</p>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-br from-slate-50 to-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-300">
          <div class="flex items-center gap-1 mb-4">
            {#each Array(5) as _}<svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>{/each}
          </div>
          <p class="text-slate-600 text-sm leading-relaxed mb-6">"La tasa de recuperación subió al <strong class="text-slate-900">92%</strong>. Lo mejor es que no tuve que contratar más personal para cobranza. La IA maneja todo."</p>
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">LP</div>
            <div>
              <p class="text-sm font-bold text-slate-900">Laura Patricia M.</p>
              <p class="text-xs text-slate-500">CEO — TechServ Solutions SAPI</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="planes" class="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50/80">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-16">
        <div class="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wider">Precios transparentes</div>
        <h2 class="text-3xl sm:text-4xl font-black text-slate-900">Planes que crecen contigo</h2>
        <p class="mt-4 text-lg text-slate-500">Elige el plan ideal para tu empresa. Todos incluyen prueba gratuita.</p>
      </div>

      <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <!-- Básico -->
        <div class="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
          <div class="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
          </div>
          <h3 class="text-xl font-bold text-slate-900">Básico</h3>
          <p class="text-sm text-slate-500 mt-1">Para emprendedores y freelancers</p>
          <div class="mt-6 mb-8">
            <span class="text-4xl font-black text-slate-900">$499</span>
            <span class="text-slate-400 text-sm">MXN/mes</span>
          </div>
          <ul class="space-y-3.5 mb-8">
            {#each ['1 organización', '50 facturas/mes', '50 clientes', 'WhatsApp + Correo', 'Cobrador IA', 'Dashboard básico'] as feature}
              <li class="flex items-center gap-2.5 text-sm text-slate-600">
                <div class="w-5 h-5 bg-emerald-100 rounded-md flex items-center justify-center flex-shrink-0">
                  <svg class="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                {feature}
              </li>
            {/each}
          </ul>
          <a href="/register" class="block w-full text-center py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all">Comenzar gratis</a>
        </div>

        <!-- Pro -->
        <div class="bg-white rounded-3xl border-2 border-indigo-500 p-8 relative shadow-2xl shadow-indigo-100/50 hover:-translate-y-1 transition-all duration-300 group scale-[1.02]">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-5 py-1.5 rounded-full shadow-lg shadow-indigo-300/30">Más popular</div>
          <div class="w-12 h-12 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          </div>
          <h3 class="text-xl font-bold text-slate-900">Pro</h3>
          <p class="text-sm text-slate-500 mt-1">Para PyMEs en crecimiento</p>
          <div class="mt-6 mb-8">
            <span class="text-4xl font-black text-slate-900">$1,299</span>
            <span class="text-slate-400 text-sm">MXN/mes</span>
          </div>
          <ul class="space-y-3.5 mb-8">
            {#each ['3 organizaciones', '200 facturas/mes', '200 clientes', 'WhatsApp + Correo', 'Cobrador IA', 'Complemento automático', 'Reportes avanzados'] as feature}
              <li class="flex items-center gap-2.5 text-sm text-slate-600">
                <div class="w-5 h-5 bg-indigo-100 rounded-md flex items-center justify-center flex-shrink-0">
                  <svg class="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                {feature}
              </li>
            {/each}
          </ul>
          <a href="/register" class="block w-full text-center py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200/50 hover:shadow-xl">Comenzar gratis</a>
        </div>

        <!-- Enterprise -->
        <div class="bg-white rounded-3xl border border-slate-200 p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
          <div class="w-12 h-12 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <h3 class="text-xl font-bold text-slate-900">Enterprise</h3>
          <p class="text-sm text-slate-500 mt-1">Para grandes empresas</p>
          <div class="mt-6 mb-8">
            <span class="text-4xl font-black text-slate-900">$3,499</span>
            <span class="text-slate-400 text-sm">MXN/mes</span>
          </div>
          <ul class="space-y-3.5 mb-8">
            {#each ['Organizaciones ilimitadas', 'Facturas ilimitadas', 'Cobrador IA avanzado', 'API para integraciones', 'Soporte prioritario'] as feature}
              <li class="flex items-center gap-2.5 text-sm text-slate-600">
                <div class="w-5 h-5 bg-slate-100 rounded-md flex items-center justify-center flex-shrink-0">
                  <svg class="w-3 h-3 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                {feature}
              </li>
            {/each}
          </ul>
          <a href="/register" class="block w-full text-center py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all">Contactar ventas</a>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700"></div>
    <div class="absolute inset-0">
      <div class="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
      <div class="absolute bottom-0 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
      <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
    </div>

    <div class="max-w-3xl mx-auto text-center relative z-10">
      <h2 class="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
        Deja de perseguir pagos.<br />
        <span class="text-indigo-200">Deja que la IA cobre por ti.</span>
      </h2>
      <p class="mt-6 text-lg text-indigo-100 max-w-xl mx-auto">Únete a las empresas mexicanas que ya automatizaron su cobranza con inteligencia artificial.</p>
      <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="/register" class="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-indigo-700 font-bold px-10 py-4 rounded-2xl hover:bg-indigo-50 transition-all shadow-2xl shadow-black/10 hover:-translate-y-0.5 text-lg">
          Comienza tu prueba gratuita
          <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
        </a>
      </div>
      <p class="mt-6 text-sm text-indigo-200/80">Sin tarjeta de crédito · Configuración en 5 minutos · Cancela cuando quieras</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-slate-950 text-slate-400 py-16 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <div class="grid md:grid-cols-4 gap-10">
        <div>
          <img src="/logo-cuentia-flow.png" alt="CuentIA Flow" class="h-10 mb-4 brightness-0 invert" />
          <p class="text-sm leading-relaxed">Plataforma de facturación electrónica y cobranza inteligente con IA para empresas mexicanas.</p>
          <div class="flex items-center gap-3 mt-5">
            <a href="https://linkedin.com/company/cuentia-flow" target="_blank" rel="noopener noreferrer" class="w-9 h-9 bg-slate-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors" aria-label="LinkedIn">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </a>
            <a href="https://facebook.com/cuentiaflow" target="_blank" rel="noopener noreferrer" class="w-9 h-9 bg-slate-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors" aria-label="Facebook">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            </a>
            <a href="https://instagram.com/cuentiaflow" target="_blank" rel="noopener noreferrer" class="w-9 h-9 bg-slate-800 hover:bg-indigo-600 rounded-lg flex items-center justify-center transition-colors" aria-label="Instagram">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z" /></svg>
            </a>
          </div>
        </div>

        <div>
          <h4 class="text-white font-bold mb-4 text-sm uppercase tracking-wider">Producto</h4>
          <ul class="space-y-2.5 text-sm">
            <li><a href="#funcionalidades" class="hover:text-white transition-colors">Funcionalidades</a></li>
            <li><a href="#diferenciador" class="hover:text-white transition-colors">IA Autónoma</a></li>
            <li><a href="#planes" class="hover:text-white transition-colors">Planes y precios</a></li>
          </ul>
        </div>

        <div>
          <h4 class="text-white font-bold mb-4 text-sm uppercase tracking-wider">Empresa</h4>
          <ul class="space-y-2.5 text-sm">
            <li><a href="/nosotros" class="hover:text-white transition-colors">Nosotros</a></li>
            <li><a href="/faq" class="hover:text-white transition-colors">Preguntas frecuentes</a></li>
          </ul>
        </div>

        <div>
          <h4 class="text-white font-bold mb-4 text-sm uppercase tracking-wider">Legal</h4>
          <ul class="space-y-2.5 text-sm">
            <li><a href="/aviso-privacidad" class="hover:text-white transition-colors">Aviso de privacidad</a></li>
            <li><a href="/terminos" class="hover:text-white transition-colors">Términos y condiciones</a></li>
          </ul>
        </div>
      </div>

      <div class="border-t border-slate-800/50 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
        <p>&copy; {new Date().getFullYear()} CuentIA Flow by Aurenix. Todos los derechos reservados.</p>
        <p class="text-slate-500">Hecho con 🤍 en México</p>
      </div>
    </div>
  </footer>
</div>

<style>
  .hero-animate {
    animation: fadeInUp 0.8s ease-out;
  }
  .hero-animate-right {
    animation: fadeInUp 0.8s ease-out 0.2s both;
  }
  .floating-card-1 {
    animation: float 6s ease-in-out infinite;
  }
  .floating-card-2 {
    animation: float 6s ease-in-out infinite 3s;
  }
  .hero-blob-1 {
    animation: blobMove 8s ease-in-out infinite;
  }
  .hero-blob-2 {
    animation: blobMove 10s ease-in-out infinite 2s;
  }
  .hero-blob-3 {
    animation: blobMove 12s ease-in-out infinite 4s;
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  @keyframes blobMove {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(10px, -10px) scale(1.05); }
    66% { transform: translate(-5px, 5px) scale(0.95); }
  }
</style>