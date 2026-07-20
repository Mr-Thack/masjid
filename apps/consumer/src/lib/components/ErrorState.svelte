<script lang="ts">
  let { message = 'Something went wrong' }: { message?: string } = $props();
</script>

<div class="glass-card p-6 text-center">
  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" class="h-10 w-10 mx-auto mb-3" style="color: var(--color-text-dim);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
  <p style="color: var(--color-text-muted);">{message}</p>
</div>