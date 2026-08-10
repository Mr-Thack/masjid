import type { BotContext, AdminRecord, ToolContext, ToolResult, LLMMessage, LLMContentPart, AgentResult } from './types';
import { getToolDefinitions } from './tools';
import { buildSystemPrompt, buildVisionPrompt } from './prompt';
import { buildDiffReceipt, buildNoChangesResult } from './format';
import { getMutationCount } from './session';
import { getMasjidProfile } from './api-client';

const DEFAULT_LLM_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemma-4-31b-it';

function resolveLLMConfig(ctx: BotContext): { url: string; key: string; model: string } {
  return {
    url: ctx.llmConfig.url || DEFAULT_LLM_URL,
    key: ctx.llmConfig.key || '',
    model: ctx.llmConfig.model || DEFAULT_MODEL,
  };
}

async function callLLM(
  messages: LLMMessage[],
  tools: { name: string; description: string; parameters: Record<string, unknown> }[],
  config: { url: string; key: string; model: string },
): Promise<{ content: string | null; tool_calls: Array<{ id: string; name: string; arguments: string }> }> {
  if (!config.key) {
    throw new Error('LLM_API_KEY not configured. Set LLM_API_KEY in your environment variables.');
  }

  const endpoint = `${config.url}/chat/completions`;
  console.error('LLM call: url=', endpoint, 'model=', config.model, 'keyLen=', config.key.length);

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.2,
    max_tokens: 2048,
  };

  if (tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
    body.tool_choice = 'auto';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify(body),
    redirect: 'follow',
  });

  const ct = response.headers.get('content-type') || '';
  console.error('LLM response: status=', response.status, 'content-type=', ct);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('LLM API error status:', response.status);
    console.error('LLM API error body:', errorText.slice(0, 500));
    throw new Error(`LLM API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const rawText = await response.text();
  console.error('LLM resp body start:', rawText.slice(0, 300));
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    console.error('LLM API returned non-JSON response:', rawText.slice(0, 500));
    throw new Error(`[v2] LLM non-JSON HTTP ${response.status} ct=${ct} body=${rawText.slice(0, 300)}`);
  }

  const choices = data.choices as Array<Record<string, unknown>> | undefined;

  if (!choices || choices.length === 0) {
    throw new Error('LLM returned no choices');
  }

  const message = choices[0]?.message as Record<string, unknown> | undefined;
  if (!message) {
    throw new Error('LLM returned no message');
  }

  const rawToolCalls = message.tool_calls as Array<Record<string, unknown>> | undefined;
  const toolCalls = rawToolCalls?.map(tc => ({
    id: (tc.id as string) || '',
    name: ((tc.function as Record<string, string>)?.name) || '',
    arguments: ((tc.function as Record<string, string>)?.arguments) || '{}',
  })) || [];

  return {
    content: (message.content as string) || null,
    tool_calls: toolCalls,
  };
}

export async function runVisionAgent(
  dataUri: string,
  contentType: string,
  admin: AdminRecord,
  ctx: BotContext,
): Promise<AgentResult> {
  const llmConfig = resolveLLMConfig(ctx);

  if (!llmConfig.key) {
    return {
      textResponse: 'Image received. LLM-powered processing is not configured (LLM_API_KEY not set).',
      diffReceipt: null,
    };
  }

  try {
    const profileData = await getMasjidProfile(ctx);
    const state = profileData as Record<string, unknown>;

    const tools = getToolDefinitions();
    const systemPrompt = buildVisionPrompt(admin, state, ctx);

    const toolSchemas = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const userContent: LLMContentPart[] = [
      { type: 'text', text: 'Please analyze this prayer timetable image and extract all prayer times and rules. Create prayer rules for the iqaamah times you find. If you see multiple columns (e.g. different months or day types), create rules with appropriate conditions.' },
      { type: 'image_url', image_url: { url: dataUri } },
    ];

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    const toolCtx: ToolContext = ctx;

    const toolMap = new Map(tools.map(t => [t.name, t]));

    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await callLLM(messages, toolSchemas, llmConfig);

      if (response.tool_calls.length === 0) {
        const mutationCount = await getMutationCount(ctx.branchId, ctx.db);

        if (mutationCount > 0) {
          const diffReceipt = await buildDiffReceipt(ctx.branchId, ctx.branchName, ctx.db);
          return { textResponse: response.content || 'Prayer rules extracted from timetable.', diffReceipt };
        }

        return {
          textResponse: response.content || 'I analyzed the image but could not extract any prayer rules.',
          diffReceipt: null,
        };
      }

      const assistantMsg: LLMMessage = {
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      messages.push(assistantMsg);

      for (const tc of response.tool_calls) {
        const tool = toolMap.get(tc.name);
        let result: ToolResult;

        if (!tool) {
          result = { success: false, error: `Unknown tool: ${tc.name}` };
        } else {
          try {
            const args = JSON.parse(tc.arguments);
            result = await tool.handler(args, toolCtx);
          } catch (err) {
            result = {
              success: false,
              error: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: tc.id,
          name: tc.name,
        });
      }
    }

    const mutationCount = await getMutationCount(ctx.branchId, ctx.db);
    if (mutationCount > 0) {
      const diffReceipt = await buildDiffReceipt(ctx.branchId, ctx.branchName, ctx.db);
      return { textResponse: 'Timetable processing complete.', diffReceipt };
    }

    return {
      textResponse: 'I analyzed the image but could not extract any prayer rules.',
      diffReceipt: null,
    };
  } catch (err) {
    console.error('Vision agent error:', err);
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('LLM_API_KEY not configured')) {
      return {
        textResponse: 'Image received. LLM-powered processing is not configured.',
        diffReceipt: null,
      };
    }

    return {
      textResponse: 'Image processing failed. I encountered an error while analyzing the image.',
      diffReceipt: null,
    };
  }
}

export async function runAgent(
  userMessage: string,
  admin: AdminRecord,
  ctx: BotContext,
): Promise<AgentResult> {
  const llmConfig = resolveLLMConfig(ctx);

  if (!llmConfig.key) {
    return buildFallbackResponse(ctx);
  }

  try {
    const existingMutations = await getMutationCount(ctx.branchId, ctx.db);

    console.error('Agent: fetching profile...');
    const profileData = await getMasjidProfile(ctx);
    console.error('Agent: profile fetched ok');
    const state = profileData as Record<string, unknown>;

    const tools = getToolDefinitions();
    const systemPrompt = buildSystemPrompt(admin, state, ctx);

    const toolSchemas = tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (existingMutations > 0) {
      messages.push({
        role: 'system',
        content: `Note: This session already has ${existingMutations} unconfirmed change(s). The user may want to /confirm or /cancel before making more changes.`,
      });
    }

    messages.push({ role: 'user', content: userMessage });

    const toolCtx: ToolContext = ctx;

    const toolMap = new Map(tools.map(t => [t.name, t]));

    for (let iteration = 0; iteration < 5; iteration++) {
      console.error(`Agent: LLM call iteration ${iteration}, model=${llmConfig.model}, hasKey=${!!llmConfig.key}, tools=${toolSchemas.length}`);
      const response = await callLLM(messages, toolSchemas, llmConfig);
      console.error(`Agent: LLM call ok, tool_calls=${response.tool_calls.length}`);

      if (response.tool_calls.length === 0) {
        const mutationCount = await getMutationCount(ctx.branchId, ctx.db);

        if (mutationCount > 0) {
          const diffReceipt = await buildDiffReceipt(ctx.branchId, ctx.branchName, ctx.db);
          return { textResponse: response.content || 'Changes have been prepared.', diffReceipt };
        }

        return {
          textResponse: response.content || null,
          diffReceipt: buildNoChangesResult(),
        };
      }

      const assistantMsg: LLMMessage = {
        role: 'assistant',
        content: response.content || null,
        tool_calls: response.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      messages.push(assistantMsg);

      for (const tc of response.tool_calls) {
        const tool = toolMap.get(tc.name);
        let result: ToolResult;

        if (!tool) {
          result = { success: false, error: `Unknown tool: ${tc.name}` };
        } else {
          try {
            const args = JSON.parse(tc.arguments);
            result = await tool.handler(args, toolCtx);
          } catch (err) {
            result = {
              success: false,
              error: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: tc.id,
          name: tc.name,
        });
      }
    }

    const mutationCount = await getMutationCount(ctx.branchId, ctx.db);
    if (mutationCount > 0) {
      const diffReceipt = await buildDiffReceipt(ctx.branchId, ctx.branchName, ctx.db);
      return { textResponse: 'Processing complete.', diffReceipt };
    }

    return {
      textResponse: null,
      diffReceipt: buildNoChangesResult(),
    };
  } catch (err) {
    const errName = err instanceof Error ? err.name : 'Unknown';
    const errMsg = err instanceof Error ? err.message : String(err);
    const errCause = err instanceof Error ? (err.cause as Error | undefined)?.message ?? String(err.cause ?? 'none') : 'none';
    const errStack = err instanceof Error ? (err.stack ?? '') : '';
    console.error('Agent error name:', errName);
    console.error('Agent error message:', errMsg);
    console.error('Agent error cause:', errCause);
    console.error('Agent error stack:', errStack.slice(0, 1000));

    if (errMsg.includes('LLM_API_KEY not configured')) {
      return buildFallbackResponse(ctx);
    }

    return {
      textResponse: `Error: ${errMsg}`,
      diffReceipt: null,
    };
  }
}

async function buildFallbackResponse(ctx: BotContext): Promise<AgentResult> {
  return {
    textResponse: [
      '[build 28113c2] Message received. I\'ve noted your request. LLM-powered processing is not yet configured (LLM_API_KEY not set).',
      '',
      'Available commands: /help, /status, /cancel',
    ].join('\n'),
    diffReceipt: null,
  };
}
