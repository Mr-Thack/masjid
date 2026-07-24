<script lang="ts">
  import { Send, Paperclip } from 'lucide-svelte';

  let { value = '', disabled = false, onSend, onFile }: {
    value?: string;
    disabled?: boolean;
    onSend: (text: string) => void;
    onFile?: (file: File) => void;
  } = $props();

  let input = $state(value);
  let fileInput: HTMLInputElement | undefined = $state();

  $effect(() => {
    input = value;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    input = '';
  }

  function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file && onFile) {
      onFile(file);
      target.value = '';
    }
  }
</script>

<div class="flex items-end gap-2 bg-surface border border-border rounded-xl p-3">
  {#if onFile}
    <button
      type="button"
      class="p-2 text-text-muted hover:text-text shrink-0"
      onclick={() => fileInput?.click()}
      disabled={disabled}
    >
      <Paperclip size={18} />
    </button>
    <input
      type="file"
      class="hidden"
      bind:this={fileInput}
      onchange={handleFileChange}
      accept="image/*,.pdf"
    />
  {/if}

  <textarea
    class="flex-1 min-h-0 border-0 bg-transparent resize-none p-1 text-sm focus:shadow-none"
    rows={1}
    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
    bind:value={input}
    onkeydown={handleKeydown}
    disabled={disabled}
  ></textarea>

  <button
    type="button"
    class="p-2 rounded-lg shrink-0 transition-colors {input.trim() && !disabled ? 'bg-accent text-white' : 'text-text-muted'}"
    onclick={handleSend}
    disabled={!input.trim() || disabled}
  >
    <Send size={18} />
  </button>
</div>
