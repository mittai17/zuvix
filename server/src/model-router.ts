import { OpenAI } from 'openai';

/*
 * Self-healing model router.
 * For Bytez: fetches live model catalog on startup, requests unavailable
 * models, falls through curated lists, and caches working models.
 * As last resort, falls back to Bytez native API via fetch().
 */

interface BytezModel {
  modelId: string;
  task: string;
}

let bytezCatalog: BytezModel[] | null = null;
let catalogFetchAt = 0;
const CATALOG_TTL = 10 * 60 * 1000;

async function fetchBytezCatalog(apiKey: string): Promise<BytezModel[]> {
  if (bytezCatalog && Date.now() - catalogFetchAt < CATALOG_TTL) return bytezCatalog;
  try {
    const res = await fetch('https://api.bytez.com/models/v2/list/models?task=chat', {
      headers: { 'Authorization': apiKey },
    });
    if (res.ok) {
      const data = await res.json() as any;
      bytezCatalog = (data?.output || []) as BytezModel[];
      catalogFetchAt = Date.now();
      return bytezCatalog!;
    }
  } catch { /* ignore */ }
  return [];
}

const FALLBACK_MODELS: Record<string, string[]> = {
  bytez: [
    '0-hero/Matter-0.1-Slim-7B-C',
    'Qwen/Qwen3-4B',
    'Qwen/Qwen3-8B',
    'Qwen/Qwen2.5-7B-Instruct',
    'Qwen/Qwen2.5-14B-Instruct',
    'meta-llama/Llama-3.2-3B-Instruct',
    'meta-llama/Llama-3.1-8B-Instruct',
    'mistralai/Mistral-7B-Instruct-v0.3',
    'microsoft/Phi-3.5-mini-instruct',
    'google/gemma-2-9b-it',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
  ],
  openrouter: [
    'openai/gpt-4o',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.1-8b-instruct',
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ],
  gemini: [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro-exp-02-05',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro',
  ],
  deepseek: [
    'deepseek-v4-flash',
    'deepseek-v4-pro',
    'deepseek-chat',
    'deepseek-reasoner',
  ],
};

export function getDefaultModel(provider: string): string | undefined {
  const fallbacks = FALLBACK_MODELS[provider];
  return fallbacks?.[0];
}

const workingModelCache = new Map<string, { model: string; expiresAt: number }>();
const requestedModels = new Set<string>();
const CACHE_TTL = 5 * 60 * 1000;

function isModelNotFound(err: any): boolean {
  if (err?.status === 404) return true;
  const msg = err?.message?.toLowerCase() || '';
  return msg.includes('does not exist') || msg.includes('model not found') || msg.includes('not found');
}

// Try Bytez native API as last resort — some models may only be
// available via the native endpoint, not the OpenAI-compatible one.
async function tryBytezNativeApi(
  apiKey: string,
  modelId: string,
  messages: { role: string; content: any }[] | OpenAI.Chat.Completions.ChatCompletionMessageParam[],
): Promise<any> {
  const res = await fetch(`https://api.bytez.com/models/v2/${encodeURIComponent(modelId)}`, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, params: { temperature: 0.2, max_length: 500 } }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error((err as any)?.error || 'Bytez native API failed'), { status: res.status });
  }
  const data = await res.json() as any;
  return {
    choices: [{ message: { content: data?.output || '' } }],
  } as any;
}

async function getModelCandidates(provider: string, apiKey: string | undefined, requestedModel?: string): Promise<string[]> {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (m: string) => { if (m && !seen.has(m)) { seen.add(m); result.push(m); } };

  if (provider === 'bytez' && apiKey) {
    const catalog = await fetchBytezCatalog(apiKey);
    for (const m of catalog) {
      if (m.task === 'chat' || !m.task) push(m.modelId);
    }
  }

  let preferredModel = requestedModel;
  if (provider === 'gemini' && preferredModel?.startsWith('google/')) {
    preferredModel = preferredModel.replace('google/', '');
  }

  if (preferredModel) push(preferredModel);

  const cached = workingModelCache.get(provider);
  if (cached?.expiresAt && cached.expiresAt > Date.now()) push(cached.model);

  const fallbacks = FALLBACK_MODELS[provider] || [];
  for (const m of fallbacks) push(m);

  return result;
}

export function recordWorkingModel(provider: string, model: string) {
  workingModelCache.set(provider, { model, expiresAt: Date.now() + CACHE_TTL });
}

async function requestBytezModel(modelId: string, apiKey: string): Promise<void> {
  if (requestedModels.has(modelId)) return;
  requestedModels.add(modelId);
  try {
    await fetch(`https://api.bytez.com/models/v2/request/${encodeURIComponent(modelId)}`, {
      method: 'POST',
      headers: { 'Authorization': apiKey },
    });
  } catch { /* best-effort */ }
}

export async function createChatCompletion(
  client: OpenAI,
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming & { model: string },
  provider?: string,
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (!provider) provider = 'openai';
  const models = await getModelCandidates(provider, client.apiKey ?? undefined, params.model);
  let lastError: any;

  for (const model of models) {
    try {
      const result = await client.chat.completions.create({ ...params, model });
      recordWorkingModel(provider, model);
      return result;
    } catch (err: any) {
      lastError = err;
      if (isModelNotFound(err)) {
        if (provider === 'bytez' && client.apiKey) requestBytezModel(model, client.apiKey);
        continue;
      }
      throw err;
    }
  }

  // For Bytez: try native API as last resort
  if (provider === 'bytez' && client.apiKey && models.length > 0) {
    const nativeModel = models[0];
    try {
      const result = await tryBytezNativeApi(client.apiKey, nativeModel, params.messages);
      recordWorkingModel(provider, nativeModel + ' (native)');
      return result;
    } catch (err: any) {
      lastError = err;
      if (!isModelNotFound(err)) throw err;
    }
  }

  throw new Error(
    `All ${models.length} model(s) failed for provider "${provider}". ` +
    `Tried: ${models.join(', ')}. Last error: ${lastError?.message || lastError}`,
  );
}
