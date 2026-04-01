import { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, BookOpen, UploadCloud, RefreshCcw, LayoutDashboard, Play, Settings as SettingsIcon, Menu, X } from 'lucide-react';

const C = {
    bg: '#0a0a0a', card: '#111111', cardBorder: '#1e1e1e',
    lime: '#c8e000', limeDim: 'rgba(200,224,0,0.12)',
    limeBorder: 'rgba(200,224,0,0.25)',
    white: '#ffffff', muted: '#555', soft: '#888', text: '#ccc',
};

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Upload', path: '/upload', icon: UploadCloud },
    { name: 'Sessions', path: '/sessions', icon: Play },
    { name: 'Notes', path: '/notes', icon: BookOpen },
    { name: 'Reversal', path: '/role-reversal', icon: RefreshCcw },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 56,
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px'
      }}>
        
        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: C.lime,
            display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
            color: '#0a0a0a', fontWeight: 'bold', fontSize: 16, fontFamily: 'Georgia, serif'
          }}>
            A
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.white, fontFamily: 'Georgia, serif', letterSpacing: '0.05em' }}>
            Acadomi
          </span>
        </div>

        {/* Center: Navigation Links (Desktop) */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="nav-desktop">
            <style>{`
              @media(max-width: 768px) { .nav-desktop { display: none !important; } .nav-mobile-btn { display: flex !important; } }
              @media(min-width: 769px) { .nav-mobile-btn { display: none !important; } }
            `}</style>
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: isActive ? 600 : 500,
                    color: isActive ? C.white : C.muted, textDecoration: 'none', transition: 'color 0.2s',
                  })}
                >
                  <Icon size={14} />
                  {link.name}
                </NavLink>
              );
            })}
          </div>
        )}

        {/* Right: User / Auth Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button 
                onClick={handleLogout}
                style={{
                  background: 'none', border: 'none', color: '#f87171',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
                }}
                title="Log out"
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          ) : (
            <div className="nav-desktop" style={{ display: 'flex', gap: 12 }}>
              <button style={{ background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 500 }} onClick={() => navigate('/login')}>Log In</button>
              <button style={{ background: C.lime, color: '#0a0a0a', border: 'none', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }} onClick={() => navigate('/signup')}>Sign Up</button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            className="nav-mobile-btn"
            style={{ display: 'none', background: 'transparent', border: 'none', color: C.text, cursor: 'pointer' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, zIndex: 40,
          background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(10px)',
          display: 'flex', flexDirection: 'column', padding: 24, paddingBottom: 30
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {user ? (
              navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12,
                      fontSize: 15, fontWeight: isActive ? 600 : 500,
                      color: isActive ? C.lime : C.muted,
                      background: isActive ? C.limeDim : 'transparent',
                      border: 'none',
                      textDecoration: 'none'
                    })}
                  >
                    <Icon size={18} />
                    {link.name}
                  </NavLink>
                );
              })
            ) : (
              <>
                <button style={{ padding: '16px', borderRadius: 12, border: `1px solid ${C.cardBorder}`, background: 'transparent', color: C.text, fontSize: 15, fontWeight: 600 }} onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}>Log In</button>
                <button style={{ padding: '16px', borderRadius: 12, border: 'none', background: C.lime, color: '#0a0a0a', fontSize: 15, fontWeight: 600 }} onClick={() => { setMobileMenuOpen(false); navigate('/signup'); }}>Sign Up</button>
              </>
            )}
          </div>
          {user && (
            <button 
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '16px', border: `1px solid rgba(248,113,113,0.3)`, background: 'rgba(248,113,113,0.1)',
                color: '#f87171', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <LogOut size={18} /> Log Out
            </button>
          )}
        </div>
      )}
    </>
  );
}
