<script lang="ts">
  let {
    announcement,
    accentColor = '#10b981',
  }: {
    announcement: { title: string; compiled_html: string } | null;
    accentColor: string;
  } = $props();
</script>

{#if announcement}
  <div
    class="w-full py-4 overflow-hidden"
    style="background: linear-gradient(90deg, {accentColor}dd, {accentColor});"
  >
    <div class="flex animate-marquee whitespace-nowrap">
      <span class="inline-flex items-center gap-3 text-white text-xl font-semibold tracking-wide px-8">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>
        {announcement.title}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
          />
        </svg>
        {announcement.title}
      </span>
    </div>
  </div>
  <style>
    @keyframes marquee {
      0% {
        transform: translateX(0);
      }
      100% {
        transform: translateX(-50%);
      }
    }
    .animate-marquee {
      animation: marquee 25s linear infinite;
    }
  </style>
{/if}