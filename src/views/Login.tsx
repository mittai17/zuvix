import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, Eye, EyeOff, User as UserIcon } from 'lucide-react';
import { QUOTES } from '../components/ZuvixFaceTraits';
import ZuvixFace from '../components/ZuvixFace';

function Typewriter({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.substring(0, i + 1));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span>
      {displayed}
      <span style={{ animation: 'blink 1s step-end infinite' }}>|</span>
    </span>
  );
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  delay: number;
  wobble: number;
  opacity: number;
}

function generateBubbles(count: number): Bubble[] {
  const bubbles: Bubble[] = [];
  for (let i = 0; i < count; i++) {
    bubbles.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 20 + Math.random() * 60,
      speed: 0.2 + Math.random() * 0.4,
      delay: Math.random() * 8,
      wobble: Math.random() * 6 - 3,
      opacity: 0.08 + Math.random() * 0.12,
    });
  }
  return bubbles;
}

function FloatingBubbles({ active }: { active: string }) {
  const bubblesRef = useRef<Bubble[]>(generateBubbles(14));
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      setPhase(p => p + 0.005);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {bubblesRef.current.map((b) => {
        const vy = (b.y + phase * b.speed * 10) % 120 - 10;
        const vx = b.x + Math.sin(phase * b.wobble + b.delay) * 8;
        const scale = active === 'engaged' ? 1 + 0.15 * Math.sin(phase * 2 + b.id) : 1;
        return (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: `${vx}%`,
              top: `${vy}%`,
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background: active === 'error'
                ? 'radial-gradient(circle at 30% 30%, rgba(239,68,68,0.15), rgba(239,68,68,0.05))'
                : active === 'success'
                ? 'radial-gradient(circle at 30% 30%, rgba(34,197,94,0.15), rgba(34,197,94,0.05))'
                : 'radial-gradient(circle at 30% 30%, rgba(255,182,193,0.2), rgba(255,105,180,0.08))',
              border: active === 'error'
                ? '1px solid rgba(239,68,68,0.1)'
                : '1px solid rgba(255,182,193,0.15)',
              transform: `translateY(${Math.sin(phase * b.speed + b.delay) * 12}px) scale(${scale})`,
              transition: 'background 0.6s ease, border 0.6s ease',
              opacity: b.opacity,
              boxShadow: `0 8px 32px rgba(255,105,180,0.06), inset -4px -4px 12px rgba(255,182,193,0.1), inset 4px 4px 12px rgba(255,255,255,0.3)`,
              backdropFilter: 'blur(4px)',
              willChange: 'transform',
            }}
          />
        );
      })}
    </div>
  );
}

export default function Login() {
  const { login, signup, signInWithGithub, checkUsername } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  
  const [isSignup, setIsSignup] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Quote rotation
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIdx(i => (i + 1) % QUOTES.length);
    }, 6000); // 6 seconds per quote
    return () => clearInterval(interval);
  }, []);

  // Username checking logic
  useEffect(() => {
    if (!isSignup || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const delay = setTimeout(async () => {
      const available = await checkUsername(username);
      setUsernameAvailable(available);
    }, 500); // debounce

    return () => clearTimeout(delay);
  }, [username, isSignup, checkUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isSignup && usernameAvailable === false) {
      setError('Please choose a different username.');
      window.dispatchEvent(new CustomEvent('zuvix-emotion', { detail: 'error' }));
      return;
    }

    setBusy(true);

    const err = isSignup
      ? await signup(email, password, username)
      : await login(email, password);

    if (err) {
      setError(err);
      window.dispatchEvent(new CustomEvent('zuvix-emotion', { detail: 'error' }));
    } else if (isSignup) {
      setSuccessMsg('Signup successful! Please check your email.');
      window.dispatchEvent(new CustomEvent('zuvix-emotion', { detail: 'success' }));
    } else {
      window.dispatchEvent(new CustomEvent('zuvix-emotion', { detail: 'success' }));
    }
    setBusy(false);
  };

  const handleInputFocus = () => window.dispatchEvent(new CustomEvent('zuvix-emotion', { detail: 'engaged' }));
  const handleBlur = () => window.dispatchEvent(new CustomEvent('zuvix-emotion', { detail: 'idle' }));

  return (
    <div style={{
      display: 'flex', width: '100%', height: '100vh', position: 'relative', overflow: 'hidden'
    }}>
      <FloatingBubbles active={error ? 'error' : 'idle'} />

      {/* Left Side: Mascot / Welcome Board */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', zIndex: 10, padding: '40px', color: '#ff6b81', position: 'relative'
      }} className="desktop-only-flex">

        {/* The Main ZuvixFace Character */}
        <div style={{ marginBottom: '40px', zIndex: 10 }}>
          <ZuvixFace state={error ? 'error' : successMsg ? 'success' : 'idle'} globalRoam={false} />
        </div>

        <h2 className="font-zuvix-title" style={{ fontSize: '48px', marginBottom: '16px', textAlign: 'center' }}>
          Zuvix
        </h2>
        <div style={{ 
          fontSize: '20px', fontWeight: 500, textAlign: 'center',
          opacity: 0.8, maxWidth: '80%', height: '30px'
        }}>
          "<Typewriter text={QUOTES[quoteIdx]} />"
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '20px'
      }}>
        <div className="glass-panel" style={{
          width: '100%', maxWidth: '400px', padding: '40px',
          boxShadow: '10px 10px 40px rgba(255, 182, 193, 0.2)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 className="font-zuvix" style={{ fontSize: '28px', color: '#5c4d50', margin: 0 }}>
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {isSignup && (
              <div style={{ position: 'relative' }}>
                <UserIcon size={18} style={{ position: 'absolute', left: 16, top: 14, color: '#ffb6c1' }} />
                <input 
                  type="text" placeholder="Username" required value={username}
                  onFocus={handleInputFocus} onBlur={handleBlur}
                  onChange={e => setUsername(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px 12px 42px',
                    borderRadius: '16px', border: '1px solid rgba(255,182,193,0.3)',
                    background: 'rgba(255,255,255,0.5)', outline: 'none', color: '#5c4d50', fontWeight: 500
                  }} 
                />
                {username.length >= 3 && (
                  <span style={{ 
                    position: 'absolute', right: 16, top: 14, fontSize: '12px', 
                    fontWeight: 'bold', color: usernameAvailable ? '#22c55e' : '#ef4444' 
                  }}>
                    {usernameAvailable ? 'Available' : 'Taken'}
                  </span>
                )}
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 16, top: 14, color: '#ffb6c1' }} />
              <input type="email" placeholder="Email Address" required value={email}
                onFocus={handleInputFocus} onBlur={handleBlur}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px 12px 42px',
                  borderRadius: '16px', border: '1px solid rgba(255,182,193,0.3)',
                  background: 'rgba(255,255,255,0.5)', outline: 'none', color: '#5c4d50', fontWeight: 500
                }} />
            </div>

            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: 16, top: 14, color: '#ffb6c1' }} />
              <input type={showPw ? 'text' : 'password'} placeholder="Password" required minLength={6} value={password}
                onFocus={handleInputFocus} onBlur={handleBlur}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px 12px 42px',
                  borderRadius: '16px', border: '1px solid rgba(255,182,193,0.3)',
                  background: 'rgba(255,255,255,0.5)', outline: 'none', color: '#5c4d50', fontWeight: 500
                }} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: 16, top: 14, background: 'none', border: 'none', color: '#ffb6c1', cursor: 'pointer' }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: '14px', textAlign: 'center', background: 'rgba(239,68,68,0.1)', padding: '8px', borderRadius: '8px' }}>{error}</div>}
            {successMsg && <div style={{ color: '#22c55e', fontSize: '14px', textAlign: 'center', background: 'rgba(34,197,94,0.1)', padding: '8px', borderRadius: '8px' }}>{successMsg}</div>}

            <button type="submit" disabled={busy} className="clay-button" style={{ padding: '14px', fontSize: '16px', marginTop: '8px' }}>
              {busy ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', opacity: 0.5 }}>
            <div style={{ flex: 1, height: '1px', background: '#ffb6c1' }} />
            <span style={{ margin: '0 12px', fontSize: '12px', fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: '#ffb6c1' }} />
          </div>

          <button onClick={signInWithGithub} style={{
            width: '100%', padding: '12px', borderRadius: '16px',
            background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,182,193,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            color: '#5c4d50', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
          }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#887' }}>
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsSignup(v => !v); setError(''); setSuccessMsg(''); window.dispatchEvent(new CustomEvent('zuvix-emotion', { detail: 'idle' })); }}
              style={{ background: 'none', border: 'none', color: '#ff6b81', fontWeight: 'bold', cursor: 'pointer' }}>
              {isSignup ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
