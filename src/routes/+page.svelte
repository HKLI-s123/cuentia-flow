<script lang="ts">
  import { goto } from '$app/navigation';
  import { loginExterno } from '$lib/auth';

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await loginExterno(email, password);

      // Redirigimos al dashboard
      goto('/dashboard');

    } catch (err: any) {
      error = err.message || 'No se pudo conectar con el servidor';
    } finally {
      loading = false;
    }
  };
</script>

<div class="flex min-h-screen">
  <!-- Lado izquierdo con branding -->
  <div class="hidden lg:flex w-1/2 bg-indigo-900 text-white flex-col justify-center items-center p-12">
    <img src="/blanco-01.png" alt="Logo Consultores y asesores MMendoza" class="w-80 mb-1" />
  </div>

  <!-- Lado derecho con login -->
  <div class="flex w-full lg:w-1/2 justify-center items-center bg-gray-50">
    <div class="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md">
      <h1 class="text-3xl font-bold mb-6 text-center text-gray-800">Entrar a mi cuenta</h1>

      {#if error}
        <p class="text-red-600 text-center mb-4">{error}</p>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-5">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input 
            id="email"
            type="email" 
            bind:value={email}
            placeholder="ejemplo@correo.com"
            class="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
          <input 
            id="password"
            type="password" 
            bind:value={password}
            placeholder="********"
            class="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
          <div class="text-center mt-2">
            <a href="/recuperar" class="text-sm text-indigo-600 hover:underline">Olvidé mi contraseña</a>
          </div>
        </div>

        <button 
          type="submit"
          class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          disabled={loading}
        >
          {loading ? 'Ingresando...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  </div>
</div>