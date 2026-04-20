<script lang="ts">
import { onMount } from 'svelte';

let email = '';
let error = '';
let success = false;
let csrfToken = '';
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v';
let recaptchaReady = false;

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
	if (typeof window !== 'undefined' && window.grecaptcha && RECAPTCHA_SITE_KEY) {
		window.grecaptcha.ready(() => {
			recaptchaReady = true;
		});
	}
});

async function getRecaptchaToken(action = 'password_reset_request') {
	let attempts = 0;
	while (!window.grecaptcha && attempts < 50) {
		await new Promise(resolve => setTimeout(resolve, 100));
		attempts++;
	}
	if (!window.grecaptcha) {
		console.warn('[PW RESET REQUEST] reCAPTCHA no disponible después de esperar');
		return '';
	}
	try {
		return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
	} catch (error) {
		console.error('[PW RESET REQUEST] Error obteniendo reCAPTCHA token:', error);
		return '';
	}
}
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
	const res = await fetch('/api/auth/password-reset/request', {
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
	} else if (data.error && data.error.includes('Demasiados intentos')) {
		error = 'Has realizado demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.';

	} else {
		error = data.error || 'No se pudo enviar el correo. Intenta nuevamente.';
	}
}
</script>
<svelte:head>
	<script src="https://www.google.com/recaptcha/api.js?render=6LcNcMAsAAAAANh3YnPjv_UGhYQtDQZGcwd-9v6v" async defer></script>
</svelte:head>

{#if success}
	<p class="text-green-600">Email enviado. Revisa tu bandeja de entrada.</p>
{:else}
	<form on:submit|preventDefault={submit} class="max-w-md mx-auto mt-8 p-4 border rounded">
		<h2 class="text-xl mb-4">Solicitar recuperación de contraseña</h2>
		<input type="email" placeholder="Email" bind:value={email} class="mb-2 w-full p-2 border rounded" />
		{#if error}
			<p class="text-red-600">{error}</p>
		{/if}
		<button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">Enviar</button>
	</form>
{/if}
