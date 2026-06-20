// JARVIS TalkMode — full-screen immersive voice interface with stable waveform, wake word, and platform branding
import { useEffect, useRef, useState } from 'react';
import { useVoice } from '../hooks/useVoice';
import { Mic, MicOff, Volume2, Moon, Sun } from 'lucide-react';

const PLATFORM_COLORS: Record<string, string> = {
  ios: '#8e44ad', android: '#34a853', windows: '#0078d4',
  mac: '#5e5ce6', linux: '#e95420', unknown: '#3b82f6',
};
const PLATFORM_NAMES: Record<string, string> = {
  ios: 'iOS', android: 'Android', windows: 'Windows', mac: 'macOS', linux: 'Linux', unknown: 'Desktop',
};

export default function TalkMode() {
  const { state, transcript, audioLevel, platform, alwaysOn, setAlwaysOn, wakeWordEnabled, setWakeWordEnabled, startListening, stopListening } = useVoice();
  const [darkMode, setDarkMode] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const accent = PLATFORM_COLORS[platform] || '#3b82f6';

  // Stable animation loop — reads refs instead of deps
  const audioLevelRef = useRef(audioLevel);
  const listeningRef = useRef(state === 'listening');
  audioLevelRef.current = audioLevel;
  listeningRef.current = state === 'listening';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const level = audioLevelRef.current;
      const isListening = listeningRef.current;
      const bars = 64;
      const barW = w / bars;
      const cy = h / 2;
      const t = Date.now() / 1000;

      for (let i = 0; i < bars; i++) {
        const phase = i / bars;
        const amp = isListening ? (h * 0.4) * (0.15 + level * 0.85) : h * 0.04;
        const barH = Math.max(2, amp * (0.5 + 0.5 * Math.sin(t * (2 + level * 4) + phase * Math.PI * 4)));
        const x = i * barW;
        const grad = ctx.createLinearGradient(x, cy - barH, x, cy + barH);
        grad.addColorStop(0, `${accent}88`);
        grad.addColorStop(0.5, accent);
        grad.addColorStop(1, `${accent}88`);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, cy - barH / 2, barW - 2, barH);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [accent]);

  const toggle = () => {
    if (state === 'listening') stopListening();
    else startListening();
  };

  return (
    <div style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
      background: darkMode ? '#0a0a0f' : '#f0f0f5',
      color: darkMode ? '#e2e8f0' : '#1a1a2e',
      overflow: 'hidden', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '40%', left: '50%', translate: '-50% -50%',
        width: '60vh', height: '60vh', borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}11 0%, ${accent}08 40%, transparent 70%)`,
        pointerEvents: 'none', transition: 'opacity 0.5s',
        opacity: state === 'listening' ? 1 : 0.3,
      }} />

      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '16px 24px', position: 'relative', zIndex: 2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${accent}22`, border: `1px solid ${accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: accent,
          }}>
            {platform === 'ios' || platform === 'mac' ? '' : platform === 'android' ? '▶' : platform === 'windows' ? '⊞' : 'Z'}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6 }}>JARVIS · {PLATFORM_NAMES[platform]}</div>
            <div style={{ fontSize: 10, opacity: 0.35, marginTop: 1 }}>
              {state === 'idle' ? 'Press space or tap mic' :
               state === 'listening' ? alwaysOn ? 'Always listening' : 'Listening' :
               state === 'processing' ? 'Processing' :
               state === 'speaking' ? 'Speaking' : ''}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
            title="Wake word"
            style={tagStyle(wakeWordEnabled, accent)}>
            <Volume2 size={12} /> WAKE
          </button>
          <button onClick={() => setAlwaysOn(!alwaysOn)}
            title="Always-on"
            style={tagStyle(alwaysOn, accent)}>
            <Volume2 size={12} /> {alwaysOn ? 'ON' : 'AWAKE'}
          </button>
          <button onClick={() => setDarkMode(v => !v)}
            style={{ padding: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#888', cursor: 'pointer' }}>
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Center */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div onClick={toggle} style={{
          width: 120, height: 120, borderRadius: '50%', cursor: 'pointer',
          background: state === 'listening'
            ? `radial-gradient(circle at 35% 35%, ${accent}88, ${accent}44)`
            : darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: `2px solid ${state === 'listening' ? accent + '66' : 'rgba(255,255,255,0.06)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: state === 'listening' ? `0 0 60px ${accent}33, 0 0 120px ${accent}11` : 'none',
          transition: 'all 0.4s',
          animation: state === 'listening' ? 'jb 3s ease-in-out infinite' : 'none',
        }}>
          {state === 'processing' ? (
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%', background: accent,
                  animation: `jd 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          ) : state === 'listening' ? (
            <Volume2 size={36} color="#fff" style={{ animation: 'ji 0.8s ease-in-out infinite alternate' }} />
          ) : (
            <Mic size={36} color={accent} style={{ opacity: 0.8 }} />
          )}
        </div>

        {transcript && (
          <div style={{
            marginTop: 24, fontSize: 18, textAlign: 'center',
            color: darkMode ? '#e2e8f0' : '#1a1a2e',
            fontWeight: 500, maxWidth: '80%', lineHeight: 1.5,
            opacity: state === 'listening' ? 1 : 0.5, minHeight: 28,
            transition: 'opacity 0.3s',
          }}>
            {transcript}
          </div>
        )}

        {!transcript && state === 'listening' && (
          <div style={{
            marginTop: 20, fontSize: 13, color: accent, opacity: 0.6,
            animation: 'jp 2s ease-in-out infinite',
          }}>
            Listening{platform === 'ios' ? ' on iPhone' : platform === 'android' ? ' on Android' : ''}...
          </div>
        )}

        {state === 'idle' && !transcript && (
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 400 }}>
            {['Open browser', 'Check system', 'Search the web', 'Send a message', 'Analyze this image', 'Run a command'].map(s => (
              <span key={s} style={{
                padding: '8px 16px', borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)',
                color: darkMode ? '#888' : '#666', fontSize: 12,
              }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{
        position: 'absolute', bottom: 0, left: 0, width: '100%', height: 180,
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Bottom mic */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        padding: '24px 20px 32px', position: 'relative', zIndex: 2,
      }}>
        <button onClick={toggle} style={{
          width: 72, height: 72, borderRadius: '50%', cursor: 'pointer',
          background: state === 'listening' ? `${accent}33` : 'rgba(255,255,255,0.04)',
          border: `2px solid ${state === 'listening' ? accent + '88' : 'rgba(255,255,255,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.25s',
          boxShadow: state === 'listening' ? `0 0 30px ${accent}33` : 'none',
        }}>
          {state === 'listening' ? <MicOff size={28} color="#ef4444" /> : <Mic size={28} color={accent} />}
        </button>
      </div>

      <style>{`
        @keyframes jb { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes jd { 0%,100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-8px); opacity: 1; } }
        @keyframes ji { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.15); opacity: 1; } }
        @keyframes jp { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }
      `}</style>
    </div>
  );
}

function tagStyle(active: boolean, accent: string): React.CSSProperties {
  return {
    padding: '6px 10px', borderRadius: 8,
    border: `1px solid ${active ? accent + '66' : 'rgba(255,255,255,0.08)'}`,
    background: active ? `${accent}22` : 'rgba(255,255,255,0.04)',
    color: active ? accent : '#888', fontSize: 10, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
  };
}
