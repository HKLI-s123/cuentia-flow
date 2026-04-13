<script lang="ts">
  import { Eye, EyeOff } from 'lucide-svelte';

  export let value: string = '';
  export let placeholder = '••••••••';
  export let disabled = false;
  export let error = '';
  export let label = '';
  export let id = '';
  export let required = false;
  export let maxlength: number | undefined = undefined;

  let showPassword = false;

  // Clases base
  const baseClasses = 'w-full px-3 py-2.5 pr-10 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed';

  // Variantes según estado
  $: stateClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';

  $: classes = [baseClasses, stateClasses].join(' ');

  function togglePassword() {
    showPassword = !showPassword;
  }
</script>

<div class="w-full">
  {#if label}
    <label for={id} class="block text-sm font-medium text-gray-700 mb-2">
      {label}
      {#if required}
        <span class="text-red-500">*</span>
      {/if}
    </label>
  {/if}

  <div class="relative">
    <input
      {id}
      type={showPassword ? 'text' : 'password'}
      bind:value
      {placeholder}
      {disabled}
      {required}
      {maxlength}
      on:change
      on:input
      on:blur
      on:focus
      class={classes}
      aria-describedby={error ? `${id}-error` : undefined}
    />

    <button
      type="button"
      on:click={togglePassword}
      class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
      disabled={disabled}
      tabindex="-1"
      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={showPassword}
    >
      {#if showPassword}
        <EyeOff class="h-5 w-5" />
      {:else}
        <Eye class="h-5 w-5" />
      {/if}
    </button>
  </div>

  {#if error}
    <p id="{id}-error" class="mt-1 text-sm text-red-600">{error}</p>
  {/if}
</div>
