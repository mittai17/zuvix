import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Key, Globe, Database, Settings as SettingsIcon, RefreshCw, CheckCircle2, Server, Plug, Wifi, WifiOff, Sun, Moon, Download, Upload, Monitor } from 'lucide-react';
import { config } from '../config';

export interface ModelConfig {
  apiKey: string;
  provider: string;
  modelName: string;
  customBaseUrl?: string;
}

interface DbStatus {
  configured: boolean;
  supabase: { url: string; hasKey: boolean };
  appwrite: { endpoint: string; projectId: string; hasKey: boolean };
}

interface AppConfig {
  theme: 'dark' | 'light' | 'system';
  sidebarCollapsed: boolean;
  fontSize: number;
  model: ModelConfig;
}

const PROVIDERS = [
  // ── Multi-Model Routers ──
  { value: 'openrouter', label: 'OpenRouter — 300+ Models Unified' },
  { value: 'custom', label: 'Custom OpenAI-compatible Endpoint' },
  { value: 'together', label: 'Together AI — 100+ Open Models' },
  { value: 'fireworks', label: 'Fireworks AI — Fast Open Models' },
  { value: 'groq', label: 'Groq LPU — Ultra-Fast Inference' },
  { value: 'deepinfra', label: 'DeepInfra — Serverless OSS' },
  { value: 'novita', label: 'Novita AI — 80+ Models' },
  { value: 'lepton', label: 'Lepton AI — Fully Managed' },
  { value: 'bytez', label: 'Bytez — Model Inference API' },
  { value: 'featherless', label: 'Featherless AI — Serverless' },

  // ── Major Cloud Providers ──
  { value: 'openai', label: 'OpenAI — GPT-4o, o-series' },
  { value: 'anthropic', label: 'Anthropic — Claude 3.5/4' },
  { value: 'gemini', label: 'Google Gemini — Flash, Pro, Ultra' },
  { value: 'aws-bedrock', label: 'AWS Bedrock — Claude, Llama, Mistral' },
  { value: 'azure-openai', label: 'Azure OpenAI — GPT-4o, o1' },
  { value: 'gcp-vertex', label: 'GCP Vertex AI — Gemini, Claude' },
  { value: 'alibaba-cloud', label: 'Alibaba Cloud — Qwen Series' },
  { value: 'baidu-qianfan', label: 'Baidu Qianfan — ERNIE Models' },
  { value: 'tencent-hunyuan', label: 'Tencent Hunyuan — LLM + Vision' },
  { value: 'huawei-pangu', label: 'Huawei Pangu — Industry LLMs' },

  // ── Open-Source & Local ──
  { value: 'ollama', label: 'Ollama — Local Models (llama.cpp)' },
  { value: 'vllm', label: 'vLLM — High-Throughput OSS' },
  { value: 'text-gen-ui', label: 'Oobabooga TextGen WebUI' },
  { value: 'llama-cpp', label: 'llama.cpp — Local GGUF Models' },
  { value: 'koboldcpp', label: 'KoboldCPP — Story/Narrative Focus' },
  { value: 'tabbyapi', label: 'TabbyAPI — ExLlamaV2 Backend' },
  { value: 'aphrodite', label: 'Aphrodite Engine — OSS Router' },
  { value: 'localai', label: 'LocalAI — OpenAI Drop-In Local' },
  { value: 'lm-studio', label: 'LM Studio — Local GUI + API' },
  { value: 'jan', label: 'Jan.ai — Desktop Local Runner' },

  // ── Research & Specialized ──
  { value: 'mistral', label: 'Mistral AI — Mistral Large/Pixtral' },
  { value: 'cohere', label: 'Cohere — Command R+ / Embed v3' },
  { value: 'ai21', label: 'AI21 Labs — Jurassic-2 / Jamba' },
  { value: 'writer', label: 'Writer — Palmyra Enterprise LLMs' },
  { value: 'reka', label: 'Reka AI — Core / Flash / Edge' },
  { value: 'snowflake', label: 'Snowflake Arctic — Open Enterprise' },
  { value: 'upstage', label: 'Upstage — SOLAR / Embeddings' },
  { value: 'kakaobrain', label: 'KakaoBrain — KoGPT / Honeybee' },
  { value: 'naver', label: 'NAVER — HyperCLOVA X' },
  { value: 'lg-ai', label: 'LG AI Research — EXAONE' },

  // ── Inference & Serving ──
  { value: 'replicate', label: 'Replicate — Cloud GPU Inference' },
  { value: 'huggingface', label: 'HuggingFace Inference Endpoints' },
  { value: 'baseten', label: 'Baseten — Model Serving' },
  { value: 'modal', label: 'Modal — Serverless GPU' },
  { value: 'banana', label: 'Banana.dev — GPU Inference' },
  { value: 'fal', label: 'Fal.ai — Fast Inference API' },
  { value: 'cerebras', label: 'Cerebras — Wafer-Scale Inference' },
  { value: 'sambanova', label: 'SambaNova — SN40L Platform' },
  { value: 'groqcloud', label: 'GroqCloud — LPU Inference' },

  // ── Image & Multimodal ──
  { value: 'stability', label: 'Stability AI — SD3, Stable Diffusion' },
  { value: 'midjourney', label: 'Midjourney — (via API proxies)' },
  { value: 'ideogram', label: 'Ideogram — Text-to-Image' },
  { value: 'black-forest', label: 'Black Forest Labs — Flux.1' },
  { value: 'recraft', label: 'Recraft — Vector/Image Gen' },
  { value: 'getimg', label: 'GetImg.ai — Image Generation Suite' },
  { value: 'clipdrop', label: 'Clipdrop — StabilityAI Tools' },
  { value: 'deepfloyd', label: 'DeepFloyd — Text-to-Image IF' },
  { value: 'luma', label: 'Luma AI — Video Generation (Dream Machine)' },
  { value: 'runway', label: 'Runway ML — Gen-3 Video' },
  { value: 'pika', label: 'Pika Labs — Video Generation' },
  { value: 'haiper', label: 'Haiper AI — Video Generation' },

  // ── Audio & Speech ──
  { value: 'openai-tts', label: 'OpenAI TTS — Text-to-Speech' },
  { value: 'elevenlabs', label: 'ElevenLabs — Voice Synthesis' },
  { value: 'cartesia', label: 'Cartesia — Real-Time TTS' },
  { value: 'deepgram', label: 'Deepgram — Speech-to-Text' },
  { value: 'assembly', label: 'AssemblyAI — Audio Intelligence' },
  { value: 'whisper-openai', label: 'OpenAI Whisper — STT API' },
  { value: 'whisper-local', label: 'Whisper.cpp — Local STT' },
  { value: 'soniox', label: 'Soniox — Speech Recognition' },

  // ── Embeddings & Vector ──
  { value: 'openai-embed', label: 'OpenAI — text-embedding-3-*' },
  { value: 'cohere-embed', label: 'Cohere — Embed v3 / Rerank' },
  { value: 'voyage', label: 'Voyage AI — Domain Embeddings' },
  { value: 'jina', label: 'Jina AI — v2 Embeddings/Rerank' },
  { value: 'mixedbread', label: 'MixedBread AI — Embeddings' },

  // ── Code-Specific ──
  { value: 'github-copilot', label: 'GitHub Copilot — Code Completion' },
  { value: 'cursor', label: 'Cursor — Code LLM (Sonnet/GPT-4o)' },
  { value: 'codeium', label: 'Codeium/Windsurf — Code AI' },
  { value: 'tabnine', label: 'Tabnine — Code Completion' },
  { value: 'amazon-q', label: 'Amazon Q Developer' },
  { value: 'google-codey', label: 'Google Codey — Code Completion' },
  { value: 'refact', label: 'Refact.ai — Open Code LLM' },
  { value: 'devin', label: 'Devin — Cognition AI (via API)' },
  { value: 'poolside', label: 'Poolside — Code LLM' },

  // ── Agent / Tool-use Engines ──
  { value: 'cognition', label: 'Cognition AI — Devin Engine' },
  { value: 'adept', label: 'Adept AI — Action Transformer' },
  { value: 'orq', label: 'ORQ.ai — Multi-Provider Router' },
  { value: 'portkey', label: 'Portkey — AI Gateway/Router' },
  { value: 'helix', label: 'Helix AI — Agent Infrastructure' },

  // ── Niche / Regional ──
  { value: 'deepseek', label: 'DeepSeek — DeepSeek-V3/Coder' },
  { value: 'qwen', label: 'Alibaba Qwen — Qwen2.5 Series' },
  { value: 'yi', label: '01.AI Yi — Yi-Lightning/Spark' },
  { value: 'minimax', label: 'MiniMax — MiniMax-Text-01' },
  { value: 'moonshot', label: 'Moonshot AI — Kimi k1.5' },
  { value: 'stepfun', label: 'StepFun — Step-2 / Step-1v' },
  { value: 'inflection', label: 'Inflection AI — Pi / Inflection-2' },
  { value: 'xai', label: 'xAI — Grok-2 / Grok-3' },
  { value: 'microsoft', label: 'Microsoft — Phi-3 / MAI-1' },
  { value: 'meta', label: 'Meta — Llama 3.1/4 Official API' },
  { value: 'nvidia', label: 'NVIDIA — Nemotron / NIM Microservices' },
  { value: 'apple', label: 'Apple — Foundation Models (Private)' },
  { value: 'ibm', label: 'IBM — Granite Models / watsonx' },
  { value: 'intel', label: 'Intel — Gaudi / Neural Chat' },
  { value: 'amd', label: 'AMD — Instinct / OLMo' },
  { value: 'databricks', label: 'Databricks — DBRX / Foundation Models' },
  { value: 'mosaicml', label: 'MosaicML/DataBricks — MPT Series' },
  { value: 'perplexity', label: 'Perplexity — Sonar / Online LLMs' },
  { value: 'character', label: 'Character.ai — Conversation Models' },
  { value: 'inference', label: 'Inference.net — Decentralized GPU' },
  { value: 'spheron', label: 'Spheron — Decentralized Inference' },
  { value: 'akash', label: 'Akash Network — Decentralized GPU' },
];

const QUICK_MODELS = [
  // ── OpenRouter Top ──
  'google/gemini-2.5-flash', 'google/gemini-2.5-pro-preview',
  'meta-llama/llama-3.3-70b-instruct', 'meta-llama/llama-3.2-90b-vision-instruct',
  'anthropic/claude-3.5-sonnet', 'anthropic/claude-3.5-haiku-20241022',
  'anthropic/claude-3-opus-20240229', 'openai/gpt-4o', 'openai/gpt-4o-mini',
  'openai/o1-preview', 'openai/o1-mini', 'openai/o3-mini-high',
  'qwen/qwen-2.5-72b-instruct', 'qwen/qwen-2.5-coder-32b-instruct',
  'qwen/qwen-2-vl-72b-instruct', 'mistralai/mistral-large-2407',
  'mistralai/mixtral-8x22b-instruct', 'mistralai/mistral-small-24b-instruct',
  'deepseek/deepseek-chat', 'deepseek/deepseek-coder',
  'nousresearch/hermes-3-llama-3.1-405b', 'microsoft/phi-3-medium-128k-instruct',
  'meta/llama-4-maverick-17b', 'internlm/internlm2_5-20b-chat',

  // ── via Together AI ──
  'together/google/gemma-2-27b', 'together/meta-llama/Llama-3.3-70B',
  'together/mistralai/Mixtral-8x22B', 'together/upstage/SOLAR-10.7B-Instruct',

  // ── via Fireworks ──
  'fireworks/llama-v3p3-70b-instruct', 'fireworks/mixtral-8x22b-instruct',
  'fireworks/deepseek-coder-v2-lite', 'fireworks/qwen2-72b-instruct',

  // ── via Groq ──
  'groq/llama-3.3-70b-versatile', 'groq/llama-3.2-90b-vision-preview',
  'groq/mixtral-8x7b-32768', 'groq/deepseek-r1-distill-llama-70b',

  // ── Cloud Native Models ──
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview', 'o1-mini', 'o3-mini',
  'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229',
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite',
  'gemini-2.0-pro-exp-02-05', 'gemini-2.0-flash-thinking-exp-01-21', 
  'gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 
  'gemini-1.0-pro', 'gemini-1.0-pro-vision-latest', 'aqa', 'text-embedding-004',
  'gemma-2-27b-it', 'gemma-2-9b-it',
  'command-r-plus', 'command-r-v03:2024-12-04',
  'jamba-1.5-mini', 'jamba-1.5-large',
  'llama-3.1-405b-instruct', 'llama-3.1-70b-instruct', 'llama-3.3-70b-instruct',
  'mistral-large-latest', 'mistral-small-latest', 'codestral-latest',
  'deepseek-chat', 'deepseek-reasoner',
  'qwen2.5-72b-instruct', 'qwen2.5-32b-instruct', 'qwen2.5-coder-32b-instruct',
  'yi-lightning', 'minimax-text-01',
  'dbrx-instruct', 'mpt-30b-instruct',
];

const DEFAULT_CONFIG: ModelConfig = {
  provider: 'openrouter', apiKey: '', modelName: 'google/gemini-2.5-flash', customBaseUrl: '',
};

function getStoredTheme(): 'dark' | 'light' | 'system' {
  return (localStorage.getItem('zuvix_theme') as any) || 'light';
}

function applyTheme(theme: 'dark' | 'light' | 'system') {
  const isDark = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
}

export const Settings: React.FC = () => {
  const [provider, setProvider] = useState<string>('openrouter');
  const [providerSearch, setProviderSearch] = useState('');
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [modelName, setModelName] = useState<string>('google/gemini-2.5-flash');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'pass' | 'fail'>('idle');

  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [awEndpoint, setAwEndpoint] = useState('');
  const [awProjectId, setAwProjectId] = useState('');
  const [awKey, setAwKey] = useState('');
  const [sbTesting, setSbTesting] = useState(false);
  const [awTesting, setAwTesting] = useState(false);
  const [sbTestResult, setSbTestResult] = useState<'idle' | 'pass' | 'fail'>('idle');
  const [awTestResult, setAwTestResult] = useState<'idle' | 'pass' | 'fail'>('idle');
  const [dbSaving, setDbSaving] = useState(false);
  const [dbSaved, setDbSaved] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(getStoredTheme);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('zuvix_sidebar_collapsed') === 'true');
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('zuvix_font_size') || '14'));
  const [importStatus, setImportStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [modelSearch, setModelSearch] = useState('');

  // Close provider picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setShowProviderPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    const handler = (_e: MediaQueryListEvent) => {
      if (getStoredTheme() === 'system') applyTheme('system');
    };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const savedConfig = localStorage.getItem('zuvix_model_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setProvider(parsed.provider || 'openrouter');
        setApiKey(parsed.apiKey || '');
        setModelName(parsed.modelName || 'google/gemini-2.5-flash');
        setCustomBaseUrl(parsed.customBaseUrl || '');
      } catch {}
    }
    fetchDbStatus();
  }, []);

  const fetchDbStatus = async () => {
    try {
      const res = await fetch(`${config.API_BASE}/api/db/config`);
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        if (data.configured) {
          setSbUrl(data.supabase.url);
          setAwEndpoint(data.appwrite.endpoint);
          setAwProjectId(data.appwrite.projectId);
        }
      }
    } catch { /* offline */ }
  };

  const handleSave = useCallback(() => {
    const configData: ModelConfig = { provider, apiKey, modelName, customBaseUrl };
    localStorage.setItem('zuvix_model_config', JSON.stringify(configData));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [provider, apiKey, modelName, customBaseUrl]);

  const handleTestConnection = async () => {
    setTesting(true); setTestResult('idle');
    try {
      const res = await fetch(`${config.API_BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
      setTestResult(res.ok ? 'pass' : 'fail');
    } catch { setTestResult('fail'); }
    setTesting(false);
  };

  const handleTestSupabase = async () => {
    if (!sbUrl || !sbKey) return;
    setSbTesting(true); setSbTestResult('idle');
    try {
      const res = await fetch(`${config.API_BASE}/api/db/test-supabase`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sbUrl, key: sbKey })
      });
      const data = await res.json();
      setSbTestResult(data.success ? 'pass' : 'fail');
    } catch { setSbTestResult('fail'); }
    setSbTesting(false);
  };

  const handleTestAppwrite = async () => {
    if (!awEndpoint || !awProjectId || !awKey) return;
    setAwTesting(true); setAwTestResult('idle');
    try {
      const res = await fetch(`${config.API_BASE}/api/db/test-appwrite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: awEndpoint, projectId: awProjectId, apiKey: awKey })
      });
      const data = await res.json();
      setAwTestResult(data.success ? 'pass' : 'fail');
    } catch { setAwTestResult('fail'); }
    setAwTesting(false);
  };

  const handleSaveDbConfig = async () => {
    setDbSaving(true);
    try {
      const res = await fetch(`${config.API_BASE}/api/db/config`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase: { url: sbUrl, serviceRoleKey: sbKey, anonKey: sbKey },
          appwrite: { endpoint: awEndpoint, projectId: awProjectId, apiKey: awKey }
        })
      });
      if (res.ok) { setDbSaved(true); setTimeout(() => setDbSaved(false), 2000); fetchDbStatus(); }
    } catch { /* offline */ }
    setDbSaving(false);
  };

  const handleThemeChange = (t: 'dark' | 'light' | 'system') => {
    setTheme(t);
    localStorage.setItem('zuvix_theme', t);
    applyTheme(t);
  };

  const handleSidebarCollapsedChange = (v: boolean) => {
    setSidebarCollapsed(v);
    localStorage.setItem('zuvix_sidebar_collapsed', String(v));
    window.dispatchEvent(new CustomEvent('zuvix-sidebar-change', { detail: { collapsed: v } }));
  };

  const handleFontSizeChange = (s: number) => {
    setFontSize(s);
    localStorage.setItem('zuvix_font_size', String(s));
    document.documentElement.style.fontSize = `${s}px`;
  };

  const handleExportConfig = () => {
    const cfg: AppConfig = {
      theme, sidebarCollapsed, fontSize,
      model: JSON.parse(localStorage.getItem('zuvix_model_config') || JSON.stringify(DEFAULT_CONFIG)),
    };
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'zuvix-config.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportStatus('idle');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const cfg: AppConfig = JSON.parse(ev.target?.result as string);
        if (cfg.model) {
          localStorage.setItem('zuvix_model_config', JSON.stringify(cfg.model));
          setProvider(cfg.model.provider || 'openrouter');
          setApiKey(cfg.model.apiKey || '');
          setModelName(cfg.model.modelName || 'google/gemini-2.5-flash');
          setCustomBaseUrl(cfg.model.customBaseUrl || '');
        }
        if (cfg.theme) { handleThemeChange(cfg.theme); }
        if (cfg.sidebarCollapsed !== undefined) { handleSidebarCollapsedChange(cfg.sidebarCollapsed); }
        if (cfg.fontSize) { handleFontSizeChange(cfg.fontSize); }
        setImportStatus('ok');
        setTimeout(() => setImportStatus('idle'), 3000);
      } catch { setImportStatus('err'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: '30vw', height: '30vw', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '20%', left: '5%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <SettingsIcon size={28} color="var(--primary)" />
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>System Configuration</h1>
        </div>
        <p style={{ color: '#888', marginBottom: '32px', paddingLeft: '40px' }}>
          Configure AI models, appearance, database connections, and export/import settings.
        </p>

        {/* ── Appearance ── */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sun size={18} color="var(--primary)" /> Appearance
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Theme</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['dark', 'light', 'system'] as const).map(t => (
                <button key={t} onClick={() => handleThemeChange(t)}
                  className={`glass-btn ${theme === t ? 'glass-btn-primary' : ''}`}
                  style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t === 'dark' ? <Moon size={14} /> : t === 'light' ? <Sun size={14} /> : <Monitor size={14} />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Sidebar</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={sidebarCollapsed} onChange={e => handleSidebarCollapsedChange(e.target.checked)}
                  style={{ accentColor: '#3b82f6' }} />
                Collapsed sidebar (icons only)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Font Size: {fontSize}px</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#888' }}>10</span>
              <input type="range" min="10" max="20" value={fontSize} onChange={e => handleFontSizeChange(parseInt(e.target.value))}
                style={{ flex: 1, maxWidth: 200, accentColor: '#3b82f6' }} />
              <span style={{ fontSize: 11, color: '#888' }}>20</span>
            </div>
          </div>

          {/* Export / Import */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleExportConfig} className="glass-btn" style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={14} /> Export Config
            </button>
            <label className="glass-btn" style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Upload size={14} /> Import Config
              <input type="file" accept=".json" onChange={handleImportConfig} style={{ display: 'none' }} />
            </label>
            {importStatus === 'ok' && <span style={{ color: '#10b981', fontSize: 12 }}>✓ Imported successfully</span>}
            {importStatus === 'err' && <span style={{ color: '#ef4444', fontSize: 12 }}>✗ Invalid config file</span>}
          </div>
        </div>

        {/* ── Model Config ── */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={18} color="var(--primary)" /> AI Model Configuration
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>API Provider</label>
            <div ref={providerRef} style={{ position: 'relative', maxWidth: '400px' }}>
              <div onClick={() => setShowProviderPicker(!showProviderPicker)}
                style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: provider ? 'var(--text-main)' : 'var(--text-muted)' }}>
                  {PROVIDERS.find(p => p.value === provider)?.label || 'Select provider...'}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{showProviderPicker ? '▲' : '▼'} {PROVIDERS.length}</span>
              </div>
              {showProviderPicker && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: 4, background: 'var(--sidebar-bg)', border: '1px solid var(--card-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', backdropFilter: 'blur(16px)' }}>
                  <div style={{ padding: '8px', borderBottom: '1px solid var(--card-border)' }}>
                    <input type="text" value={providerSearch} onChange={e => setProviderSearch(e.target.value)}
                      placeholder="Search providers..." autoFocus
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: 12, outline: 'none' }} />
                  </div>
                  <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                    {PROVIDERS.filter(p => !providerSearch || p.label.toLowerCase().includes(providerSearch.toLowerCase())).map(p => (
                      <div key={p.value} onClick={() => { setProvider(p.value); setShowProviderPicker(false); setProviderSearch(''); }}
                        style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 12, background: provider === p.value ? 'rgba(255,107,129,0.15)' : 'transparent', color: provider === p.value ? 'var(--primary)' : 'var(--text-sub)', borderLeft: provider === p.value ? '2px solid var(--primary)' : '2px solid transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => { if (provider !== p.value) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                        onMouseLeave={e => { if (provider !== p.value) e.currentTarget.style.background = 'transparent'; }}>
                        {p.label}
                      </div>
                    ))}
                    {PROVIDERS.filter(p => !providerSearch || p.label.toLowerCase().includes(providerSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>No providers match</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {provider === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', animation: 'fadeIn 0.3s ease' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Custom Base URL</label>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Globe size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#94a3b8' }} />
                <input type="text" value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://api.together.xyz/v1 or http://localhost:11434/v1"
                  className="glass-input" style={{ width: '100%', paddingLeft: '48px' }} />
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Connect to local Ollama, LM Studio, Together AI, Groq, or any compatible provider.</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>API Key</label>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Key size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#94a3b8' }} />
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..." className="glass-input" style={{ width: '100%', paddingLeft: '48px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>Target Model</label>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Database size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: '#94a3b8' }} />
              <input type="text" value={modelName} onChange={(e) => setModelName(e.target.value)}
                onFocus={() => setModelSearch(modelName)}
                placeholder="Type or select a model..." list="model-list"
                className="glass-input" style={{ width: '100%', paddingLeft: '48px' }} />
              <datalist id="model-list">
                {(modelSearch
                  ? QUICK_MODELS.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()))
                  : QUICK_MODELS
                ).map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Any model string — {QUICK_MODELS.length}+ presets across {PROVIDERS.length}+ providers
            </span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px', display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            <button onClick={handleSave} className="glass-btn glass-btn-primary" style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '15px' }}>
              <Save size={18} />
              {saved ? 'Configuration Saved!' : 'Save Configuration'}
            </button>
            <button onClick={handleTestConnection} disabled={testing} className="glass-btn" style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '15px' }}>
              {testing ? <RefreshCw size={18} className="connecting-line" /> : <CheckCircle2 size={18} />}
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            {testResult === 'pass' && <span style={{ color: '#10b981', fontSize: 13 }}>✓ Server reachable</span>}
            {testResult === 'fail' && <span style={{ color: '#ef4444', fontSize: 13 }}>✗ Server unreachable</span>}
          </div>
        </div>

        {/* ── Database Configuration ── */}
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={18} color="#f59e0b" /> Database Configuration
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            Zuvix uses <strong>Supabase</strong> (PostgreSQL) for agent memory, logs, and tool registry, and <strong>Appwrite</strong> (NoSQL) for task scheduling.
            Each user can bring their own cloud instances.
          </p>

          {dbStatus && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '8px', background: dbStatus.supabase.hasKey ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${dbStatus.supabase.hasKey ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {dbStatus.supabase.hasKey ? <Wifi size={14} color="#10b981" /> : <WifiOff size={14} color="#ef4444" />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Supabase</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{dbStatus.supabase.url || 'Not configured'}</div>
              </div>
              <div style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '8px', background: dbStatus.appwrite.hasKey ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${dbStatus.appwrite.hasKey ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {dbStatus.appwrite.hasKey ? <Wifi size={14} color="#10b981" /> : <WifiOff size={14} color="#ef4444" />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Appwrite</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{dbStatus.appwrite.projectId || 'Not configured'}</div>
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Database size={16} color="#3b82f6" /> Supabase (PostgreSQL)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Project URL</label>
                  <input type="text" value={sbUrl} onChange={e => setSbUrl(e.target.value)} placeholder="https://xxxxx.supabase.co" className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%' }} />
                </div>
                <div style={{ flex: 3, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Service Role Key (or Anon Key)</label>
                  <input type="password" value={sbKey} onChange={e => setSbKey(e.target.value)} placeholder="eyJ..." className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%' }} />
                </div>
                <button onClick={handleTestSupabase} disabled={sbTesting || !sbUrl || !sbKey} className="glass-btn" style={{ padding: '8px 12px' }}>
                  {sbTesting ? <RefreshCw size={13} className="connecting-line" /> : <Plug size={13} />} Test
                </button>
                {sbTestResult === 'pass' && <span style={{ color: '#10b981', fontSize: 12 }}>✓ Connected</span>}
                {sbTestResult === 'fail' && <span style={{ color: '#ef4444', fontSize: 12 }}>✗ Failed</span>}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Server size={16} color="#f97316" /> Appwrite (NoSQL)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Endpoint</label>
                  <input type="text" value={awEndpoint} onChange={e => setAwEndpoint(e.target.value)} placeholder="https://cloud.appwrite.io/v1" className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%' }} />
                </div>
                <div style={{ flex: 1, minWidth: '120px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>Project ID</label>
                  <input type="text" value={awProjectId} onChange={e => setAwProjectId(e.target.value)} placeholder="zuvixos" className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%' }} />
                </div>
                <div style={{ flex: 2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, color: '#888' }}>API Key</label>
                  <input type="password" value={awKey} onChange={e => setAwKey(e.target.value)} placeholder="standard_..." className="dynamic-input" style={{ fontSize: 12, padding: '8px 12px', width: '100%' }} />
                </div>
                <button onClick={handleTestAppwrite} disabled={awTesting || !awEndpoint || !awProjectId || !awKey} className="glass-btn" style={{ padding: '8px 12px' }}>
                  {awTesting ? <RefreshCw size={13} className="connecting-line" /> : <Plug size={13} />} Test
                </button>
                {awTestResult === 'pass' && <span style={{ color: '#10b981', fontSize: 12 }}>✓ Connected</span>}
                {awTestResult === 'fail' && <span style={{ color: '#ef4444', fontSize: 12 }}>✗ Failed</span>}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleSaveDbConfig} disabled={dbSaving} className="glass-btn glass-btn-primary" style={{ padding: '10px 20px', background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b', color: '#fbbf24' }}>
              <Save size={16} /> {dbSaving ? 'Saving...' : dbSaved ? 'Saved!' : 'Save Database Configuration'}
            </button>
          </div>
        </div>

        <div style={{ padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Server Info</h3>
          <div style={{ fontSize: 12, color: '#888', fontFamily: 'var(--font-mono)' }}>
            <div>API: {config.API_BASE}</div>
            <div>WebSocket: {config.WS_URL}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
