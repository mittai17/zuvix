import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { config } from '../config';

const API = config.API_BASE;

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';
type Platform = 'ios' | 'android' | 'windows' | 'mac' | 'linux' | 'unknown';

export interface VoiceContextValue {
  state: VoiceState;
  transcript: string;
  audioLevel: number;
  platform: Platform;
  alwaysOn: boolean;
  wakeWordEnabled: boolean;
  setAlwaysOn: (v: boolean) => void;
  setWakeWordEnabled: (v: boolean) => void;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => Promise<void>;
  processAndSpeak: (text: string) => Promise<void>;
}

const WakeWords = ['hey zuvix', 'jarvis', 'hey jarvis', 'zu vix', 'zuvix'];
const VoiceContext = createContext<VoiceContextValue | null>(null);

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'unknown';
}

export function VoiceProvider({ children, onError }: { children: ReactNode; onError?: (err: string) => void }) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [platform] = useState(detectPlatform);
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);

  // Mutable refs to avoid stale closures in recognition handlers
  const stateRef = useRef(state);
  const transcriptRef = useRef('');
  const wakeBufRef = useRef('');
  const finalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef(window.speechSynthesis);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);
  const alwaysOnRef = useRef(alwaysOn);
  const wakeWordRef = useRef(wakeWordEnabled);

  // Sync refs
  stateRef.current = state;
  alwaysOnRef.current = alwaysOn;
  wakeWordRef.current = wakeWordEnabled;

  // Audio level monitor
  const startAudioMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        setAudioLevel(Math.min(1, buf.reduce((a, b) => a + b, 0) / buf.length / 128));
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* mic denied — silent fallback */ }
  }, []);

  const stopAudioMonitor = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    setAudioLevel(0);
  }, []);

  // Wake word check — returns true if activated
  const checkWakeWord = useCallback((text: string): boolean => {
    if (!wakeWordRef.current || stateRef.current !== 'idle') return false;
    wakeBufRef.current = (wakeBufRef.current + ' ' + text.toLowerCase()).slice(-150);
    return WakeWords.some(w => wakeBufRef.current.includes(w));
  }, []);

  const processCurrentTranscript = useCallback(() => {
    const text = transcriptRef.current;
    if (!text) return;
    setTranscript(text);
    setState('processing');
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError?.('Speech recognition not supported'); return; }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e: any) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const text = final || interim;
      transcriptRef.current = text;
      setTranscript(text);

      // Wake word check (idle + wake-word mode)
      if (stateRef.current === 'idle' && checkWakeWord(text)) {
        setState('listening');
        startAudioMonitor();
        return;
      }

      // Auto-process after 1.2s silence in listening mode
      if (final && stateRef.current === 'listening') {
        if (finalTimerRef.current) clearTimeout(finalTimerRef.current);
        finalTimerRef.current = setTimeout(processCurrentTranscript, 1200);
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      onError?.(`Recognition: ${e.error}`);
    };

    recognition.onend = () => {
      if (finalTimerRef.current) { clearTimeout(finalTimerRef.current); finalTimerRef.current = null; }
      const s = stateRef.current;
      if (s === 'processing') return; // effect will handle it
      if (alwaysOnRef.current) {
        setState('idle');
        try { recognition.start(); } catch {}
        return;
      }
      setState('idle');
    };

    recognitionRef.current = recognition;
    setState('listening');
    startAudioMonitor();
    recognition.start();
  }, [checkWakeWord, startAudioMonitor, processCurrentTranscript, onError]);

  const stopListening = useCallback(() => {
    if (finalTimerRef.current) { clearTimeout(finalTimerRef.current); finalTimerRef.current = null; }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopAudioMonitor();
    setTranscript('');
    transcriptRef.current = '';
    setState('idle');
  }, [stopAudioMonitor]);

  const speak = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      if (!synthRef.current) { resolve(); return; }
      synthRef.current.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voices = synthRef.current.getVoices();
      if (platform === 'ios' || platform === 'mac') {
        const v = voices.find(v => v.name.includes('Samantha') || v.name.includes('Enhanced'));
        if (v) u.voice = v;
      } else if (platform === 'android') {
        const v = voices.find(v => v.name.includes('Google') || v.name.includes('Wavenet'));
        if (v) u.voice = v;
      }
      u.rate = (platform === 'ios' || platform === 'mac') ? 1.0 : 1.1;
      u.onstart = () => setState('speaking');
      u.onend = () => { setState('idle'); resolve(); };
      u.onerror = () => { setState('idle'); resolve(); };
      synthRef.current.speak(u);
    });
  }, [platform]);

  const processAndSpeak = useCallback(async (text: string) => {
    setState('processing');
    try {
      const res = await fetch(`${API}/api/agent/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, platform }),
      });
      const data = await res.json();
      const response = data.response || 'I processed your request.';
      await speak(response);
    } catch (err: any) {
      onError?.(err.message);
      await speak('Sorry, I encountered an error.');
    }
  }, [platform, speak, onError]);

  // When state flips to 'processing' with transcript, call processAndSpeak
  useEffect(() => {
    if (state === 'processing' && transcript) {
      processAndSpeak(transcript);
    }
  }, [state]);

  // Always-on auto-restart
  useEffect(() => {
    if (alwaysOn && state === 'idle') {
      const t = setTimeout(startListening, 300);
      return () => clearTimeout(t);
    }
  }, [alwaysOn, state, startListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopAudioMonitor();
      synthRef.current?.cancel();
    };
  }, [stopAudioMonitor]);

  return (
    <VoiceContext.Provider value={{
      state, transcript, audioLevel, platform,
      alwaysOn, wakeWordEnabled,
      setAlwaysOn, setWakeWordEnabled,
      startListening, stopListening, speak, processAndSpeak,
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider');
  return ctx;
}
