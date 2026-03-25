import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, api } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
    Bell, Search, Play, MoreVertical,
    Clock, Target, FileText, Calendar, Plus, Loader2
} from 'lucide-react';

const C = {
    bg: '#0a0a0a', card: '#111111', cardBorder: '#1e1e1e',
    lime: '#c8e000', limeDim: 'rgba(200,224,0,0.12)',
    limeBorder: 'rgba(200,224,0,0.25)',
    white: '#ffffff', muted: '#555', soft: '#888', text: '#ccc',
};

const SessionAvatar = () => (
    <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: C.limeDim, border: `1px solid ${C.limeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${C.lime}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.lime }} />
        </div>
    </div>
);

const Badge = ({ status }) => {
    const s = status || 'in_progress';
    const isCompleted = s === 'completed';
    return (
        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'sans-serif', fontWeight: 600, background: isCompleted ? C.limeDim : 'rgba(255,255,255,0.05)', color: isCompleted ? C.lime : C.soft, border: `1px solid ${isCompleted ? C.limeBorder : '#2a2a2a'}` }}>
            {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
        </span>
    );
};

const SessionCard = ({ session, onDelete, delay = 0 }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();
    const isCompleted = session.status === 'completed';

    return (
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '20px 24px', animation: `fadeUp 0.4s ${delay}s ease both`, transition: 'border-color 0.2s', position: 'relative' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.cardBorder}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <SessionAvatar />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.white, fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 6 }}>{session.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 12, fontFamily: 'sans-serif' }}><FileText size={11} />{session.fileName || 'N/A'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.muted, fontSize: 12, fontFamily: 'sans-serif' }}><Calendar size={11} />{session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'Unknown date'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.soft, fontSize: 12, fontFamily: 'sans-serif' }}><Clock size={12} color={C.muted} />{session.duration ? `${Math.floor(session.duration / 60)}m` : '0m'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'sans-serif' }}><Target size={12} color={C.lime} /><span style={{ color: C.lime, fontWeight: 600 }}>{session.focusScore}% focus</span></span>
                        <span style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif' }}>{session.topicsCompleted || 0}/{session.topicsTotal || 0} topics</span>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    <Badge status={session.status} />
                    <div style={{ position: 'relative' }}>
                        <div onClick={() => setMenuOpen(!menuOpen)} style={{ width: 28, height: 28, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <MoreVertical size={15} />
                        </div>
                        {menuOpen && (
                            <div style={{ position: 'absolute', top: 32, right: 0, zIndex: 50, background: '#161616', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '4px 0', minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                <div style={{ padding: '8px 14px', fontSize: 13, fontFamily: 'sans-serif', color: C.text, cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    onClick={() => { navigate(`/session/${session.pythonSessionId}`); setMenuOpen(false); }}
                                >View Session</div>
                                <div style={{ padding: '8px 14px', fontSize: 13, fontFamily: 'sans-serif', color: '#f87171', cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    onClick={() => { onDelete(session._id); setMenuOpen(false); }}
                                >Delete</div>
                            </div>
                        )}
                    </div>
                    <div 
                        onClick={() => navigate(`/session/${session.pythonSessionId}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: C.white, fontSize: 13, fontFamily: 'sans-serif', fontWeight: 600, padding: '6px 10px', borderRadius: 7, transition: 'color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.color = C.lime}
                        onMouseLeave={e => e.currentTarget.style.color = C.white}
                    >
                        <Play size={14} fill="currentColor" />{isCompleted ? 'Review' : 'Continue'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function Sessions() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = async () => {
        try {
            const res = await api.get('/sessions');
            setSessions(res.data || []);
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this session?')) return;
        try {
            await api.delete(`/sessions/${id}`);
            setSessions(sessions.filter(s => s._id !== id));
        } catch (err) {
            console.error('Failed to delete session:', err);
        }
    };

    const completedCount = sessions.filter(s => s.status === 'completed').length;
    const inProgressCount = sessions.filter(s => s.status !== 'completed').length;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
            <Sidebar />
            <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 60, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
                    <div>
                        <div style={{ color: C.white, fontWeight: 700, fontSize: 18, fontFamily: 'Georgia, serif' }}>Sessions</div>
                        <div style={{ color: C.muted, fontSize: 12, marginTop: 1, fontFamily: 'sans-serif' }}>View and manage your learning sessions</div>
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
                <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 48px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <span style={{ padding: '4px 12px', borderRadius: 6, background: C.limeDim, border: `1px solid ${C.limeBorder}`, color: C.lime, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>{sessions.length} sessions</span>
                            <span style={{ padding: '4px 12px', borderRadius: 6, background: '#161616', border: `1px solid ${C.cardBorder}`, color: C.soft, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>{completedCount} completed</span>
                            {inProgressCount > 0 && <span style={{ padding: '4px 12px', borderRadius: 6, background: '#161616', border: `1px solid ${C.cardBorder}`, color: C.soft, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>{inProgressCount} in progress</span>}
                        </div>
                        <button onClick={() => navigate('/upload')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, background: C.lime, border: 'none', color: '#0a0a0a', fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif', cursor: 'pointer' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#d4f000'}
                            onMouseLeave={e => e.currentTarget.style.background = C.lime}
                        ><Plus size={15} /> New Session</button>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                            <Loader2 size={32} color={C.lime} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {sessions.length > 0 ? (
                                sessions.map((s, i) => <SessionCard key={s._id || i} session={s} onDelete={handleDelete} delay={i * 0.06} />)
                            ) : (
                                <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
                                    <div style={{ color: C.muted, fontSize: 14, fontFamily: 'sans-serif', marginBottom: 20 }}>No sessions found</div>
                                    <button onClick={() => navigate('/upload')} style={{ padding: '8px 20px', borderRadius: 8, background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.text, fontSize: 13, cursor: 'pointer' }}>Start your first session</button>
                                </div>
                            )}
                        </div>
                    )}
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