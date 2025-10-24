<script lang="ts">
  import { Home, DollarSign, BarChart3, CreditCard, Users, UserCog, FileText, PieChart, Settings, LogOut, Menu, X, Building2, ChevronDown } from "lucide-svelte";
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { notificarCambioOrganizacion, organizacionStore } from '$lib/stores/organizacion';

  // Estado del sidebar móvil
  let sidebarOpen = false;

  // Estado del dropdown de organizaciones
  let organizacionDropdownOpen = false;

  // Estado de carga al cambiar organización
  let cambiandoOrganizacion = false;

  // Lista de organizaciones del usuario
  let organizaciones: Array<{
    id: number;
    razonSocial: string;
    rfc: string;
    rolId: number;
    rolNombre: string;
  }> = [];

  // Organización actual
  let organizacionActual = {
    id: 0,
    razonSocial: 'Mi Empresa'
  };

  // Información del usuario
  let userInfo = {
    nombre: 'Usuario',
    email: 'usuario@empresa.com',
    organizacion: 'Mi Empresa',
    rol: 'Administrador',
    iniciales: 'U'
  };

  // Cargar lista de organizaciones del usuario
  async function loadOrganizaciones(userId: number) {
    if (!browser) return null;

    try {
      const { authFetch } = await import('$lib/api');
      const response = await authFetch(`/api/usuario/${userId}/organizaciones`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.organizaciones) {
          organizaciones = data.organizaciones;

          // Cargar organización seleccionada desde sessionStorage o usar la primera
          const orgIdGuardado = sessionStorage.getItem('organizacionActualId');
          if (orgIdGuardado) {
            const orgSeleccionada = organizaciones.find(org => org.id === parseInt(orgIdGuardado));
            if (orgSeleccionada) {
              organizacionActual = {
                id: orgSeleccionada.id,
                razonSocial: orgSeleccionada.razonSocial
              };
              return orgSeleccionada;
            }
          }

          // Si no hay organización guardada, usar la primera
          if (organizaciones.length > 0) {
            organizacionActual = {
              id: organizaciones[0].id,
              razonSocial: organizaciones[0].razonSocial
            };
            sessionStorage.setItem('organizacionActualId', organizaciones[0].id.toString());
            return organizaciones[0];
          }
        }
      }
    } catch (error) {
    }
    return null;
  }

  // Cambiar organización
  async function cambiarOrganizacion(org: typeof organizaciones[0]) {
    // Mostrar indicador de carga
    cambiandoOrganizacion = true;
    organizacionDropdownOpen = false;

    try {
      // Actualizar información local
      organizacionActual = {
        id: org.id,
        razonSocial: org.razonSocial
      };
      userInfo.organizacion = org.razonSocial;
      userInfo.rol = org.rolNombre;
      sessionStorage.setItem('organizacionActualId', org.id.toString());

      // Actualizar el userData en sessionStorage con la nueva organización
      const userDataStr = sessionStorage.getItem('userData');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        userData.organizacionId = org.id;
        userData.organizacionNombre = org.razonSocial;
        userData.rolId = org.rolId;
        userData.rolNombre = org.rolNombre;
        sessionStorage.setItem('userData', JSON.stringify(userData));
      }

      // Actualizar el store reactivo con la nueva organización
      organizacionStore.actualizar({
        id: org.id,
        nombre: org.razonSocial,
        rolId: org.rolId,
        rolNombre: org.rolNombre
      });

      // Notificar a todos los componentes que la organización cambió
      notificarCambioOrganizacion();

      // Invalidar todos los datos
      await invalidateAll();

      // Redirigir al dashboard principal para que todo se recargue correctamente
      await goto('/dashboard', { replaceState: true });

      // Esperar un poco más para asegurar que la navegación y recarga de datos se complete
      await new Promise(resolve => setTimeout(resolve, 800));

      // Ocultar indicador de carga
      cambiandoOrganizacion = false;
    } catch (error) {
      console.error('Error al cambiar de organización:', error);
      // Mantener la animación visible un momento antes de ocultar en caso de error
      await new Promise(resolve => setTimeout(resolve, 500));
      cambiandoOrganizacion = false;
    }
  }

  // Cargar información del usuario desde sessionStorage
  async function loadUserInfo() {
    if (!browser) return;

    try {
      const userData = sessionStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);

        // Cargar organizaciones del usuario
        const orgSeleccionada = await loadOrganizaciones(user.id);

        userInfo = {
          nombre: `${user.nombre} ${user.apellido}`,
          email: user.correo,
          organizacion: orgSeleccionada ? orgSeleccionada.razonSocial : 'Mi Empresa',
          rol: orgSeleccionada ? orgSeleccionada.rolNombre : 'Usuario',
          iniciales: `${user.nombre?.[0] || 'U'}${user.apellido?.[0] || ''}`
        };

        // Verificar consistencia entre organizacionId y organizacionActualId
        const organizacionActualId = sessionStorage.getItem('organizacionActualId');
        if (user.organizacionId && organizacionActualId &&
            parseInt(organizacionActualId) !== user.organizacionId) {
          console.warn(`⚠️ Inconsistencia detectada: organizacionId=${user.organizacionId}, organizacionActualId=${organizacionActualId}`);
          // Corregir: usar organizacionId como la fuente de verdad
          sessionStorage.setItem('organizacionActualId', user.organizacionId.toString());
          organizacionActual.id = user.organizacionId;
        }
      }
    } catch (error) {
      // En caso de error, mantener valores por defecto
    }
  }

  // Validar token al cargar el layout
  onMount(() => {
    const token = sessionStorage.getItem('jwt');
    if (!token) {
      goto('/');
    } else {
      // Inicializar el store de organización
      organizacionStore.init();

      // Cargar info del usuario sin bloquear
      loadUserInfo();
    }

    // Agregar listener para cerrar dropdown
    document.addEventListener('click', handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  // Logout: eliminar token y datos de usuario de sessionStorage
  const logout = () => {
    sessionStorage.removeItem('jwt');
    sessionStorage.removeItem('userData');
    sessionStorage.removeItem('organizacionActualId');
    organizacionStore.limpiar();
    goto('/');
  };

  // Toggle sidebar móvil
  const toggleSidebar = () => {
    sidebarOpen = !sidebarOpen;
  };

  // Cerrar dropdown al hacer click fuera
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (organizacionDropdownOpen && !target.closest('.dropdown-organizaciones')) {
      organizacionDropdownOpen = false;
    }
  }

  // Configuración de navegación
  const navigation = [
    { name: 'Inicio-Sergio', href: '/dashboard', icon: Home },
    { name: 'Por Cobrar', href: '/dashboard/por-cobrar', icon: DollarSign },
    { name: 'Ventas', href: '/dashboard/ventas', icon: BarChart3 },
    { name: 'Pagos', href: '/dashboard/pagos', icon: CreditCard },
    { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
    { name: 'Usuarios', href: '/dashboard/usuarios', icon: UserCog },
    { name: 'Contratos', href: '/dashboard/contratos', icon: FileText },
    { name: 'Reportes', href: '/dashboard/reportes', icon: PieChart },
    { name: 'Configuración', href: '/dashboard/configuracion', icon: Settings }
  ];

  // Función para verificar si una ruta está activa
  $: isActive = (href: string) => {
    if (href === '/dashboard') {
      return $page.url.pathname === '/dashboard';
    }
    return $page.url.pathname.startsWith(href);
  };
</script>

<!-- Mobile sidebar overlay -->
{#if sidebarOpen}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
    on:click={toggleSidebar}
    on:keydown={(e) => e.key === 'Escape' && toggleSidebar()}
    role="button"
    tabindex="0"
  ></div>
{/if}

<div class="flex min-h-screen">
  <!-- Sidebar Desktop & Mobile -->
  <aside class="
    {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    lg:translate-x-0 fixed lg:sticky inset-y-0 lg:top-0 left-0 z-50
    w-72 lg:h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
    text-white flex flex-col shadow-2xl border-r border-slate-700
    transition-transform duration-300 ease-in-out
  ">
    <!-- Header del Sidebar -->
    <div class="relative p-4 border-b border-slate-700/50">
      <div class="dropdown-organizaciones">
        <!-- Dropdown de organizaciones -->
        <button
          class="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700/30 transition-colors group"
          on:click={() => organizacionDropdownOpen = !organizacionDropdownOpen}
        >
          <div class="flex items-center gap-2 mb-1">
            <Building2 class="w-4 h-4 text-blue-400 flex-shrink-0" />
            <h1 class="text-sm font-bold text-white truncate flex-1 max-w-[180px]">
              {organizacionActual.razonSocial}
            </h1>
            <ChevronDown
              class="w-4 h-4 text-slate-400 transition-transform flex-shrink-0 {organizacionDropdownOpen ? 'rotate-180' : ''} {organizaciones.length <= 1 ? 'opacity-30' : 'opacity-100'}"
            />
          </div>
          <p class="text-xs text-slate-400 pl-6">Sistema de Gestión</p>
        </button>

        <!-- Dropdown menu -->
        {#if organizacionDropdownOpen}
          <div class="absolute top-[calc(100%-1rem)] left-4 right-4 mt-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50 max-h-64 overflow-y-auto">
            {#each organizaciones as org}
              <button
                class="w-full px-3 py-2.5 text-left hover:bg-slate-700 transition-colors flex items-center gap-3 border-b border-slate-700/50"
                class:bg-slate-700={org.id === organizacionActual.id}
                on:click={() => cambiarOrganizacion(org)}
              >
                <Building2 class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-white truncate">{org.razonSocial}</p>
                  <p class="text-xs text-slate-400 truncate">{org.rfc}</p>
                </div>
                {#if org.id === organizacionActual.id}
                  <div class="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                {/if}
              </button>
            {/each}

            <!-- Botón agregar organización -->
            <a
              href="/dashboard/organizaciones/nueva"
              class="w-full px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors flex items-center gap-3 border-t border-slate-600"
              on:click={() => organizacionDropdownOpen = false}
            >
              <div class="w-3.5 h-3.5 flex items-center justify-center">
                <span class="text-blue-400 text-lg leading-none">+</span>
              </div>
              <p class="text-xs font-medium text-blue-400">Agregar organización</p>
            </a>
          </div>
        {/if}
      </div>

      <!-- Close button móvil -->
      <button
        class="lg:hidden absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-700 transition-colors z-10"
        on:click={toggleSidebar}
      >
        <X class="w-5 h-5" />
      </button>
    </div>
    
    <!-- Navegación -->
    <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
      {#each navigation as item}
        <a 
          href={item.href} 
          class="group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 
            {isActive(item.href) 
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25' 
              : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }"
          on:click={() => { if (window.innerWidth < 1024) sidebarOpen = false; }}
        >
          <svelte:component 
            this={item.icon} 
            class="w-5 h-5 transition-transform duration-200 {isActive(item.href) ? 'scale-110' : 'group-hover:scale-105'}" 
          />
          <span class="transition-all duration-200">{item.name}</span>
          
          <!-- Indicador activo -->
          {#if isActive(item.href)}
            <div class="ml-auto w-2 h-2 bg-white rounded-full animate-pulse"></div>
          {/if}
        </a>
      {/each}
    </nav>

    <!-- User info y logout -->
    <div class="p-4 border-t border-slate-700/50 bg-slate-800/50">
      <!-- Info del usuario -->
      <div class="flex items-center gap-3 p-3 mb-3 rounded-xl bg-slate-700/30">
        <div class="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center">
          <span class="text-sm font-bold text-white">{userInfo.iniciales}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">{userInfo.nombre}</p>
          <p class="text-xs text-slate-400 truncate">{userInfo.email}</p>
          <p class="text-xs text-slate-500 truncate">{userInfo.rol}</p>
        </div>
      </div>
      
      <!-- Botón logout -->
      <button
        class="flex items-center gap-3 w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25 group"
        on:click={logout}
      >
        <LogOut class="w-5 h-5 transition-transform duration-200 group-hover:scale-105" />
        <span>Cerrar Sesión</span>
      </button>
    </div>
  </aside>

  <!-- Main content area -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Header -->
    <header class="bg-white/80 backdrop-blur-sm shadow-sm border-b border-slate-200 flex-shrink-0 z-30">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Mobile menu button -->
          <button
            class="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            on:click={toggleSidebar}
          >
            <Menu class="w-6 h-6" />
          </button>

          <!-- Page title -->
          <div class="flex-1 lg:flex lg:items-center lg:justify-between">
            <div>
              <h1 class="text-2xl font-bold text-slate-900">
                {#each navigation as item}
                  {#if isActive(item.href)}
                    {item.name}
                  {/if}
                {/each}
              </h1>
              <p class="text-sm text-slate-600 mt-1">
                Gestiona tu negocio de manera eficiente
              </p>
            </div>

          </div>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="flex-1 bg-gradient-to-br from-slate-50 to-blue-50">
      <div class="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <slot />
      </div>
    </main>
  </div>
</div>

<!-- Overlay de carga al cambiar organización -->
{#if cambiandoOrganizacion}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
      <div class="mb-4">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full animate-pulse">
          <Building2 class="w-8 h-8 text-white" />
        </div>
      </div>
      <h3 class="text-xl font-bold text-slate-900 mb-2">Cambiando organización</h3>
      <p class="text-slate-600 text-sm">Actualizando información...</p>
      <div class="mt-4 flex justify-center gap-2">
        <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
        <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
        <div class="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Estilos adicionales para mejorar la experiencia */
  :global(body) {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  }
  
  /* Animación para el indicador activo */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* Scrollbar personalizada */
  nav::-webkit-scrollbar {
    width: 4px;
  }
  
  nav::-webkit-scrollbar-track {
    background: rgba(71, 85, 105, 0.1);
  }
  
  nav::-webkit-scrollbar-thumb {
    background: rgba(71, 85, 105, 0.3);
    border-radius: 2px;
  }
  
  nav::-webkit-scrollbar-thumb:hover {
    background: rgba(71, 85, 105, 0.5);
  }
</style>