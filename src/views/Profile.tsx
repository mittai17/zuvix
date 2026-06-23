/* src/views/Profile.tsx */
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { User, Mail, Calendar, LogOut, Shield } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  
  if (!user) return null;

  const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Zuvix User';
  const createdAt = user.created_at 
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', position: 'relative' }}>
      {/* Background gradients */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(255,107,129,0.08) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(255,182,193,0.08) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <User size={28} color="var(--primary)" />
          <h1 className="font-zuvix-title" style={{ fontSize: '28px', fontWeight: 700 }}>Operator Profile</h1>
        </div>
        
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', textAlign: 'center' }}>
          {/* Avatar Area */}
          <div style={{ position: 'relative' }}>
            <div style={{ 
              width: '100px', height: '100px', borderRadius: '50%', 
              background: 'linear-gradient(135deg, #ff9a9e, #fecfef)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--card-shadow)', border: '3px solid white'
            }}>
              <span style={{ fontSize: '36px', color: 'white', fontWeight: 800 }}>
                {username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ 
              position: 'absolute', bottom: '0', right: '0', 
              width: '30px', height: '30px', borderRadius: '50%', 
              backgroundColor: 'var(--primary)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', border: '2px solid white'
            }}>
              <Shield size={14} color="white" />
            </div>
          </div>

          <div>
            <h2 className="font-zuvix-title" style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 4px' }}>
              {username}
            </h2>
            <span style={{ 
              fontSize: '11px', padding: '4px 10px', borderRadius: '12px', 
              fontWeight: 600, backgroundColor: 'rgba(255,107,129,0.15)', color: 'var(--primary)'
            }}>
              Active Session
            </span>
          </div>

          {/* User Details Grid */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', 
              background: 'rgba(255,255,255,0.2)', borderRadius: '12px', border: '1px solid var(--card-border)' 
            }}>
              <Mail size={18} color="var(--primary)" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase' }}>Email Address</div>
                <div style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>{user.email}</div>
              </div>
            </div>

            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', 
              background: 'rgba(255,255,255,0.2)', borderRadius: '12px', border: '1px solid var(--card-border)' 
            }}>
              <Calendar size={18} color="var(--primary)" />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase' }}>Member Since</div>
                <div style={{ fontSize: '14px', color: 'var(--text-main)', fontWeight: 500 }}>{createdAt}</div>
              </div>
            </div>
          </div>

          {/* Logout Action */}
          <div style={{ width: '100%', marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <button onClick={logout} className="clay-btn" style={{ 
              width: '100%', maxWidth: '200px', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', gap: '8px' 
            }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
