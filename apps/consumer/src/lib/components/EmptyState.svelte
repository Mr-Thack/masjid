<script lang="ts">
  let {
    icon,
    title,
    message,
  }: {
    icon: string;
    title: string;
    message: string;
  } = $props();
</script>

<div class="glass-card p-10 text-center space-y-4">
  <div class="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style="background: rgba(255,255,255,0.03);">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" style="color: var(--color-text-dim);" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={icon} />
    </svg>
  </div>
  <h2 class="text-lg font-semibold font-heading" style="color: var(--color-text-muted);">{title}</h2>
  <p class="text-sm" style="color: var(--color-text-dim);">{message}</p>
</div>