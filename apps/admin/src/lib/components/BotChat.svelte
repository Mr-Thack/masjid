<script lang="ts">
  import { api } from '$lib/api';
  import { auth } from '$lib/auth.svelte';
  import ChatInput from './ChatInput.svelte';
  import DiffReceiptCard from './DiffReceiptCard.svelte';
  import { Sparkles, User, Check, X, Loader } from 'lucide-svelte';

  let { masjidId }: { masjidId: string } = $props();

  let messages = $state<{ role: string; content: string; diff?: unknown }[]>([]);
  let thinking = $state(false);
  let branchId = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function sendMessage(text: string) {
    messages = [...messages, { role: 'user', content: text }];
    thinking = true;
    error = null;

    try {
      const res = await api.agentChat(masjidId, {
        message: text,
        ...(branchId ? { branch_id: branchId } : {}),
      });

      if (res.branch_id) branchId = res.branch_id;

      messages = [...messages, {
        role: 'bot',
        content: res.message || res.reply || 'Done',
        diff: res.diff,
      }];
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Agent request failed';
      messages = [...messages, {
        role: 'bot',
        content: `Error: ${error}`,
      }];
    } finally {
      thinking = false;
    }
  }

  async function confirm() {
    if (!branchId) return;
    thinking = true;
    try {
      await api.agentConfirm(masjidId, branchId);
      messages = [...messages, { role: 'bot', content: 'Changes confirmed and applied.' }];
      branchId = null;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Confirmation failed';
    } finally {
      thinking = false;
    }
  }

  async function cancel() {
    if (!branchId) return;
    thinking = true;
    try {
      await api.agentCancel(masjidId, branchId);
      messages = [...messages, { role: 'bot', content: 'Changes cancelled.' }];
      branchId = null;
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Cancellation failed';
    } finally {
      thinking = false;
    }
  }
</script>

<div class="flex flex-col h-full max-w-3xl mx-auto">
  <div class="flex-1 overflow-y-auto space-y-4 p-4">
    {#if messages.length === 0}
      <div class="text-center py-12">
        <Sparkles size={40} class="mx-auto mb-3 text-text-muted" />
        <p class="text-text-muted">Ask the AI to configure your masjid</p>
        <p class="text-xs text-text-muted mt-2">e.g. "Set Fajr iqaamah 15 min after adhaan on weekdays"</p>
      </div>
    {:else}
      {#each messages as msg}
        <div class="flex gap-3 {msg.role === 'user' ? 'flex-row-reverse' : ''}">
          <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center {msg.role === 'user' ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'}">
            {#if msg.role === 'user'}
              <User size={16} />
            {:else}
              <Sparkles size={16} />
            {/if}
          </div>
          <div class="max-w-[75%] {msg.role === 'user' ? 'items-end' : 'items-start'}">
            <div class="rounded-xl px-4 py-2.5 text-sm {msg.role === 'user' ? 'bg-accent/15 text-text' : 'bg-surface border border-border text-text'}">
              {msg.content}
            </div>

            {#if msg.diff}
              <div class="mt-2">
                <DiffReceiptCard diff={msg.diff} />
              </div>

              {#if branchId}
                <div class="flex gap-2 mt-3">
                  <button class="btn-primary text-xs py-1 px-3" onclick={confirm}>
                    <Check size={14} />
                    Confirm
                  </button>
                  <button class="btn-secondary text-xs py-1 px-3" onclick={cancel}>
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    {/if}

    {#if thinking}
      <div class="flex gap-3">
        <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles size={16} class="text-primary" />
        </div>
        <div class="bg-surface border border-border rounded-xl px-4 py-2.5">
          <div class="flex gap-1">
            <span class="w-2 h-2 rounded-full bg-text-muted animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-2 h-2 rounded-full bg-text-muted animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-2 h-2 rounded-full bg-text-muted animate-bounce" style="animation-delay: 300ms"></span>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if branchId}
    <div class="px-4 py-1.5 bg-accent/5 border-t border-accent/10 text-xs text-text-muted">
      Active session — {branchId.slice(0, 8)}...
    </div>
  {/if}

  <div class="p-4 border-t border-border">
    <ChatInput onSend={sendMessage} disabled={thinking} />
  </div>
</div>

<style>
  @keyframes bounce {
    0%, 80%, 100% { transform: scale(1); opacity: 0.4; }
    40% { transform: scale(1.3); opacity: 1; }
  }
  .animate-bounce { animation: bounce 1.4s ease-in-out infinite; }
</style>
