import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  LayoutDashboard, UploadCloud, BookOpen,
  Settings as SettingsIcon, LogOut, Play
} from 'lucide-react';

const C = {
  sidebar: '#0d0d0d',
  cardBorder: '#1e1e1e',
  lime: '#c8e000',
  white: '#ffffff',
  muted: '#555',
};

const SideItem = ({ icon: Icon, label, active, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
      background: active ? C.lime : 'transparent',
      color: active ? '#0a0a0a' : C.muted,
      fontFamily: 'sans-serif', fontSize: 13,
      fontWeight: active ? 700 : 500,
      transition: 'all 0.15s', marginBottom: 2,
    }}
    onMouseEnter={e => {
      if (!active) {
        e.currentTarget.style.background = '#1a1a1a';
        e.currentTarget.style.color = C.white;
      }
    }}
    onMouseLeave={e => {
      if (!active) {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = C.muted;
      }
    }}
  >
    <Icon size={16} />
    <span>{label}</span>
  </div>
);

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active item from URL — no useState needed
  const active = location.pathname.replace('/', ''); // 'dashboard', 'upload', etc.

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'upload', label: 'Upload', icon: UploadCloud, path: '/upload' },
    { id: 'sessions', label: 'Sessions', icon: Play, path: '/sessions' },
    { id: 'notes', label: 'Notes', icon: BookOpen, path: '/notes' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  return (
    <aside style={{
      width: 200, flexShrink: 0,
      background: C.sidebar,
      borderRight: `1px solid ${C.cardBorder}`,
      display: 'flex', flexDirection: 'column',
      padding: '20px 12px',
      position: 'fixed', top: 0, left: 0, bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 6px', marginBottom: 32,
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          <div style={{
            width: 32, height: 32, background: C.lime, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900, color: '#0a0a0a',
          }}>A</div>
          <span style={{
            color: C.white, fontWeight: 700, fontSize: 15,
            fontFamily: 'Georgia, serif',
          }}>Acadomi</span>
        </div>
        <span style={{ color: C.muted, fontSize: 16, cursor: 'pointer' }}>‹</span>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        {navItems.map(item => (
          <SideItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={active === item.id}
            onClick={() => navigate(item.path)}
          />
        ))}
      </nav>

      {/* Logout */}
      <div
        onClick={handleLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
          color: C.muted, fontSize: 13, fontFamily: 'sans-serif',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
        onMouseLeave={e => e.currentTarget.style.color = C.muted}
      >
        <LogOut size={16} />
        <span>Log out</span>
      </div>
    </aside>
  );
}