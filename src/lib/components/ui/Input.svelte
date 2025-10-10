<script lang="ts">
  export let type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' = 'text';
  export let value: string | number = '';
  export let placeholder = '';
  export let disabled = false;
  export let error = '';
  export let label = '';
  export let id = '';
  export let required = false;
  export let autocomplete = '';

  // Clases base
  const baseClasses = 'w-full px-3 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed';

  // Variantes según estado
  $: stateClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';

  $: classes = [baseClasses, stateClasses].join(' ');
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

  <input
    {type}
    {id}
    {placeholder}
    {disabled}
    {required}
    {autocomplete}
    bind:value
    class={classes}
    on:input
    on:change
    on:blur
    on:focus
    on:keydown
    on:keyup
    {...$$restProps}
  />

  {#if error}
    <p class="mt-1 text-sm text-red-600">{error}</p>
  {/if}
</div>
