<script lang="ts">
  import { onMount } from 'svelte';
  import { UserPlus, Search, Filter, MoreVertical, Edit2, Trash2, Eye, EyeOff, Mail, Phone, Lock, User, AlertCircle } from "lucide-svelte";
  import { authFetch } from '$lib/api';
  import Swal from 'sweetalert2';

  // Variables reactivas
  let usuarios: any[] = [];
  let loading = false;
  let searchTerm = '';
  let showModal = false;
  let editingUser: any = null;
  let showPassword = false;

  // Listas para comboboxes
  let organizaciones: any[] = [];
  let roles: any[] = [];

  // Variable para verificar si el usuario es administrador
  let esAdministrador = false;
  let usuarioActualId: number | null = null;

  // Formulario de nuevo usuario
  let nuevoUsuario = {
    correo: '',
    contrasena: '',
    numero_tel: '',
    Nombre: '',
    Apellido: '',
    activo: 1,
    organizacionId: '',
    rolId: ''
  };

  // Errores de validación
  let errors: any = {
    correo: '',
    contrasena: '',
    numero_tel: '',
    Nombre: '',
    Apellido: '',
    organizacionId: '',
    rolId: ''
  };

  // Variable de entorno para la API
  let API_URL = '';

  // Cargar datos iniciales
  onMount(async () => {
    await verificarRolUsuario();
    await cargarUsuarios();
    await cargarOrganizaciones();
    await cargarRoles();
  });

  // Verificar si el usuario actual es administrador
  async function verificarRolUsuario() {
    try {
      const userData = sessionStorage.getItem('userData');
      if (!userData) return;

      const user = JSON.parse(userData);
      usuarioActualId = user.id;
      const organizacionId = user.organizacionId;

      const response = await authFetch(`/api/usuario/${user.id}/organizacion`);
      if (response.ok) {
        const data = await response.json();
        // Verificar si el rol es Administrador
        esAdministrador = data.rolNombre === 'Administrador';
      }
    } catch (error) {
      console.error('Error al verificar rol:', error);
    }
  }

  // Cargar organizaciones del usuario logueado
  async function cargarOrganizaciones() {
    try {
      const userData = sessionStorage.getItem('userData');
      if (!userData) return;

      const user = JSON.parse(userData);
      const response = await authFetch(`/api/usuario/${user.id}/organizaciones`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          organizaciones = data.organizaciones;
        }
      }
    } catch (error) {
      console.error('Error al cargar organizaciones:', error);
    }
  }

  // Cargar roles disponibles
  async function cargarRoles() {
    try {
      const response = await authFetch('/api/roles');

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          roles = data.roles;
        }
      }
    } catch (error) {
      console.error('Error al cargar roles:', error);
    }
  }

  // Cargar usuarios de la organización actual
  async function cargarUsuarios() {
    loading = true;
    try {
      const userData = sessionStorage.getItem('userData');
      if (!userData) {
        loading = false;
        return;
      }

      const user = JSON.parse(userData);
      const organizacionId = user.organizacionId;

      if (!organizacionId) {
        console.error('No se encontró organizacionId en userData');
        loading = false;
        return;
      }

      // Cargar usuarios usando authFetch
      const response = await authFetch(`/api/usuarios?organizacionId=${organizacionId}`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          usuarios = data.usuarios.map((u: any) => ({
            id: u.id,
            correo: u.correo,
            Nombre: u.nombre,
            Apellido: u.apellido,
            numero_tel: u.numeroTel || '',
            activo: u.activo,
            fechaCreacion: u.fechaCreacion,
            rolId: u.rolId,
            rolNombre: u.rolNombre
          }));
        }
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      loading = false;
    }
  }

  // Validar formulario
  function validarFormulario(): boolean {
    let esValido = true;
    errors = {
      correo: '',
      contrasena: '',
      numero_tel: '',
      Nombre: '',
      Apellido: '',
      organizacionId: '',
      rolId: ''
    };

    // Validar nombre
    if (!nuevoUsuario.Nombre.trim()) {
      errors.Nombre = 'El nombre es obligatorio';
      esValido = false;
    } else if (nuevoUsuario.Nombre.trim().length < 2) {
      errors.Nombre = 'El nombre debe tener al menos 2 caracteres';
      esValido = false;
    }

    // Validar apellido
    if (!nuevoUsuario.Apellido.trim()) {
      errors.Apellido = 'El apellido es obligatorio';
      esValido = false;
    } else if (nuevoUsuario.Apellido.trim().length < 2) {
      errors.Apellido = 'El apellido debe tener al menos 2 caracteres';
      esValido = false;
    }

    // Validar correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!nuevoUsuario.correo.trim()) {
      errors.correo = 'El correo electrónico es obligatorio';
      esValido = false;
    } else if (!emailRegex.test(nuevoUsuario.correo)) {
      errors.correo = 'El correo electrónico no es válido';
      esValido = false;
    }

    // Validar contraseña (solo obligatoria al crear, opcional al editar)
    if (!editingUser) {
      // Modo creación - contraseña obligatoria
      if (!nuevoUsuario.contrasena) {
        errors.contrasena = 'La contraseña es obligatoria';
        esValido = false;
      } else if (nuevoUsuario.contrasena.length < 6) {
        errors.contrasena = 'La contraseña debe tener al menos 6 caracteres';
        esValido = false;
      }
    } else {
      // Modo edición - contraseña opcional, pero si se ingresa debe ser válida
      if (nuevoUsuario.contrasena && nuevoUsuario.contrasena.length < 6) {
        errors.contrasena = 'La contraseña debe tener al menos 6 caracteres';
        esValido = false;
      }
    }

    // Validar organización
    if (!nuevoUsuario.organizacionId) {
      errors.organizacionId = 'Debe seleccionar una organización';
      esValido = false;
    }

    // Validar rol
    if (!nuevoUsuario.rolId) {
      errors.rolId = 'Debe seleccionar un rol';
      esValido = false;
    }

    // Validar teléfono (opcional pero si se proporciona debe ser válido)
    if (nuevoUsuario.numero_tel.trim()) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(nuevoUsuario.numero_tel.replace(/\s/g, ''))) {
        errors.numero_tel = 'El teléfono debe tener 10 dígitos';
        esValido = false;
      }
    }

    return esValido;
  }

  // Crear o actualizar usuario
  async function crearUsuario() {
    if (!validarFormulario()) {
      return;
    }

    loading = true;
    try {
      const datosUsuario = {
        ...nuevoUsuario,
        usuarioCreadorId: usuarioActualId,
        usuarioEditorId: usuarioActualId
      };

      let response;
      let mensajeExito;

      if (editingUser) {
        // Modo edición - PUT
        response = await authFetch(`/api/usuarios/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(datosUsuario)
        });
        mensajeExito = 'Usuario actualizado exitosamente';
      } else {
        // Modo creación - POST
        response = await authFetch('/api/usuarios', {
          method: 'POST',
          body: JSON.stringify(datosUsuario)
        });
        mensajeExito = 'Usuario creado exitosamente';
      }

      const result = await response.json();

      if (response.ok && result.success) {
        // Recargar lista de usuarios
        await cargarUsuarios();

        // Limpiar formulario y cerrar modal
        limpiarFormulario();
        showModal = false;

        // Mostrar notificación de éxito
        await Swal.fire({
          icon: 'success',
          title: editingUser ? '¡Usuario actualizado!' : '¡Usuario creado!',
          text: result.message || mensajeExito,
          confirmButtonColor: '#2563eb',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: editingUser ? 'Error al actualizar usuario' : 'Error al crear usuario',
          text: result.message || result.error || 'Ocurrió un error desconocido',
          confirmButtonColor: '#2563eb'
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar con el servidor. Verifique su conexión.',
        confirmButtonColor: '#2563eb'
      });
    } finally {
      loading = false;
    }
  }

  // Limpiar formulario
  function limpiarFormulario() {
    nuevoUsuario = {
      correo: '',
      contrasena: '',
      numero_tel: '',
      Nombre: '',
      Apellido: '',
      activo: 1,
      organizacionId: '',
      rolId: ''
    };
    errors = {
      correo: '',
      contrasena: '',
      numero_tel: '',
      Nombre: '',
      Apellido: '',
      organizacionId: '',
      rolId: ''
    };
    showPassword = false;
  }

  // Filtrar usuarios
  $: usuariosFiltrados = usuarios.filter(usuario =>
    usuario.Nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.Apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.correo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Abrir modal para nuevo usuario
  function abrirModal() {
    editingUser = null;
    limpiarFormulario();
    showModal = true;
  }

  // Abrir modal para editar usuario
  function abrirModalEditar(usuario: any) {
    editingUser = usuario;
    nuevoUsuario = {
      correo: usuario.correo,
      contrasena: '', // Dejar vacío, solo se actualiza si se ingresa algo
      numero_tel: usuario.numero_tel || '',
      Nombre: usuario.Nombre,
      Apellido: usuario.Apellido,
      activo: usuario.activo,
      organizacionId: usuario.organizacionId || organizaciones[0]?.id || '',
      rolId: usuario.rolId || ''
    };
    showModal = true;
  }

  // Cerrar modal
  function cerrarModal() {
    showModal = false;
    editingUser = null;
    limpiarFormulario();
  }

  // Toggle password visibility
  function togglePassword() {
    showPassword = !showPassword;
  }

  // Toggle estado activo
  function toggleActivo() {
    nuevoUsuario.activo = nuevoUsuario.activo === 1 ? 0 : 1;
  }

  // Eliminar usuario
  async function eliminarUsuario(usuario: any) {
    const result = await Swal.fire({
      title: '¿Eliminar usuario?',
      html: `
        <p>¿Está seguro que desea eliminar al usuario:</p>
        <p class="font-bold mt-2">${usuario.Nombre} ${usuario.Apellido}</p>
        <p class="text-sm text-gray-600">${usuario.correo}</p>
        <p class="text-sm text-red-600 mt-3">Esta acción desactivará el usuario y lo desvinculará de la organización.</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    loading = true;
    try {
      const response = await authFetch(`/api/usuarios/${usuario.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Eliminar usuario de la lista local
        usuarios = usuarios.filter(u => u.id !== usuario.id);

        await Swal.fire({
          icon: 'success',
          title: 'Usuario eliminado',
          text: data.message || 'El usuario ha sido desactivado exitosamente',
          confirmButtonColor: '#2563eb',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'No se puede eliminar',
          html: data.message || data.error || 'Ocurrió un error al intentar eliminar el usuario',
          confirmButtonColor: '#2563eb'
        });
      }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar con el servidor',
        confirmButtonColor: '#2563eb'
      });
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>Gestión de Usuarios - Sistema de Cobranza</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
      <p class="text-gray-600">Administra los usuarios del sistema</p>
    </div>

    {#if esAdministrador}
      <button
        on:click={abrirModal}
        class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        <UserPlus class="w-5 h-5" />
        Nuevo Usuario
      </button>
    {:else}
      <div class="text-sm text-gray-500 italic">
        Solo los administradores pueden crear usuarios
      </div>
    {/if}
  </div>

  <!-- Filtros y búsqueda -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <div class="flex flex-col sm:flex-row gap-4">
      <!-- Búsqueda -->
      <div class="flex-1 relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Buscar usuarios por nombre, apellido o email..."
          bind:value={searchTerm}
          class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <!-- Filtros -->
      <div class="flex gap-2">
        <button class="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Filter class="w-4 h-4" />
          Filtros
        </button>
      </div>
    </div>
  </div>

  <!-- Tabla de usuarios -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-2 text-gray-600">Cargando usuarios...</span>
      </div>
    {:else if usuariosFiltrados.length === 0}
      <div class="text-center py-12">
        <UserPlus class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">No hay usuarios</h3>
        <p class="mt-1 text-sm text-gray-500">Comienza creando un nuevo usuario.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Registro</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each usuariosFiltrados as usuario}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10">
                      <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span class="text-sm font-medium text-blue-600">
                          {usuario.Nombre.charAt(0)}{usuario.Apellido.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                        {usuario.Nombre} {usuario.Apellido}
                      </div>
                      <div class="text-sm text-gray-500">{usuario.correo}</div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{usuario.numero_tel || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {usuario.rolNombre || 'Sin rol'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 text-xs font-medium rounded-full {usuario.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(usuario.fechaCreacion).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end gap-2">
                    {#if esAdministrador}
                      <button
                        on:click={() => abrirModalEditar(usuario)}
                        class="text-blue-600 hover:text-blue-900 p-1 rounded"
                        aria-label="Editar usuario {usuario.Nombre} {usuario.Apellido}"
                      >
                        <Edit2 class="w-4 h-4" />
                      </button>
                      <button
                        on:click={() => eliminarUsuario(usuario)}
                        class="text-red-600 hover:text-red-900 p-1 rounded"
                        aria-label="Eliminar usuario {usuario.Nombre} {usuario.Apellido}"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    {:else}
                      <span class="text-xs text-gray-400 italic">Sin permisos</span>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Modal para nuevo usuario -->
{#if showModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
    <div class="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <!-- Header del modal -->
      <div class="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="bg-white/20 p-2 rounded-lg">
              <UserPlus class="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-white">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <p class="text-blue-100 text-sm">Complete los campos para registrar un nuevo usuario</p>
            </div>
          </div>
          <button
            on:click={cerrarModal}
            class="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            aria-label="Cerrar modal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Formulario -->
      <form on:submit|preventDefault={crearUsuario} class="p-6">
        <div class="space-y-6">
          <!-- Sección: Información Personal -->
          <div>
            <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User class="w-4 h-4 text-blue-600" />
              Información Personal
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Nombre -->
              <div>
                <label for="nombre" class="block text-sm font-medium text-gray-700 mb-2">
                  Nombre <span class="text-red-500">*</span>
                </label>
                <input
                  id="nombre"
                  type="text"
                  bind:value={nuevoUsuario.Nombre}
                  class="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all {errors.Nombre ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
                  placeholder="Ingrese el nombre"
                />
                {#if errors.Nombre}
                  <div class="flex items-center gap-1 mt-1 text-red-600 text-sm">
                    <AlertCircle class="w-4 h-4" />
                    <span>{errors.Nombre}</span>
                  </div>
                {/if}
              </div>

              <!-- Apellido -->
              <div>
                <label for="apellido" class="block text-sm font-medium text-gray-700 mb-2">
                  Apellido <span class="text-red-500">*</span>
                </label>
                <input
                  id="apellido"
                  type="text"
                  bind:value={nuevoUsuario.Apellido}
                  class="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all {errors.Apellido ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
                  placeholder="Ingrese el apellido"
                />
                {#if errors.Apellido}
                  <div class="flex items-center gap-1 mt-1 text-red-600 text-sm">
                    <AlertCircle class="w-4 h-4" />
                    <span>{errors.Apellido}</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- Sección: Información de Contacto -->
          <div>
            <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail class="w-4 h-4 text-blue-600" />
              Información de Contacto
            </h4>
            <div class="space-y-4">
              <!-- Email -->
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                  Correo Electrónico <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail class="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    bind:value={nuevoUsuario.correo}
                    class="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all {errors.correo ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                {#if errors.correo}
                  <div class="flex items-center gap-1 mt-1 text-red-600 text-sm">
                    <AlertCircle class="w-4 h-4" />
                    <span>{errors.correo}</span>
                  </div>
                {/if}
              </div>

              <!-- Teléfono -->
              <div>
                <label for="telefono" class="block text-sm font-medium text-gray-700 mb-2">
                  Número de Teléfono
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone class="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="telefono"
                    type="tel"
                    bind:value={nuevoUsuario.numero_tel}
                    class="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all {errors.numero_tel ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
                    placeholder="5512345678"
                    maxlength="10"
                  />
                </div>
                {#if errors.numero_tel}
                  <div class="flex items-center gap-1 mt-1 text-red-600 text-sm">
                    <AlertCircle class="w-4 h-4" />
                    <span>{errors.numero_tel}</span>
                  </div>
                {:else}
                  <p class="mt-1 text-sm text-gray-500">Ingrese 10 dígitos sin espacios</p>
                {/if}
              </div>
            </div>
          </div>

          <!-- Sección: Organización y Rol -->
          <div>
            <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User class="w-4 h-4 text-blue-600" />
              Organización y Permisos
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Organización -->
              <div>
                <label for="organizacion" class="block text-sm font-medium text-gray-700 mb-2">
                  Organización <span class="text-red-500">*</span>
                </label>
                <select
                  id="organizacion"
                  bind:value={nuevoUsuario.organizacionId}
                  class="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all {errors.organizacionId ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
                >
                  <option value="">Seleccionar organización...</option>
                  {#each organizaciones as org}
                    <option value={org.id}>{org.razonSocial} ({org.rfc})</option>
                  {/each}
                </select>
                {#if errors.organizacionId}
                  <div class="flex items-center gap-1 mt-1 text-red-600 text-sm">
                    <AlertCircle class="w-4 h-4" />
                    <span>{errors.organizacionId}</span>
                  </div>
                {/if}
              </div>

              <!-- Rol -->
              <div>
                <label for="rol" class="block text-sm font-medium text-gray-700 mb-2">
                  Rol <span class="text-red-500">*</span>
                </label>
                <select
                  id="rol"
                  bind:value={nuevoUsuario.rolId}
                  class="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all {errors.rolId ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
                >
                  <option value="">Seleccionar rol...</option>
                  {#each roles as rol}
                    <option value={rol.id}>{rol.nombre}</option>
                  {/each}
                </select>
                {#if errors.rolId}
                  <div class="flex items-center gap-1 mt-1 text-red-600 text-sm">
                    <AlertCircle class="w-4 h-4" />
                    <span>{errors.rolId}</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>

          <!-- Sección: Seguridad -->
          <div>
            <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock class="w-4 h-4 text-blue-600" />
              Seguridad y Acceso
            </h4>
            <div class="space-y-4">
              <!-- Contraseña -->
              <div>
                <label for="password" class="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña {#if !editingUser}<span class="text-red-500">*</span>{/if}
                </label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock class="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    bind:value={nuevoUsuario.contrasena}
                    class="w-full pl-10 pr-12 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all {errors.contrasena ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}"
                    placeholder={editingUser ? 'Dejar en blanco para mantener la actual' : 'Ingrese una contraseña segura'}
                  />
                  <button
                    type="button"
                    on:click={togglePassword}
                    class="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-700"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {#if showPassword}
                      <EyeOff class="h-5 w-5 text-gray-400" />
                    {:else}
                      <Eye class="h-5 w-5 text-gray-400" />
                    {/if}
                  </button>
                </div>
                {#if errors.contrasena}
                  <div class="flex items-center gap-1 mt-1 text-red-600 text-sm">
                    <AlertCircle class="w-4 h-4" />
                    <span>{errors.contrasena}</span>
                  </div>
                {:else}
                  <p class="mt-1 text-sm text-gray-500">
                    {#if editingUser}
                      Dejar en blanco para no cambiar la contraseña. Mínimo 6 caracteres si desea cambiarla.
                    {:else}
                      Mínimo 6 caracteres
                    {/if}
                  </p>
                {/if}
              </div>

              <!-- Estado con Toggle Slider -->
              <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div class="flex items-center justify-between">
                  <div>
                    <label for="activo" class="block text-sm font-medium text-gray-900">
                      Estado del Usuario
                    </label>
                    <p class="text-sm text-gray-500 mt-1">
                      {nuevoUsuario.activo === 1 ? 'El usuario podrá acceder al sistema' : 'El usuario no podrá acceder al sistema'}
                    </p>
                  </div>
                  <button
                    type="button"
                    on:click={toggleActivo}
                    class="relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 {nuevoUsuario.activo === 1 ? 'bg-blue-600' : 'bg-gray-300'}"
                    role="switch"
                    aria-checked={nuevoUsuario.activo === 1}
                    aria-label="Cambiar estado del usuario"
                  >
                    <span
                      class="pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {nuevoUsuario.activo === 1 ? 'translate-x-6' : 'translate-x-0'}"
                    ></span>
                  </button>
                </div>
                <div class="mt-2">
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {nuevoUsuario.activo === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    {nuevoUsuario.activo === 1 ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Botones -->
        <div class="flex justify-end gap-3 pt-6 border-t mt-6">
          <button
            type="button"
            on:click={cerrarModal}
            class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            class="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {#if loading}
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {editingUser ? 'Actualizando...' : 'Creando...'}
            {:else}
              <UserPlus class="w-4 h-4" />
              {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}