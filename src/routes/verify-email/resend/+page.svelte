<script lang="ts">
import { onMount } from 'svelte';

let email = '';
let error = '';
let success = false;
let csrfToken = '';
let loading = false;
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v';
let recaptchaReady = false;

onMount(() => {
	getCsrfToken();
	if (typeof window !== 'undefined' && window.grecaptcha && RECAPTCHA_SITE_KEY) {
		window.grecaptcha.ready(() => {
			recaptchaReady = true;
		});
	}
});

async function getRecaptchaToken(action = 'resend_verify_email') {
	let attempts = 0;
	while (!window.grecaptcha && attempts < 50) {
		await new Promise(resolve => setTimeout(resolve, 100));
		attempts++;
	}
	if (!window.grecaptcha) {
		console.warn('[RESEND VERIFY EMAIL] reCAPTCHA no disponible después de esperar');
		return '';
	}
	try {
		return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
	} catch (error) {
		console.error('[RESEND VERIFY EMAIL] Error obteniendo reCAPTCHA token:', error);
		return '';
	}
}

async function getCsrfToken() {
   try {
	   const res = await fetch('/api/auth/csrf', { method: 'GET', credentials: 'include' });
	   const data = await res.json();
	   csrfToken = data.csrf_token || '';
   } catch {
	   error = 'No se pudo obtener el token CSRF';
   }
}

onMount(() => {
  getCsrfToken();
});
async function submit() {
	error = '';
	success = false;
	if (!email) {
		error = 'Por favor ingresa tu correo electrónico.';
		return;
	}
	// Obtener el token CSRF directamente de la cookie
	const cookieToken = document.cookie
		.split('; ')
		.find(row => row.startsWith('csrf_token='))
		?.split('=')[1] || '';
	if (!cookieToken) {
		error = 'No se pudo validar tu sesión. Recarga la página e inténtalo de nuevo.';
		return;
	}
	const recaptchaToken = await getRecaptchaToken();
	if (!recaptchaToken) {
		error = 'No se pudo validar que eres una persona. Recarga la página e inténtalo de nuevo.';
		return;
	}
	const res = await fetch('/api/auth/verify-email/resend', {
		method: 'POST',
		body: JSON.stringify({ email, recaptchaToken }),
		headers: {
			'Content-Type': 'application/json',
			'X-CSRF-Token': cookieToken
		},
		credentials: 'include'
	});
	const data = await res.json();
	if (data.success) {
		success = true;
	} else if (data.error && data.error.includes('no existe')) {
		error = 'No encontramos una cuenta con ese correo. ¿Está bien escrito?';
	} else if (data.error && data.error.includes('verificado')) {
		error = 'Tu correo ya está verificado. Inicia sesión.';
	} else if (data.error && data.error.includes('Demasiados intentos')) {
		error = 'Has realizado demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.';

	} else {
		error = data.error || 'No se pudo reenviar el correo. Intenta nuevamente.';
	}
}
</script>
<svelte:head>
	<script src="https://www.google.com/recaptcha/api.js?render=6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v" async defer></script>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
	<div class="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
		<div class="flex flex-col items-center mb-6">
			<img src="/logotipo3.webp" alt="CuentIA Flow" class="w-32 mb-2" width="120" height="80" />
			<h2 class="text-2xl font-bold text-indigo-900 mb-2">Reenviar correo de verificación</h2>
			<p class="text-gray-600 text-sm mb-4">Ingresa tu correo para recibir nuevamente el enlace de verificación.</p>
		</div>
		{#if success}
			<p class="text-green-600 text-center font-semibold">Correo enviado. Revisa tu bandeja de entrada.</p>
		{:else}
			<form on:submit|preventDefault={submit}>
				<input type="email" placeholder="Correo electrónico" bind:value={email} class="mb-3 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-800" />
				{#if error}
					<p class="text-red-600 text-center mb-2">{error}</p>
				{/if}
				<button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition" disabled={loading}>{loading ? 'Enviando...' : 'Reenviar correo'}</button>
			</form>
		{/if}
		<div class="mt-6 text-center">
			<a href="/login" class="text-indigo-600 hover:underline text-sm">Volver al inicio de sesión</a>
		</div>
	</div>
</div>
