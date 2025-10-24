<script lang="ts">
  import { ChevronDown, AlertTriangle, FileText } from 'lucide-svelte';
  import { Badge, Button } from '$lib/components/ui';

  // Props
  export let columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: string;
    render?: (value: any, row: any) => any;
  }> = [];

  export let rows: any[] = [];
  export let loading = false;
  export let error: string | null = null;
  export let emptyMessage = 'No hay registros';
  export let emptySubMessage = 'No se encontraron registros con los filtros aplicados';
  export let sortBy: string | null = null;
  export let sortDir: 'ASC' | 'DESC' = 'ASC';
  export let showActions = true;
  export let actionMenuOpen: number | null = null;

  // Events
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  // Functions
  function handleSort(columnKey: string) {
    if (sortBy === columnKey) {
      sortDir = sortDir === 'ASC' ? 'DESC' : 'ASC';
    } else {
      sortBy = columnKey;
      sortDir = 'ASC';
    }
    dispatch('sort', { sortBy, sortDir });
  }

  function getSortIcon(columnKey: string): 'up' | 'down' | 'none' {
    if (sortBy !== columnKey) return 'none';
    return sortDir === 'ASC' ? 'up' : 'down';
  }

  function toggleActionMenu(rowId: number | string, event: Event) {
    event.stopPropagation();
    actionMenuOpen = actionMenuOpen === rowId ? null : rowId;
  }

  function getAlignClass(align: 'left' | 'center' | 'right' = 'left'): string {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  }
</script>

<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-50">
      <tr>
        {#each columns as column}
          <th
            class="px-6 py-3 text-xs font-medium text-gray-700 tracking-wider {getAlignClass(column.align)}"
            style={column.width ? `width: ${column.width}` : ''}
          >
            {#if column.sortable}
              <button
                on:click={() => handleSort(column.key)}
                class="flex items-center gap-1 cursor-pointer hover:text-gray-900 transition-colors {getAlignClass(column.align)}"
              >
                {column.label}
                {#if getSortIcon(column.key) === 'up'}
                  <ChevronDown class="w-4 h-4 rotate-180" />
                {:else if getSortIcon(column.key) === 'down'}
                  <ChevronDown class="w-4 h-4" />
                {:else}
                  <ChevronDown class="w-4 h-4 text-gray-400" />
                {/if}
              </button>
            {:else}
              <span>{column.label}</span>
            {/if}
          </th>
        {/each}

        {#if showActions}
          <th class="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider">
            <span class="inline-block">Acciones</span>
          </th>
        {/if}
      </tr>
    </thead>

    <tbody class="bg-white divide-y divide-gray-200">
      {#if loading}
        <tr>
          <td colspan={columns.length + (showActions ? 1 : 0)} class="px-6 py-12 text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-gray-600">Cargando registros...</p>
          </td>
        </tr>
      {:else if error}
        <tr>
          <td colspan={columns.length + (showActions ? 1 : 0)} class="px-6 py-12 text-center">
            <div class="text-red-600">
              <AlertTriangle class="w-12 h-12 mx-auto mb-2" />
              <p class="font-medium">Error al cargar registros</p>
              <p class="text-sm text-gray-600 mt-1">{error}</p>
              <div class="mt-4 flex justify-center">
                <Button variant="primary" size="md" on:click={() => dispatch('retry')}>
                  Reintentar
                </Button>
              </div>
            </div>
          </td>
        </tr>
      {:else if rows.length === 0}
        <tr>
          <td colspan={columns.length + (showActions ? 1 : 0)} class="px-6 py-12 text-center">
            <FileText class="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p class="text-gray-600">{emptyMessage}</p>
            <p class="text-sm text-gray-500 mt-1">{emptySubMessage}</p>
          </td>
        </tr>
      {:else}
        {#each rows as row (row.id)}
          <tr class="hover:bg-gray-50">
            {#each columns as column}
              <td
                class="px-6 py-4 {getAlignClass(column.align)} {column.align === 'right' ? 'whitespace-nowrap' : ''}"
              >
                {#if column.render}
                  <svelte:component this={column.render} value={row[column.key]} {row} />
                {:else}
                  <div class="text-sm text-gray-900">{row[column.key]}</div>
                {/if}
              </td>
            {/each}

            {#if showActions}
              <td class="px-6 py-4 text-center relative">
                <slot name="actions" {row} {actionMenuOpen} {toggleActionMenu} />
              </td>
            {/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
