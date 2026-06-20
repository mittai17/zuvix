import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Cpu, Mail, Lock, Eye, EyeOff, Globe } from 'lucide-react';

export default function Login() {
  const { login, signup, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const err = isSignup
      ? await signup(email, password)
      : await login(email, password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, padding: 40,
        background: 'rgba(15, 23, 42, 0.6)', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Cpu size={28} color="#60a5fa" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Zuvix OS</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', translate: '0 -50%', color: '#666' }} />
            <input type="email" placeholder="Email" required value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle} />
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', translate: '0 -50%', color: '#666' }} />
            <input type={showPw ? 'text' : 'password'} placeholder="Password" required minLength={6} value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle} />
            <button type="button" onClick={() => setShowPw(v => !v)}
              style={{ position: 'absolute', right: 12, top: '50%', translate: '0 -50%', background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0 }}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={busy}
            style={{
              padding: '12px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}>
            {busy ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: 11, color: '#555' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        <button onClick={signInWithGoogle}
          style={{
            width: '100%', padding: '12px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)', cursor: 'pointer',
            color: '#e2e8f0', fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          <Globe size={18} /> Continue with Google
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#666', marginTop: 20 }}>
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsSignup(v => !v); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, padding: 0 }}>
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 12px 12px 40px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.06)',
  background: 'rgba(0,0,0,0.3)',
  color: '#e2e8f0', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};
