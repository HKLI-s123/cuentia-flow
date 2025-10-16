<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X } from 'lucide-svelte';

  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
  export let showCloseButton = true;
  export let closeOnOverlayClick = true;

  const dispatch = createEventDispatcher();

  // Tamaños del modal
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full mx-4'
  };

  function close() {
    dispatch('close');
  }

  function handleOverlayClick() {
    if (closeOnOverlayClick) {
      close();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn"
    on:click={handleOverlayClick}
    on:keydown={(e) => e.key === 'Enter' && handleOverlayClick()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-white rounded-lg shadow-xl w-full {sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-200">
        <div class="flex items-center gap-3 flex-1">
          <slot name="header-icon" />
          <h2 id="modal-title" class="text-xl font-semibold text-gray-900">
            {title}
          </h2>
        </div>

        <slot name="header-actions" />

        {#if showCloseButton}
          <button
            on:click={close}
            class="text-gray-400 hover:text-gray-600 transition-colors ml-4"
            aria-label="Cerrar modal"
          >
            <X class="w-6 h-6" />
          </button>
        {/if}
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6 scrollbar-custom">
        <slot />
      </div>

      <!-- Footer (opcional) -->
      {#if $$slots.footer}
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Animaciones */
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 200ms ease-out;
  }

  .animate-scaleIn {
    animation: scaleIn 200ms ease-out;
  }

  /* Scrollbar personalizada */
  .scrollbar-custom::-webkit-scrollbar {
    width: 8px;
  }

  .scrollbar-custom::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .scrollbar-custom::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  /* Para Firefox */
  .scrollbar-custom {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 #f1f5f9;
  }
</style>
