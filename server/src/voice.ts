// Voice/Talk Mode — TTS (edge-tts) + STT (whisper) integration
// Inspired by OpenClaw's Talk Mode. Minimal dependencies.

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const VOICE_DIR = path.join(__dirname, '..', 'voice-cache');
if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

// ─── Text-to-Speech ────────────────────────────────────────────────────────────
// Uses edge-tts (edge.microsoft.com TTS, free, no key)
// Install: pip install edge-tts

export async function textToSpeech(text: string, voice: string = 'en-US-JennyNeural'): Promise<Buffer> {
  const hash = Buffer.from(`${voice}:${text}`).toString('base64').slice(0, 32);
  const cachePath = path.join(VOICE_DIR, `${hash}.mp3`);

  // Check cache
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath);
  }

  try {
    execSync(
      `edge-tts --voice "${voice}" --text "${text.replace(/"/g, '\\"')}" --write-media "${cachePath}"`,
      { timeout: 30000, stdio: 'pipe' }
    );
    return fs.readFileSync(cachePath);
  } catch {
    // Fallback: generate a minimal WAV with ffmpeg/sox if available, or return error
    throw new Error('TTS failed. Install: pip install edge-tts');
  }
}

// ─── Speech-to-Text ────────────────────────────────────────────────────────────
// Uses OpenAI Whisper API or local whisper.cpp
// Set WHISPER_API_KEY or WHISPER_MODEL_PATH

export async function speechToText(audioBase64: string, mimeType?: string): Promise<string> {
  const apiKey = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY;

  if (apiKey) {
    // Use OpenAI Whisper API
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    const form = new FormData();
    form.append('file', blob, 'audio.wav');
    form.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Whisper API error: ${res.status} ${errText}`);
    }

    const data: any = await res.json();
    return data.text || '';
  }

  // Check for local whisper.cpp
  try {
    const hash = Buffer.from(audioBase64.slice(0, 64)).toString('base64').slice(0, 16);
    const tmpPath = path.join(VOICE_DIR, `${hash}.wav`);
    fs.writeFileSync(tmpPath, Buffer.from(audioBase64, 'base64'));

    const whisperBin = process.env.WHISPER_BIN || 'whisper';
    const modelPath = process.env.WHISPER_MODEL_PATH || path.join(__dirname, '..', 'models', 'ggml-base.en.bin');
    const out = execSync(
      `"${whisperBin}" -m "${modelPath}" -f "${tmpPath}" -otxt 2>/dev/null`,
      { timeout: 60000 }
    );
    const txtPath = tmpPath.replace('.wav', '.txt');
    if (fs.existsSync(txtPath)) {
      const result = fs.readFileSync(txtPath, 'utf-8').trim();
      fs.unlinkSync(txtPath);
      return result;
    }
    return out.toString().trim();
  } catch {
    throw new Error('STT unavailable. Set WHISPER_API_KEY, OPENAI_API_KEY, or install whisper.cpp');
  }
}

export function listVoices(): string[] {
  return [
    'en-US-JennyNeural', 'en-US-GuyNeural', 'en-US-AriaNeural',
    'en-GB-SoniaNeural', 'en-GB-RyanNeural',
    'en-AU-NatashaNeural', 'en-AU-WilliamNeural',
    'ja-JP-NanamiNeural', 'ja-JP-KeitaNeural',
    'zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural',
    'fr-FR-DeniseNeural', 'fr-FR-HenriNeural',
    'de-DE-KatjaNeural', 'de-DE-ConradNeural',
    'es-ES-ElviraNeural', 'es-ES-AlvaroNeural',
    'ko-KR-SunHiNeural', 'ko-KR-InJoonNeural',
  ];
}
