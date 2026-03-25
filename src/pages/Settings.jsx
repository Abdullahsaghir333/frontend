import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { Bell, Search, User, Volume2, Shield, Trash2 } from 'lucide-react';

const C = {
  bg: '#0a0a0a',
  sidebar: '#0d0d0d',
  card: '#111111',
  cardBorder: '#1e1e1e',
  lime: '#c8e000',
  limeDim: 'rgba(200,224,0,0.12)',
  limeBorder: 'rgba(200,224,0,0.25)',
  white: '#ffffff',
  muted: '#555',
  soft: '#888',
  text: '#ccc',
};


const Toggle = ({ enabled, onChange }) => (
  <div onClick={() => onChange(!enabled)} style={{
    width: 44, height: 24, borderRadius: 99, cursor: 'pointer',
    background: enabled ? C.lime : '#2a2a2a',
    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
  }}>
    <div style={{
      position: 'absolute', top: 3,
      left: enabled ? 23 : 3,
      width: 18, height: 18, borderRadius: '50%',
      background: enabled ? '#0a0a0a' : '#555',
      transition: 'left 0.2s',
    }} />
  </div>
);

const SectionCard = ({ icon: Icon, title, subtitle, children }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.cardBorder}`,
    borderRadius: 12, padding: '22px 24px', marginBottom: 16,
    animation: 'fadeUp 0.4s ease both', maxWidth: 660,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <Icon size={16} color={C.lime} />
      <span style={{ color: C.white, fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{title}</span>
    </div>
    <p style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif', margin: '0 0 20px' }}>{subtitle}</p>
    {children}
  </div>
);

const ToggleRow = ({ label, sub, enabled, onChange }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', borderTop: `1px solid ${C.cardBorder}`,
  }}>
    <div>
      <div style={{ color: C.white, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', marginBottom: 3 }}>{label}</div>
      <div style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif' }}>{sub}</div>
    </div>
    <Toggle enabled={enabled} onChange={onChange} />
  </div>
);

const labelStyle = {
  display: 'block', marginBottom: 7,
  color: '#888', fontSize: 12, fontFamily: 'sans-serif', fontWeight: 500,
};

const inputStyle = {
  width: '100%', padding: '11px 14px',
  background: '#0a0a0a', border: `1px solid #1e1e1e`,
  borderRadius: 8, color: '#ffffff', fontSize: 14,
  fontFamily: 'sans-serif', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
};

// ══════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { user, checkAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Preferences (UI only for now as per schema)
  const [pushNotifs, setPushNotifs] = useState(true);
  const [focusAlerts, setFocusAlerts] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoCamera, setAutoCamera] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);

  const handleUpdateProfile = async () => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      await api.post('/users/profile', { name });
      await checkAuth(); // Refresh user context
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (password.next !== password.confirm) {
      setMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      await api.post('/users/password', {
        currentPassword: password.current,
        newPassword: password.next
      });
      setMsg({ type: 'success', text: 'Password changed successfully!' });
      setPassword({ current: '', next: '', confirm: '' });
      setShowPwdModal(false);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>

    <Sidebar />

    {/* ── MAIN ── */}
    <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* Topbar */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 60, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px',
      }}>
        <div>
          <div style={{ color: C.white, fontWeight: 700, fontSize: 18, fontFamily: 'Georgia, serif' }}>Settings</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 1, fontFamily: 'sans-serif' }}>Manage your account and preferences</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '7px 13px' }}>
            <Search size={13} color={C.muted} />
            <input placeholder="Search sessions, notes…" style={{ background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13, width: 170, fontFamily: 'sans-serif' }} />
          </div>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#111', border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <Bell size={15} color={C.muted} />
            <div style={{ position: 'absolute', top: 6, right: 7, width: 6, height: 6, borderRadius: '50%', background: C.lime }} />
          </div>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#0a0a0a' }}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* Body */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px' }}>

        {msg.text && (
            <div style={{ 
                maxWidth: 660, padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                background: msg.type === 'success' ? 'rgba(200,224,0,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${msg.type === 'success' ? C.limeBorder : 'rgba(239,68,68,0.3)'}`,
                color: msg.type === 'success' ? C.lime : '#f87171',
                fontSize: 13, fontFamily: 'sans-serif'
            }}>
                {msg.text}
            </div>
        )}

        <SectionCard icon={User} title="Profile" subtitle="Manage your personal information">
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle}
              onFocus={e => e.target.style.borderColor = C.lime}
              onBlur={e => e.target.style.borderColor = C.cardBorder}
            />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input value={user?.email || ''} disabled style={{ ...inputStyle, color: C.muted, cursor: 'not-allowed' }} />
            <p style={{ color: C.muted, fontSize: 11, fontFamily: 'sans-serif', marginTop: 6 }}>Email cannot be changed</p>
          </div>
          <button 
            onClick={handleUpdateProfile}
            disabled={loading}
            style={{ marginTop: 20, padding: '9px 20px', borderRadius: 8, background: C.lime, border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </SectionCard>

        <SectionCard icon={Bell} title="Notifications" subtitle="Configure how you receive notifications">
          <ToggleRow label="Push Notifications" sub="Receive notifications about your sessions" enabled={pushNotifs} onChange={setPushNotifs} />
          <ToggleRow label="Focus Alerts" sub="Get alerted when you lose focus" enabled={focusAlerts} onChange={setFocusAlerts} />
        </SectionCard>

        <SectionCard icon={Volume2} title="Session Preferences" subtitle="Customize your learning session experience">
          <ToggleRow label="Sound Enabled" sub="Enable AI tutor voice" enabled={soundEnabled} onChange={setSoundEnabled} />
          <ToggleRow label="Auto-start Camera" sub="Automatically enable focus monitoring" enabled={autoCamera} onChange={setAutoCamera} />
        </SectionCard>

        <SectionCard icon={Shield} title="Security" subtitle="Manage your account security settings">
          <ToggleRow label="Two-Factor Authentication" sub="Add an extra layer of security to your account" enabled={twoFactor} onChange={setTwoFactor} />
          <div style={{ paddingTop: 14, borderTop: `1px solid ${C.cardBorder}`, marginTop: 2 }}>
            <div style={{ color: C.white, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', marginBottom: 3 }}>Change Password</div>
            <div style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 12 }}>Update your account password</div>
            
            {!showPwdModal ? (
                <button 
                    onClick={() => setShowPwdModal(true)}
                    style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.text, fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer' }}
                >Change Password</button>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                    <input type="password" placeholder="Current Password" value={password.current} onChange={e => setPassword({...password, current: e.target.value})} style={inputStyle} />
                    <input type="password" placeholder="New Password" value={password.next} onChange={e => setPassword({...password, next: e.target.value})} style={inputStyle} />
                    <input type="password" placeholder="Confirm New Password" value={password.confirm} onChange={e => setPassword({...password, confirm: e.target.value})} style={inputStyle} />
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={handleUpdatePassword} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, background: C.lime, border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Update</button>
                        <button onClick={() => setShowPwdModal(false)} style={{ padding: '8px 18px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.text, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            )}
          </div>
        </SectionCard>

        <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12, padding: '22px 24px', maxWidth: 660, animation: 'fadeUp 0.4s 0.2s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Trash2 size={16} color="#f87171" />
            <span style={{ color: '#f87171', fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif' }}>Danger Zone</span>
          </div>
          <p style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif', margin: '0 0 16px' }}>Irreversible actions for your account</p>
          <button style={{ padding: '9px 20px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
          >Delete Account</button>
        </div>

      </main>
    </div>

    <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #444; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 99px; }
      `}</style>
  </div>
  );
}