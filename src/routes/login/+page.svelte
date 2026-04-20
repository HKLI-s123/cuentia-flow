<script lang="ts">
  import { goto } from '$app/navigation';
  import { loginExterno, loginConGoogle } from '$lib/auth';
  import { dev } from '$app/environment';
  import { onMount, onDestroy } from 'svelte';
  import { PasswordInput } from '$lib/components/ui';

  // Importar el Site Key de reCAPTCHA (público, seguro de importar)
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v';

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  /**
   * Intenta obtener un token de reCAPTCHA v3
   * Espera hasta 5 segundos a que grecaptcha esté disponible
   */
  const getRecaptchaToken = async (action: string = 'login'): Promise<string> => {
    // Esperar a que grecaptcha esté disponible (máximo 5 segundos)
    let attempts = 0;
    while (!window.grecaptcha && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.grecaptcha) {
      console.warn('[LOGIN FORM] reCAPTCHA no disponible después de esperar');
      return ''; // Continuar sin token si no está disponible
    }

    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
      return token;
    } catch (error) {
      console.error('[LOGIN FORM] Error obteniendo reCAPTCHA token:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      // Obtener token de reCAPTCHA v3
      const recaptchaToken = await getRecaptchaToken('login');
      await loginExterno(email, password, recaptchaToken);

      // Redirigimos al dashboard
      await goto('/dashboard');
    } catch (err: any) {
      console.error('[LOGIN FORM] Error:', err);
      error = err.message || 'No se pudo conectar con el servidor';
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    if (typeof window !== 'undefined' && window.grecaptcha && RECAPTCHA_SITE_KEY) {
      window.grecaptcha.ready(() => {
      });
    } else {
      console.warn('[LOGIN FORM] grecaptcha no está disponible en onMount');
    }
  });

  onDestroy(() => {
    if (typeof window === 'undefined') return;
    // Ocultar el badge de reCAPTCHA
    const badge = document.querySelector('.grecaptcha-badge') as HTMLElement;
    if (badge) badge.style.visibility = 'hidden';
    // Remover scripts e iframes inyectados por reCAPTCHA
    document.querySelectorAll('script[src*="recaptcha"]').forEach(el => el.remove());
    document.querySelectorAll('iframe[src*="recaptcha"]').forEach(el => el.remove());
    // Limpiar el objeto global
    if (window.grecaptcha) {
      delete (window as any).grecaptcha;
      delete (window as any).___grecaptcha_cfg;
    }
  });
</script>

<svelte:head>
  <script src="https://www.google.com/recaptcha/api.js?render=6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v" async defer></script>
</svelte:head>

<div class="flex min-h-screen">
  <!-- Lado izquierdo con branding -->
  <div class="hidden lg:flex w-1/2 bg-indigo-900 text-white flex-col justify-center items-center p-12">
    <img src="/logo-cuentia-flow-lg.webp" alt="CuentIA Flow" class="w-[30rem]" width="960" height="640" />
  </div>

  <!-- Lado derecho con login -->
  <div class="flex w-full lg:w-1/2 justify-center items-center bg-gray-50">
    <div class="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md">
      <h1 class="text-3xl font-bold mb-6 text-center text-gray-800">Entrar a mi cuenta</h1>

      {#if error}
        <p class="text-red-600 text-center mb-4">{error}</p>
        <div class="text-center mt-2">
          <a href="/verify-email/resend" class="text-sm text-indigo-600 hover:underline">¿No recibiste el correo de verificación?</a>
        </div>
      {/if}

      <form on:submit|preventDefault={handleSubmit} class="space-y-5">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input 
            id="email"
            type="email" 
            bind:value={email}
            placeholder="ejemplo@correo.com"
            class="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            required
          />
        </div>

        <div>
          <PasswordInput
            id="password"
            label="Contraseña"
            bind:value={password}
            placeholder="••••••••"
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

      <!-- Separador -->
      <div class="flex items-center my-6">
        <div class="flex-1 border-t border-gray-300"></div>
        <span class="px-3 text-gray-500 text-sm">O continúa con</span>
        <div class="flex-1 border-t border-gray-300"></div>
      </div>

      <!-- Botón Google -->
      <button 
        type="button"
        on:click={loginConGoogle}
        class="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuar con Google
      </button>

      <!-- Link al Registro -->
      <div class="mt-6 text-center">
        <p class="text-gray-600 text-sm">
          ¿No tienes cuenta?{' '}
          <a href="/register" class="text-indigo-600 hover:underline font-semibold">Regístrate aquí</a>
        </p>
      </div>
    </div>
  </div>
</div>