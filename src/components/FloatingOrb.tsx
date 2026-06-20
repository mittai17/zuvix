import { useState, useEffect, useRef } from 'react';
import { Mic, X, Volume2 } from 'lucide-react';
import { useVoice } from '../hooks/useVoice';

const STORAGE_KEY = 'zuvix_orb_position';
const AUTO_HIDE_MS = 8000;
const DRAG_THRESHOLD = 5; // px before it registers as drag

const PLATFORM_COLORS: Record<string, string> = {
  ios: '#8e44ad', android: '#34a853', windows: '#0078d4',
  mac: '#5e5ce6', linux: '#e95420', unknown: '#3b82f6',
};

export default function FloatingOrb() {
  const { state, transcript, platform, startListening, stopListening, alwaysOn, setAlwaysOn } = useVoice();

  const [visible, setVisible] = useState(true);
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: 20, y: 100 };
  });
  const [showMenu, setShowMenu] = useState(false);

  const dragState = useRef<{ startX: number; startY: number; dragging: boolean }>({ startX: 0, startY: 0, dragging: false });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const accent = PLATFORM_COLORS[platform] || '#3b82f6';
  const listening = state === 'listening';
  const processing = state === 'processing';

  // Auto-hide
  useEffect(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!listening && !processing && !showMenu) {
      hideTimer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [listening, processing, showMenu]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, [pos]);

  // Drag handler — uses threshold to distinguish drag from click
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      let cx: number, cy: number;
      if ('touches' in e) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else {
        cx = e.clientX;
        cy = e.clientY;
      }
      const dx = cx - dragState.current.startX;
      const dy = cy - dragState.current.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragState.current.dragging = true;
      }
      if (dragState.current.dragging) {
        e.preventDefault();
        setPos((p: {x: number, y: number}) => ({
          x: Math.max(0, Math.min(window.innerWidth - 56, p.x + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 56, p.y + dy)),
        }));
        dragState.current.startX = cx;
        dragState.current.startY = cy;
      }
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      let cx: number, cy: number;
      if ('touches' in e) {
        cx = e.touches[0].clientX;
        cy = e.touches[0].clientY;
      } else {
        cx = e.clientX;
        cy = e.clientY;
      }
      dragState.current = { startX: cx, startY: cy, dragging: false };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: true });

    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('touchstart', onDown);
      onEnd();
    };
  }, []);

  const handleTap = () => {
    if (dragState.current.dragging) return;
    if (listening) {
      stopListening();
    } else {
      setShowMenu(v => !v);
    }
  };

  return (
    <>
      {visible && (
        <div
          ref={containerRef}
          onClick={handleTap}
          style={{
            position: 'fixed', left: pos.x, top: pos.y, zIndex: 2147483647,
            width: 56, height: 56, borderRadius: '50%',
            background: listening
              ? `radial-gradient(circle at 30% 30%, ${accent}, ${accent}88)`
              : 'rgba(15, 23, 42, 0.85)',
            border: `2px solid ${listening ? accent : 'rgba(255,255,255,0.1)'}`,
            boxShadow: listening
              ? `0 0 30px ${accent}44, 0 0 60px ${accent}22, 0 4px 20px rgba(0,0,0,0.3)`
              : '0 4px 20px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', userSelect: 'none', touchAction: 'none',
            transition: listening ? 'box-shadow 0.3s, border-color 0.3s, background 0.3s' : 'box-shadow 0.3s, border-color 0.3s, background 0.3s',
            animation: listening ? 'orbPulse 1.5s ease-in-out infinite' : 'none',
          }}
        >
          {listening && (
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: `2px solid ${accent}33`,
              animation: 'orbRing 2s ease-in-out infinite',
            }} />
          )}

          {processing ? (
            <div style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%', background: accent,
                  animation: `orbDot 1s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          ) : listening ? (
            <Volume2 size={22} color="#fff" style={{ animation: 'orbIcon 0.5s ease-in-out infinite alternate' }} />
          ) : (
            <Mic size={22} color={accent} />
          )}

          <div style={{
            position: 'absolute', bottom: -2, right: -2, width: 16, height: 16,
            borderRadius: '50%', background: accent,
            border: '2px solid rgba(15, 23, 42, 0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, fontWeight: 700, color: '#fff',
          }}>
            {platform === 'ios' || platform === 'mac' ? '' : platform === 'android' ? '▶' : platform === 'windows' ? '⊞' : 'Z'}
          </div>
        </div>
      )}

      {showMenu && !listening && (
        <div style={{
          position: 'fixed', left: pos.x + 60, top: pos.y, zIndex: 2147483646,
          background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 8,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130,
        }}>
          <button onClick={() => { startListening(); setShowMenu(false); }}
            style={menuBtn}>
            <Mic size={14} color={accent} /> Listen
          </button>
          <button onClick={() => { setAlwaysOn(!alwaysOn); setShowMenu(false); }}
            style={{ ...menuBtn, color: alwaysOn ? accent : '#e2e8f0' }}>
            <Volume2 size={14} color={alwaysOn ? accent : '#888'} /> {alwaysOn ? 'Always-on ON' : 'Always-on'}
          </button>
          <button onClick={() => setVisible(false)}
            style={{ ...menuBtn, color: '#ef4444' }}>
            <X size={14} /> Hide
          </button>
        </div>
      )}

      {listening && transcript && (
        <div style={{
          position: 'fixed', left: Math.max(10, pos.x - 20), top: pos.y - 50,
          zIndex: 2147483646,
          background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
          padding: '6px 14px', fontSize: 12, color: '#e2e8f0',
          maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }}>
          {transcript}
        </div>
      )}

      <style>{`
        @keyframes orbPulse {
          0%, 100% { box-shadow: 0 0 20px ${accent}33, 0 4px 20px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 40px ${accent}66, 0 0 80px ${accent}22, 0 4px 20px rgba(0,0,0,0.3); }
        }
        @keyframes orbRing {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes orbDot {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.5); opacity: 1; }
        }
        @keyframes orbIcon {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </>
  );
}

const menuBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
  borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.04)',
  color: '#e2e8f0', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'left',
};
