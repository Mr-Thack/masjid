import type { Env, AdminRecord, ToolContext, ToolResult, LLMMessage, LLMContentPart } from '../types';
import { getToolDefinitions } from './tools';
import { buildSystemPrompt, buildVisionPrompt } from './prompt';
import { formatDiffReceipt, buildNoChangesMessage } from './format';
import { getMutationCount } from '../session';
import { getMasjidProfile } from '../proxy';

const DEFAULT_LLM_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemma-4-31b-it';

function getLLMConfig(env: Env): { url: string; key: string; model: string } {
  return {
    url: env.LLM_API_URL || DEFAULT_LLM_URL,
    key: env.LLM_API_KEY || '',
    model: env.LLM_MODEL || DEFAULT_MODEL,
  };
}

async function callLLM(
  messages: LLMMessage[],
  tools: { name: string; description: string; parameters: Record<string, unknown> }[],
  env: Env,
): Promise<{ content: string | null; tool_calls: Array<{ id: string; name: string; arguments: string }> }> {
  const config = getLLMConfig(env);

  if (!config.key) {
    throw new Error('LLM_API_KEY not configured. Set LLM_API_KEY in wrangler.toml or environment variables.');
  }

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

  const response = await fetch(`${config.url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = await response.json() as Record<string, unknown>;
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
  env: Env,
  branchId: string,
): Promise<string> {
  if (!env.LLM_API_KEY) {
    return [
      '*Image received*',
      '',
      'I received your image but LLM-powered processing is not configured (LLM_API_KEY not set).',
      'Your admin needs to add an LLM_API_KEY environment variable.',
    ].join('\n');
  }

  try {
    const profileData = await getMasjidProfile(env, admin.id, admin.masjid_id);
    const state = profileData as Record<string, unknown>;

    const tools = getToolDefinitions();
    const systemPrompt = buildVisionPrompt(admin, state, env);

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

    const ctx: ToolContext = {
      adminId: admin.id,
      masjidId: admin.masjid_id,
      branchId,
      env,
    };

    const toolMap = new Map(tools.map(t => [t.name, t]));

    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await callLLM(messages, toolSchemas, env);

      if (response.tool_calls.length === 0) {
        const mutationCount = await getMutationCount(branchId, env.DB);

        if (mutationCount > 0) {
          const diffReceipt = await formatDiffReceipt(branchId, `whatsapp-${new Date().toISOString().slice(0, 10)}`, env.DB);
          return [response.content || 'Prayer rules extracted from timetable.', '', diffReceipt].join('\n');
        }

        return response.content || 'I analyzed the image but could not extract any prayer rules. Please try sending a clearer photo of the timetable.';
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
            result = await tool.handler(args, ctx);
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

    const mutationCount = await getMutationCount(branchId, env.DB);
    if (mutationCount > 0) {
      const diffReceipt = await formatDiffReceipt(branchId, `whatsapp-${new Date().toISOString().slice(0, 10)}`, env.DB);
      return ['*Timetable processing complete*', '', diffReceipt].join('\n');
    }

    return 'I analyzed the image but could not extract any prayer rules. Please try sending a clearer photo of the timetable.';
  } catch (err) {
    console.error('Vision agent error:', err);
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('LLM_API_KEY not configured')) {
      return [
        '*Image received*',
        '',
        'I received your image but LLM-powered processing is not configured.',
      ].join('\n');
    }

    return [
      '*Image processing failed*',
      '',
      'I encountered an error while analyzing the image. Please try again.',
    ].join('\n');
  }
}

export async function runAgent(
  userMessage: string,
  admin: AdminRecord,
  env: Env,
  branchId: string,
): Promise<string> {
  if (!env.LLM_API_KEY) {
    return buildFallbackResponse(userMessage, branchId, env);
  }

  try {
    const existingMutations = await getMutationCount(branchId, env.DB);

    const profileData = await getMasjidProfile(env, admin.id, admin.masjid_id);
    const state = profileData as Record<string, unknown>;

    const tools = getToolDefinitions();
    const systemPrompt = buildSystemPrompt(admin, state, env);

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

    const ctx: ToolContext = {
      adminId: admin.id,
      masjidId: admin.masjid_id,
      branchId,
      env,
    };

    const toolMap = new Map(tools.map(t => [t.name, t]));

    for (let iteration = 0; iteration < 5; iteration++) {
      const response = await callLLM(messages, toolSchemas, env);

      if (response.tool_calls.length === 0) {
        const mutationCount = await getMutationCount(branchId, env.DB);

        if (mutationCount > 0) {
          const diffReceipt = await formatDiffReceipt(branchId, `whatsapp-${new Date().toISOString().slice(0, 10)}`, env.DB);
          return [response.content || 'Changes have been prepared.', '', diffReceipt].join('\n');
        }

        return response.content || buildNoChangesMessage();
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
            result = await tool.handler(args, ctx);
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

    const mutationCount = await getMutationCount(branchId, env.DB);
    if (mutationCount > 0) {
      const diffReceipt = await formatDiffReceipt(branchId, `whatsapp-${new Date().toISOString().slice(0, 10)}`, env.DB);
      return ['*Processing complete*', '', diffReceipt].join('\n');
    }

    return buildNoChangesMessage();
  } catch (err) {
    console.error('Agent error:', err);
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('LLM_API_KEY not configured')) {
      return buildFallbackResponse(userMessage, branchId, env);
    }

    return [
      '*Something went wrong*',
      '',
      'I encountered an error while processing your request. Please try again or use `/help` for available commands.',
    ].join('\n');
  }
}

async function buildFallbackResponse(
  _userMessage: string,
  branchId: string,
  env: Env,
): Promise<string> {
  return [
    '*Message received*',
    '',
    'I\'ve noted your request. LLM-powered processing is not yet configured (LLM_API_KEY not set).',
    '',
    'Available commands:',
    '• `/help` — show available commands',
    '• `/status` — view your session history',
    '• `/cancel` — discard this session',
    '',
    'Your admin will need to add an LLM_API_KEY environment variable to enable automatic configuration.',
  ].join('\n');
}
