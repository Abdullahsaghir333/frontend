import { useState, useCallback, useContext } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { api, AuthContext } from '../context/AuthContext';
import {
  LayoutDashboard, UploadCloud, BookOpen, Settings,
  LogOut, Bell, Search, Play, FileText, Music,
  Image as ImageIcon, Loader2, X
} from 'lucide-react';
import Sidebar from '../components/Sidebar';

// ── colour tokens ──────────────────────────────────────────
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

// ── sidebar item ───────────────────────────────────────────
const SideItem = ({ icon: Icon, label, active, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
      background: active ? C.lime : 'transparent',
      color: active ? '#0a0a0a' : C.muted,
      fontFamily: 'sans-serif', fontSize: 13, fontWeight: active ? 700 : 500,
      transition: 'all 0.15s', marginBottom: 2,
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = C.white; } }}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; } }}
  >
    <Icon size={16} />
    <span>{label}</span>
  </div>
);

// ══════════════════════════════════════════════════════════
export default function Upload() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [activeNav, setActiveNav] = useState('upload');

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    setLoading(true);
    setError(null);
    setStatusText('Uploading & analysing document…');

    let pythonSessionId = null;
    let mongoSessionId = null;

    // ── Step 1: Send file to Python AI backend ─────────────
    try {
      const formData = new FormData();
      // Field name must match FastAPI route param — check /docs if unsure
      formData.append('file', file);

      const pyRes = await fetch('http://127.0.0.1:8000/api/session', {
        method: 'POST',
        // Do NOT set Content-Type manually — browser sets it with boundary for multipart
        body: formData,
      });

      if (!pyRes.ok) {
        // Read actual server error instead of showing a generic message
        let detail = `Python server error ${pyRes.status}`;
        try {
          const errBody = await pyRes.json();
          detail = errBody?.detail || errBody?.message || JSON.stringify(errBody);
        } catch {
          detail = await pyRes.text() || detail;
        }
        throw new Error(detail);
      }

      const pyData = await pyRes.json();

      // SessionState model returns `id` (uuid string)
      pythonSessionId = pyData.id || pyData.sessionId || pyData.session_id;
      if (!pythonSessionId) {
        throw new Error('Python server did not return a session ID. Check the /docs response schema.');
      }

      setStatusText('Saving session to database…');

      // ── Step 2: Persist session metadata to MongoDB via Node.js ──
      try {
        const mongoRes = await api.post('/sessions', {
          pythonSessionId,
          title: file.name.replace(/\.[^/.]+$/, ''), // strip extension for title
          fileName: file.name,
          status: 'in_progress',
          topicsTotal: pyData.slides?.length || 0,
        });

        mongoSessionId = mongoRes.data?._id || mongoRes.data?.id;
      } catch (mongoErr) {
        // Non-fatal: log but don't block — session still works from Python side
        console.warn('MongoDB session persist failed:', mongoErr?.response?.data || mongoErr.message);
      }

      setStatusText('Generating slides and voice script…');

      // ── Step 3: Navigate to SessionRoom ───────────────────
      navigate(`/session/${pythonSessionId}/slide/0`, {
        state: {
          pythonSessionId,          // pyData.id — UUID string from SessionState
          mongoSessionId,           // may be null if Node.js step failed
          fileName: file.name,
          initialSlides: pyData.slides || [],   // List[Slide] from SessionState
          notesText: pyData.notes_text || '',   // extracted PDF text
        },
      });

    } catch (err) {
      // Surface the real error message in the UI
      const message = err?.message || 'Unknown error communicating with AI server';
      setError(message);
      console.error('[Upload] Session start failed:', message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'audio/*': ['.mp3', '.wav'],
    },
    multiple: false,
    disabled: loading,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />

      {/* ── MAIN ── */}
      <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          height: 60, background: 'rgba(10,10,10,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.cardBorder}`,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
        }}>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 18, fontFamily: 'Georgia, serif' }}>Upload Documents</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 1, fontFamily: 'sans-serif' }}>Upload your learning materials to start a teaching session</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#111', border: `1px solid ${C.cardBorder}`,
              borderRadius: 8, padding: '7px 14px',
            }}>
              <Search size={13} color={C.muted} />
              <input
                placeholder="Search sessions, notes…"
                style={{ background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13, width: 180, fontFamily: 'sans-serif' }}
              />
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: '#111',
              border: `1px solid ${C.cardBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
            }}>
              <Bell size={15} color={C.muted} />
              <div style={{ position: 'absolute', top: 7, right: 8, width: 6, height: 6, borderRadius: '50%', background: C.lime }} />
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#0a0a0a',
            }}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Body */}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>

          {/* Drop zone card */}
          <div
            {...getRootProps()}
            style={{
              width: '100%',
              maxWidth: 860,
              background: C.card,
              border: `1px solid ${isDragActive ? C.lime : C.cardBorder}`,
              borderRadius: 14,
              padding: 14,
              cursor: loading ? 'default' : 'pointer',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: isDragActive ? `0 0 30px rgba(200,224,0,0.15)` : 'none',
            }}
          >
            <input {...getInputProps()} />

            {/* Inner dashed area */}
            <div style={{
              border: `1.5px dashed ${isDragActive ? C.lime : '#2a2a2a'}`,
              borderRadius: 10,
              minHeight: 340,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '48px 24px',
              transition: 'border-color 0.2s',
              textAlign: 'center',
            }}>

              {loading ? (
                /* ── Loading state ── */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                  <Loader2 size={48} color={C.lime} style={{ animation: 'spin 1s linear infinite' }} />
                  <div>
                    <div style={{ color: C.white, fontSize: 17, fontWeight: 600, fontFamily: 'sans-serif', marginBottom: 6 }}>{statusText}</div>
                    <div style={{ color: C.muted, fontSize: 13, fontFamily: 'sans-serif' }}>This usually takes just a moment…</div>
                  </div>
                </div>

              ) : error ? (
                /* ── Error state ── */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <X size={22} color="#f87171" />
                  </div>
                  <div style={{ color: C.white, fontSize: 16, fontWeight: 600, fontFamily: 'sans-serif' }}>Upload Failed</div>

                  {/* Show the real error message */}
                  <div style={{
                    color: '#f87171', fontSize: 13, fontFamily: 'monospace',
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 8, padding: '10px 16px', maxWidth: 520,
                    wordBreak: 'break-word', lineHeight: 1.6,
                  }}>
                    {error}
                  </div>

                  <div style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif', marginTop: -4 }}>
                    Check that the Python server is running on port 8000 and CORS is enabled.
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); setError(null); }}
                    style={{
                      marginTop: 8, padding: '9px 24px',
                      background: 'transparent', border: `1px solid ${C.cardBorder}`,
                      borderRadius: 8, color: C.text, fontSize: 13,
                      cursor: 'pointer', fontFamily: 'sans-serif',
                    }}
                  >
                    Try Again
                  </button>
                </div>

              ) : (
                /* ── Default / drag state ── */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                  {/* Icon box */}
                  <div style={{
                    width: 68, height: 68, borderRadius: 16,
                    background: isDragActive ? C.lime : 'rgba(200,224,0,0.15)',
                    border: `1px solid ${isDragActive ? C.lime : C.limeBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    animation: 'floatIcon 3s ease-in-out infinite',
                  }}>
                    <UploadCloud size={30} color={isDragActive ? '#0a0a0a' : C.lime} />
                  </div>

                  <div>
                    <div style={{ color: C.white, fontSize: 18, fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 6 }}>
                      {isDragActive ? 'Drop it here!' : 'Drag and drop your files here'}
                    </div>
                    <div style={{ color: C.muted, fontSize: 14, fontFamily: 'sans-serif' }}>or click to browse</div>
                  </div>

                  {/* Supported formats */}
                  <div style={{ marginTop: 8, color: C.muted, fontSize: 13, fontFamily: 'sans-serif' }}>
                    Supports PDF, Images, Audio (max 10MB per file)
                  </div>

                  {/* Format chips */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    {[
                      { icon: FileText, label: 'PDF' },
                      { icon: ImageIcon, label: 'Images' },
                      { icon: Music, label: 'Audio' },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 99,
                        background: C.limeDim, border: `1px solid ${C.limeBorder}`,
                        color: C.lime, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600,
                      }}>
                        <Icon size={12} /> {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-6px); }
        }
        * { box-sizing: border-box; }
        input::placeholder { color: #444; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 99px; }
      `}</style>
    </div>
  );
}