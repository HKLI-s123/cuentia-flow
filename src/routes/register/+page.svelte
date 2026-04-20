<script lang="ts">
import { goto } from '$app/navigation';
import { registroExterno } from '$lib/auth';
import { onDestroy } from 'svelte';
import { PasswordInput } from '$lib/components/ui';
import Swal from 'sweetalert2';

onDestroy(() => {
  if (typeof window === 'undefined') return;
  const badge = document.querySelector('.grecaptcha-badge') as HTMLElement;
  if (badge) badge.style.visibility = 'hidden';
  document.querySelectorAll('script[src*="recaptcha"]').forEach(el => el.remove());
  document.querySelectorAll('iframe[src*="recaptcha"]').forEach(el => el.remove());
  if (window.grecaptcha) {
    delete (window as any).grecaptcha;
    delete (window as any).___grecaptcha_cfg;
  }
});
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v';

let formData = {
  nombre: '',
  apellido: '',
  correo: '',
  contrasena: '',
  contrasena_confirm: '',
  numero_tel: ''
};
let error = '';
let success = '';
let loading = false;
let acceptTerms = false;

const passwordRequirements = {
  minLength: false,
  hasUppercase: false,
  hasLowercase: false,
  hasNumber: false,
  hasSymbol: false
};

const validatePassword = (password: string) => {
  passwordRequirements.minLength = password.length >= 10;
  passwordRequirements.hasUppercase = /[A-Z]/.test(password);
  passwordRequirements.hasLowercase = /[a-z]/.test(password);
  passwordRequirements.hasNumber = /[0-9]/.test(password);
  passwordRequirements.hasSymbol = /[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]/.test(password);
};

const handlePasswordChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  formData.contrasena = target.value;
  validatePassword(formData.contrasena);
};

const isPasswordValid = () => {
  return Object.values(passwordRequirements).every(req => req);
};

const getRecaptchaToken = async (action: string = 'register'): Promise<string> => {
  let attempts = 0;
  while (!window.grecaptcha && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  if (!window.grecaptcha) {
    console.warn('[REGISTER FORM] reCAPTCHA no disponible después de esperar');
    return '';
  }
  try {
    const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    return token;
  } catch (error) {
    console.error('[REGISTER FORM] Error obteniendo reCAPTCHA token:', error);
    throw error;
  }
};


function isFormValid() {
  return (
    formData.nombre.trim() &&
    formData.apellido.trim() &&
    formData.correo.includes('@') &&
    isPasswordValid() &&
    formData.contrasena === formData.contrasena_confirm &&
    acceptTerms
  );
}

async function handleRegister(e: Event) {
  e.preventDefault();
  error = '';
  success = '';
  if (!formData.nombre.trim()) {
    error = 'El nombre es requerido';
    return;
  }
  if (!formData.apellido.trim()) {
    error = 'El apellido es requerido';
    return;
  }
  if (!formData.correo.includes('@')) {
    error = 'Email inválido';
    return;
  }
  if (!isPasswordValid()) {
    error = 'La contraseña no cumple con los requisitos';
    return;
  }
  if (formData.contrasena !== formData.contrasena_confirm) {
    error = 'Las contraseñas no coinciden';
    return;
  }
  if (!acceptTerms) {
    error = 'Debes aceptar los términos y condiciones.';
    return;
  }
  loading = true;
  try {
    const recaptchaToken = await getRecaptchaToken('register');
    const result = await registroExterno(
      formData.correo,
      formData.contrasena,
      formData.nombre,
      formData.apellido,
      formData.numero_tel,
      recaptchaToken
    );
    success = result.message || 'Cuenta creada exitosamente.';
    formData = {
      nombre: '',
      apellido: '',
      correo: '',
      contrasena: '',
      contrasena_confirm: '',
      numero_tel: ''
    };
    await Swal.fire({
      icon: 'success',
      title: '¡Cuenta creada!',
      html: '<p style="font-size:15px; color:#374151;">Hemos enviado un correo de verificación a tu email.</p><p style="font-size:14px; color:#6b7280; margin-top:8px;">Revisa tu bandeja de entrada (y spam) para activar tu cuenta.</p>',
      confirmButtonText: 'Ir a iniciar sesión',
      confirmButtonColor: '#4f46e5',
      allowOutsideClick: false
    });
    goto('/login');
  } catch (err: any) {
    if (err.message && err.message.includes('ya está registrado')) {
      error = 'El correo electrónico ya está registrado. Si ya tienes cuenta, inicia sesión o recupera tu contraseña.';
    } else if (err.message && err.message.includes('reCAPTCHA')) {
      error = 'No pudimos validar que eres una persona. Por favor, recarga la página e inténtalo de nuevo.';
    } else if (err.message && err.message.includes('Verificación de seguridad fallida')) {
      error = 'No pudimos validar tu registro por motivos de seguridad. Intenta nuevamente.';
    } else if (err.message && err.message.includes('Demasiados intentos')) {
      error = 'Has realizado demasiados intentos de registro. Espera unos minutos antes de volver a intentarlo.';
    } else if (err.message && err.message.includes('Error al registrar el usuario')) {
      error = 'Ocurrió un error inesperado al registrar tu cuenta. Intenta nuevamente más tarde.';
    } else {
      error = err.message || 'No se pudo conectar con el servidor. Intenta más tarde.';
    }
  } finally {
    loading = false;
  }
}

// End of script
</script>
<svelte:head>
  <script src="https://www.google.com/recaptcha/api.js?render=6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v" async defer></script>
</svelte:head>

<div class="flex min-h-screen">
  <!-- Lado izquierdo con branding -->
  <div class="hidden lg:flex w-1/2 bg-indigo-900 text-white flex-col justify-center items-center p-12">
    <img src="/logo-cuentia-flow-lg.webp" alt="CuentIA Flow" class="w-[30rem]" width="960" height="640" />
  </div>

  <!-- Lado derecho con registro -->
  <div class="flex w-full lg:w-1/2 justify-center items-center bg-gray-50 p-4">
    <div class="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
      <h1 class="text-3xl font-bold mb-2 text-center text-gray-800">Crear cuenta</h1>
      <p class="text-center text-gray-600 text-sm mb-6">Completa el formulario para registrarte</p>

      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      {/if}

      {#if success}
        <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {success}
        </div>
      {/if}

      <form on:submit={handleRegister} class="space-y-5">
        <!-- Nombre -->
        <div>
          <label for="nombre" class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input 
            id="nombre"
            type="text" 
            bind:value={formData.nombre}
            placeholder="Juan"
            class="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            required
          />
        </div>

        <!-- Apellido -->
        <div>
          <label for="apellido" class="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
          <input 
            id="apellido"
            type="text" 
            bind:value={formData.apellido}
            placeholder="Pérez"
            class="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            required
          />
        </div>

        <!-- Email -->
        <div>
          <label for="correo" class="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input 
            id="correo"
            type="email" 
            bind:value={formData.correo}
            placeholder="tu@correo.com"
            class="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            required
          />
        </div>

        <!-- Teléfono (Opcional) -->
        <div>
          <label for="numero_tel" class="block text-sm font-medium text-gray-700 mb-1">Teléfono (opcional)</label>
          <input 
            id="numero_tel"
            type="tel" 
            bind:value={formData.numero_tel}
            placeholder="+56 9 1234 5678"
            class="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>

        <!-- Contraseña -->
        <PasswordInput
          id="contrasena"
          label="Contraseña"
          bind:value={formData.contrasena}
          on:input={handlePasswordChange}
          placeholder="Mín. 10 caracteres"
          required
        />

        <!-- Requisitos de Contraseña -->
        <div class="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p class="text-xs font-semibold text-gray-700 mb-2">Requisitos:</p>
          <ul class="space-y-1 text-xs">
            <li class="flex items-center gap-2" class:text-green-600={passwordRequirements.minLength} class:text-gray-400={!passwordRequirements.minLength}>
              <span class="w-4 h-4 flex items-center justify-center rounded-full" class:bg-green-100={passwordRequirements.minLength} class:bg-gray-100={!passwordRequirements.minLength}>
                {#if passwordRequirements.minLength}✓{/if}
              </span>
              Mínimo 10 caracteres
            </li>
            <li class="flex items-center gap-2" class:text-green-600={passwordRequirements.hasUppercase} class:text-gray-400={!passwordRequirements.hasUppercase}>
              <span class="w-4 h-4 flex items-center justify-center rounded-full" class:bg-green-100={passwordRequirements.hasUppercase} class:bg-gray-100={!passwordRequirements.hasUppercase}>
                {#if passwordRequirements.hasUppercase}✓{/if}
              </span>
              Una mayúscula (A-Z)
            </li>
            <li class="flex items-center gap-2" class:text-green-600={passwordRequirements.hasLowercase} class:text-gray-400={!passwordRequirements.hasLowercase}>
              <span class="w-4 h-4 flex items-center justify-center rounded-full" class:bg-green-100={passwordRequirements.hasLowercase} class:bg-gray-100={!passwordRequirements.hasLowercase}>
                {#if passwordRequirements.hasLowercase}✓{/if}
              </span>
              Una minúscula (a-z)
            </li>
            <li class="flex items-center gap-2" class:text-green-600={passwordRequirements.hasNumber} class:text-gray-400={!passwordRequirements.hasNumber}>
              <span class="w-4 h-4 flex items-center justify-center rounded-full" class:bg-green-100={passwordRequirements.hasNumber} class:bg-gray-100={!passwordRequirements.hasNumber}>
                {#if passwordRequirements.hasNumber}✓{/if}
              </span>
              Un número (0-9)
            </li>
            <li class="flex items-center gap-2" class:text-green-600={passwordRequirements.hasSymbol} class:text-gray-400={!passwordRequirements.hasSymbol}>
              <span class="w-4 h-4 flex items-center justify-center rounded-full" class:bg-green-100={passwordRequirements.hasSymbol} class:bg-gray-100={!passwordRequirements.hasSymbol}>
                {#if passwordRequirements.hasSymbol}✓{/if}
              </span>
              Un símbolo (!@#$%^&*)
            </li>
          </ul>
        </div>

        <!-- Confirmar Contraseña -->
        <PasswordInput
          id="contrasena_confirm"
          label="Confirmar contraseña"
          bind:value={formData.contrasena_confirm}
          placeholder="Repite tu contraseña"
          required
        />
        {#if formData.contrasena_confirm && formData.contrasena !== formData.contrasena_confirm}
          <p class="text-red-600 text-xs mt-1">Las contraseñas no coinciden</p>
        {/if}

        <!-- Aceptar Términos y Condiciones -->
        <div class="flex items-center">
          <input type="checkbox" id="terms" bind:checked={acceptTerms} class="mr-2" />
          <label for="terms" class="text-sm text-gray-700">Acepto los <a href="/terminos" target="_blank" class="text-indigo-600 hover:underline">términos y condiciones</a></label>
        </div>

        <!-- Botón Registrar -->
        <button 
          type="submit"
          disabled={loading || !isFormValid()}
          class="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed mt-6"
        >
          {loading ? 'Registrando...' : 'Registrarse'}
        </button>
      </form>

      <!-- Link al Login -->
      <div class="mt-6 text-center">
        <p class="text-gray-600 text-sm">
          ¿Ya tienes cuenta?{' '}
          <a href="/login" class="text-indigo-600 hover:underline font-semibold">Inicia sesión aquí</a>
        </p>
      </div>
      <!-- Nota sobre restricciones
      <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <p class="font-semibold mb-1">Información importante:</p>
        <p>Tu cuenta deberá ser verificada por un administrador antes de poder acceder al sistema.</p>
      </div>
       -->
    </div>
  </div>
</div>
