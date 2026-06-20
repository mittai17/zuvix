import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { vault } from './vault';
import { getDefaultModel } from './model-router';

dotenv.config({ path: path.join(__dirname, '../.env') });

export interface ModelConfig {
  apiKey?: string;
  provider?: string; // 'openai', 'anthropic', 'openrouter', 'gemini', 'bytez', 'deepseek', 'custom'
  modelName?: string;
  customBaseUrl?: string;
}

export function getLLMClient(config?: ModelConfig) {
  let apiKey = config?.apiKey;
  let provider = resolveProvider(config);
  let baseURL: string | undefined;

  // Fallbacks to Vault first, then .env
  if (!apiKey) {
    if (provider === 'openrouter') apiKey = vault.getSecret('OPENROUTER_API_KEY') || process.env.OPENROUTER_API_KEY;
    else if (provider === 'openai') apiKey = vault.getSecret('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
    else if (provider === 'anthropic') apiKey = vault.getSecret('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY;
    else if (provider === 'gemini') apiKey = vault.getSecret('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
    else if (provider === 'bytez') apiKey = vault.getSecret('BYTEZ_API_KEY') || process.env.BYTEZ_API_KEY;
    else if (provider === 'deepseek') apiKey = vault.getSecret('DEEPSEEK_API_KEY') || process.env.DEEPSEEK_API_KEY;
    else if (provider === 'custom') apiKey = vault.getSecret('CUSTOM_API_KEY') || process.env.CUSTOM_API_KEY || 'sk-dummy';
  }

  if (!apiKey && provider !== 'custom') {
    throw new Error(`No API key found for provider: ${provider}. Please configure it in Settings.`);
  }

  if (provider === 'openrouter') {
    baseURL = 'https://openrouter.ai/api/v1';
  } else if (provider === 'custom') {
    baseURL = config?.customBaseUrl || process.env.CUSTOM_BASE_URL || 'http://localhost:11434/v1';
  } else if (provider === 'gemini') {
    baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
  } else if (provider === 'bytez') {
    baseURL = 'https://api.bytez.com/v1';
  } else if (provider === 'deepseek') {
    baseURL = 'https://api.deepseek.com';
  } else if (provider === 'anthropic') {
    baseURL = config?.customBaseUrl || 'https://api.anthropic.com/v1/messages';
  }

  return new OpenAI({
    apiKey: apiKey || 'dummy-key',
    baseURL,
    defaultHeaders: provider === 'openrouter' ? {
      'HTTP-Referer': 'https://zuvix.os',
      'X-Title': 'Zuvix OS'
    } : {}
  });
}

function detectProvider(apiKey: string): string | null {
  if (apiKey.startsWith('sk-or-')) return 'openrouter';
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) return 'gemini';
  if (apiKey.startsWith('c6af') || apiKey.startsWith('bytez-')) return 'bytez';
  if (apiKey.startsWith('sk-')) return 'openai';
  return null;
}

export function resolveProvider(config?: ModelConfig): string {
  if (config?.provider) return config.provider;
  const byKey = config?.apiKey ? detectProvider(config.apiKey) : null;
  if (byKey) return byKey;
  const envProvider = process.env.LLM_PROVIDER;
  if (envProvider) return envProvider;
  const geminiKey = vault.getSecret('GEMINI_API_KEY') || process.env.GEMINI_API_KEY;
  const bytezKey = vault.getSecret('BYTEZ_API_KEY') || process.env.BYTEZ_API_KEY;
  const openaiKey = vault.getSecret('OPENAI_API_KEY') || process.env.OPENAI_API_KEY;
  const deepseekKey = vault.getSecret('DEEPSEEK_API_KEY') || process.env.DEEPSEEK_API_KEY;
  if (deepseekKey && !openaiKey) return 'deepseek';
  if (geminiKey && !openaiKey) return 'gemini';
  if (bytezKey && !openaiKey) return 'bytez';
  return 'openai';
}

export function getModelName(config?: ModelConfig) {
  const provider = resolveProvider(config);
  return config?.modelName || process.env.LLM_MODEL || getDefaultModel(provider) || 'gpt-4o';
}

// Re-export for convenience
export { createChatCompletion } from './model-router';
