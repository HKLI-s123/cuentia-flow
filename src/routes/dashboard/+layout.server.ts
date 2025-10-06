// routes/dashboard/+layout.ts
import { onMount } from 'svelte';
import { goto } from '$app/navigation';

onMount(() => {
  const token = sessionStorage.getItem('jwt');
  if (!token) {
    goto('/'); // redirige al login si no hay token
  }
});