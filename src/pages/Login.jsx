import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Personalized AI tutoring sessions',
    'Real-time focus monitoring',
    'Automatic notes and cheatsheets',
  ];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#0a0a0a',
      fontFamily: "'Georgia', serif",
    }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 72px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '20%',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(180,220,0,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 72 }}>
          <div style={{
            width: 40,
            height: 40,
            background: '#c8e000',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 900,
            color: '#0a0a0a',
            letterSpacing: '-1px',
          }}>A</div>
          <span style={{ color: '#ffffff', fontSize: 20, fontWeight: 600, letterSpacing: '0.02em', fontFamily: 'sans-serif' }}>
            Acadomi
          </span>
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            color: '#ffffff',
            fontSize: 'clamp(36px, 4vw, 52px)',
            fontWeight: 700,
            lineHeight: 1.15,
            margin: 0,
            fontFamily: "'Georgia', serif",
          }}>
            Welcome<br />Back
          </h1>
          <h2 style={{
            color: '#c8e000',
            fontSize: 'clamp(36px, 4vw, 52px)',
            fontWeight: 700,
            lineHeight: 1.15,
            margin: 0,
            fontFamily: "'Georgia', serif",
          }}>
            Sign In
          </h2>
        </div>

        {/* Subtext */}
        <p style={{
          color: '#666',
          fontSize: 16,
          lineHeight: 1.6,
          maxWidth: 340,
          margin: '0 0 48px',
          fontFamily: 'sans-serif',
          fontWeight: 400,
        }}>
          Continue your learning journey with your AI-powered tutoring platform.
        </p>

        {/* Feature list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(200,224,0,0.15)',
                border: '1px solid rgba(200,224,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={12} color="#c8e000" strokeWidth={3} />
              </div>
              <span style={{ color: '#999', fontSize: 15, fontFamily: 'sans-serif' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        width: 'min(520px, 45%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 56px',
        borderLeft: '1px solid #1a1a1a',
        backgroundColor: '#0d0d0d',
      }}>

        <h3 style={{
          color: '#ffffff',
          fontSize: 26,
          fontWeight: 700,
          margin: '0 0 6px',
          fontFamily: "'Georgia', serif",
        }}>
          Sign in to your account
        </h3>
        <p style={{
          color: '#555',
          fontSize: 14,
          margin: '0 0 36px',
          fontFamily: 'sans-serif',
        }}>
          Enter your credentials to continue
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 24,
            fontFamily: 'sans-serif',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#c8e000'}
                onBlur={e => e.target.style.borderColor = '#2a2a2a'}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={labelStyle}>Password</label>
              <a href="#" style={{ color: '#c8e000', fontSize: 13, textDecoration: 'none', fontFamily: 'sans-serif' }}>
                Forgot password?
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 48 }}
                onFocus={e => e.target.style.borderColor = '#c8e000'}
                onBlur={e => e.target.style.borderColor = '#2a2a2a'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#555',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '16px',
              background: loading ? '#8fa000' : '#c8e000',
              color: '#0a0a0a',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'sans-serif',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'background 0.2s',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={e => { if (!loading) e.target.style.background = '#d4f000'; }}
            onMouseLeave={e => { if (!loading) e.target.style.background = '#c8e000'; }}
          >
            {loading ? (
              <div style={{
                width: 20,
                height: 20,
                border: '2px solid rgba(0,0,0,0.2)',
                borderTop: '2px solid #0a0a0a',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
            ) : (
              <>Sign In <ArrowRight size={17} /></>
            )}
          </button>
        </form>

        <p style={{
          marginTop: 28,
          textAlign: 'center',
          color: '#555',
          fontSize: 14,
          fontFamily: 'sans-serif',
        }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#c8e000', fontWeight: 600, textDecoration: 'none' }}>
            Create one
          </Link>
        </p>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #444; }
      `}</style>
    </div>
  );
}

// ── Shared styles ──
const labelStyle = {
  display: 'block',
  marginBottom: 8,
  color: '#aaa',
  fontSize: 13,
  fontFamily: 'sans-serif',
  fontWeight: 500,
  letterSpacing: '0.02em',
};

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  background: '#141414',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: 15,
  fontFamily: 'sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};