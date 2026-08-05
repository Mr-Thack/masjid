<script>
  import '../app.css';

  let { children } = $props();

  $effect(() => {
    document.documentElement.dataset.hydrated = 'true';
  });
</script>

{@render children()}