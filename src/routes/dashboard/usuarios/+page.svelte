<script lang="ts">
  import { onMount } from 'svelte';
  import { UserPlus, Search, Edit2, Trash2, Eye, EyeOff, Mail, Phone, Lock, User, AlertCircle } from "lucide-svelte";
  import { authFetch } from '$lib/api';
  import Swal from 'sweetalert2';

  // Importar componentes estandarizados
  import { Button, Badge, Input, Modal } from '$lib/components/ui';

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

      const response = await authFetch(`/api/usuario/${user.id}/organizacion`);
      if (response.ok) {
        const data = await response.json();
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

    if (!nuevoUsuario.Nombre.trim()) {
      errors.Nombre = 'El nombre es obligatorio';
      esValido = false;
    } else if (nuevoUsuario.Nombre.trim().length < 2) {
      errors.Nombre = 'El nombre debe tener al menos 2 caracteres';
      esValido = false;
    }

    if (!nuevoUsuario.Apellido.trim()) {
      errors.Apellido = 'El apellido es obligatorio';
      esValido = false;
    } else if (nuevoUsuario.Apellido.trim().length < 2) {
      errors.Apellido = 'El apellido debe tener al menos 2 caracteres';
      esValido = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!nuevoUsuario.correo.trim()) {
      errors.correo = 'El correo electrónico es obligatorio';
      esValido = false;
    } else if (!emailRegex.test(nuevoUsuario.correo)) {
      errors.correo = 'El correo electrónico no es válido';
      esValido = false;
    }

    if (!editingUser) {
      if (!nuevoUsuario.contrasena) {
        errors.contrasena = 'La contraseña es obligatoria';
        esValido = false;
      } else if (nuevoUsuario.contrasena.length < 6) {
        errors.contrasena = 'La contraseña debe tener al menos 6 caracteres';
        esValido = false;
      }
    } else {
      if (nuevoUsuario.contrasena && nuevoUsuario.contrasena.length < 6) {
        errors.contrasena = 'La contraseña debe tener al menos 6 caracteres';
        esValido = false;
      }
    }

    if (!nuevoUsuario.organizacionId) {
      errors.organizacionId = 'Debe seleccionar una organización';
      esValido = false;
    }

    if (!nuevoUsuario.rolId) {
      errors.rolId = 'Debe seleccionar un rol';
      esValido = false;
    }

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
        response = await authFetch(`/api/usuarios/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(datosUsuario)
        });
        mensajeExito = 'Usuario actualizado exitosamente';
      } else {
        response = await authFetch('/api/usuarios', {
          method: 'POST',
          body: JSON.stringify(datosUsuario)
        });
        mensajeExito = 'Usuario creado exitosamente';
      }

      const result = await response.json();

      if (response.ok && result.success) {
        await cargarUsuarios();
        limpiarFormulario();
        showModal = false;

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
      contrasena: '',
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
      <p class="text-gray-600">Administra los usuarios del sistema</p>
    </div>

    {#if esAdministrador}
      <Button variant="primary" on:click={abrirModal}>
        <UserPlus class="w-5 h-5" />
        Nuevo Usuario
      </Button>
    {:else}
      <div class="text-sm text-gray-500 italic">
        Solo los administradores pueden crear usuarios
      </div>
    {/if}
  </div>

  <!-- Búsqueda -->
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
      <input
        type="text"
        placeholder="Buscar usuarios por nombre, apellido o email..."
        bind:value={searchTerm}
        class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
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
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Usuario</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Contacto</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Rol</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Estado</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Fecha Registro</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Acciones</th>
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
                  <Badge variant="info">{usuario.rolNombre || 'Sin rol'}</Badge>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <Badge variant={usuario.activo ? 'success' : 'danger'}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
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

<!-- Modal para nuevo/editar usuario -->
<Modal
  bind:open={showModal}
  title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
  size="lg"
  on:close={cerrarModal}
>
  <svelte:fragment slot="header-icon">
    <UserPlus class="w-6 h-6 text-blue-600" />
  </svelte:fragment>

  <!-- Formulario -->
  <form on:submit|preventDefault={crearUsuario} class="space-y-6">
    <!-- Sección: Información Personal -->
    <div>
      <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <User class="w-4 h-4 text-blue-600" />
        Información Personal
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre"
          type="text"
          bind:value={nuevoUsuario.Nombre}
          error={errors.Nombre}
          placeholder="Ingrese el nombre"
          required
        />

        <Input
          label="Apellido"
          type="text"
          bind:value={nuevoUsuario.Apellido}
          error={errors.Apellido}
          placeholder="Ingrese el apellido"
          required
        />
      </div>
    </div>

    <!-- Sección: Información de Contacto -->
    <div>
      <h4 class="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Mail class="w-4 h-4 text-blue-600" />
        Información de Contacto
      </h4>
      <div class="space-y-4">
        <Input
          label="Correo Electrónico"
          type="email"
          bind:value={nuevoUsuario.correo}
          error={errors.correo}
          placeholder="usuario@ejemplo.com"
          required
        />

        <Input
          label="Número de Teléfono"
          type="tel"
          bind:value={nuevoUsuario.numero_tel}
          error={errors.numero_tel}
          placeholder="5512345678"
        />
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
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {errors.organizacionId ? 'border-red-300' : 'border-gray-300'}"
          >
            <option value="">Seleccionar organización...</option>
            {#each organizaciones as org}
              <option value={org.id}>{org.razonSocial} ({org.rfc})</option>
            {/each}
          </select>
          {#if errors.organizacionId}
            <p class="mt-1 text-sm text-red-600">{errors.organizacionId}</p>
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
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {errors.rolId ? 'border-red-300' : 'border-gray-300'}"
          >
            <option value="">Seleccionar rol...</option>
            {#each roles as rol}
              <option value={rol.id}>{rol.nombre}</option>
            {/each}
          </select>
          {#if errors.rolId}
            <p class="mt-1 text-sm text-red-600">{errors.rolId}</p>
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
            <Lock class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              bind:value={nuevoUsuario.contrasena}
              class="w-full pl-10 pr-12 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {errors.contrasena ? 'border-red-300' : 'border-gray-300'}"
              placeholder={editingUser ? 'Dejar en blanco para mantener la actual' : 'Ingrese una contraseña segura'}
            />
            <button
              type="button"
              on:click={togglePassword}
              class="absolute right-3 top-1/2 transform -translate-y-1/2 hover:text-gray-700"
            >
              {#if showPassword}
                <EyeOff class="h-5 w-5 text-gray-400" />
              {:else}
                <Eye class="h-5 w-5 text-gray-400" />
              {/if}
            </button>
          </div>
          {#if errors.contrasena}
            <p class="mt-1 text-sm text-red-600">{errors.contrasena}</p>
          {/if}
        </div>

        <!-- Estado con Toggle -->
        <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div class="flex items-center justify-between">
            <div>
              <label class="block text-sm font-medium text-gray-900">
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
            >
              <span
                class="pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {nuevoUsuario.activo === 1 ? 'translate-x-6' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
          <div class="mt-2">
            <Badge variant={nuevoUsuario.activo === 1 ? 'success' : 'danger'}>
              {nuevoUsuario.activo === 1 ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  </form>

  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-3">
      <Button variant="secondary" on:click={cerrarModal}>
        Cancelar
      </Button>
      <Button variant="primary" on:click={crearUsuario} loading={loading}>
        <UserPlus class="w-4 h-4" />
        {editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>
