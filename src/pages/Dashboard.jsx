import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, api } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
    Bell, Search, ArrowUpRight, Play, ChevronRight,
    Clock, FileText, Target, TrendingUp, UploadCloud, Loader2
} from 'lucide-react';

const C = {
    bg: '#0a0a0a', card: '#111111', cardBorder: '#1e1e1e',
    lime: '#c8e000', limeDim: 'rgba(200,224,0,0.12)',
    limeBorder: 'rgba(200,224,0,0.25)',
    white: '#ffffff', muted: '#555', soft: '#888', text: '#ccc',
};

const Card = ({ children, style = {} }) => (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 12, ...style }}>
        {children}
    </div>
);

const CircleProgress = ({ value = 0, size = 120 }) => {
    const r = 46, circ = 2 * Math.PI * r;
    const offset = circ - (value / 100) * circ;
    return (
        <svg width={size} height={size} viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#1e1e1e" strokeWidth="7" />
            <circle cx="50" cy="50" r={r} fill="none" stroke={C.lime} strokeWidth="7"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            <text x="50" y="46" textAnchor="middle" fill={C.white} fontSize="13" fontWeight="700" fontFamily="Georgia, serif">{Math.round(value)}%</text>
            <text x="50" y="59" textAnchor="middle" fill={C.muted} fontSize="7" fontFamily="sans-serif">Average</text>
        </svg>
    );
};

const BarRow = ({ label, pct, delay = 0, color = C.lime }) => (
    <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: C.soft, fontSize: 12, fontFamily: 'sans-serif' }}>{label}</span>
            <span style={{ color: C.text, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600 }}>{Math.round(pct)}%</span>
        </div>
        <div style={{ height: 5, background: '#1e1e1e', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, animation: `barGrow 0.9s ${delay}s ease forwards`, transformOrigin: 'left' }} />
        </div>
    </div>
);

const StatCard = ({ icon: Icon, value, label, delta, delay = 0 }) => (
    <Card style={{ padding: '22px 20px', animation: `fadeUp 0.5s ${delay}s ease both` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: C.limeDim, border: `1px solid ${C.limeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={15} color={C.lime} />
            </div>
            <ArrowUpRight size={14} color={C.muted} />
        </div>
        <div style={{ marginTop: 16, fontFamily: 'Georgia, serif', color: C.white, fontSize: 26, fontWeight: 700 }}>{value}</div>
        <div style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif', marginTop: 2 }}>{label}</div>
        <div style={{ color: C.lime, fontSize: 11, fontFamily: 'sans-serif', marginTop: 6 }}>{delta}</div>
    </Card>
);

const SessionRow = ({ title, time, score, duration, summary, focusMonitorUsed, onClick, delay = 0 }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, background: '#0d0d0d', border: `1px solid ${C.cardBorder}`, animation: `fadeUp 0.5s ${delay}s ease both`, cursor: 'pointer', transition: 'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.limeBorder}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.cardBorder}
        onClick={onClick}
    >
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: C.limeDim, border: `1px solid ${C.limeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Play size={13} color={C.lime} />
        </div>
        <div style={{ flex: 1 }}>
            <div style={{ color: C.white, fontSize: 14, fontFamily: 'sans-serif', fontWeight: 600 }}>{title}</div>
            <div style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif', marginTop: 2 }}>{time}</div>
            {summary && (
                <div style={{ color: C.soft, fontSize: 11, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {summary}
                </div>
            )}
        </div>
        <div style={{ textAlign: 'right' }}>
            <div style={{ color: C.lime, fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{score}%</div>
            <div style={{ color: C.muted, fontSize: 11, fontFamily: 'sans-serif', marginTop: 1 }}>{duration}</div>
            {focusMonitorUsed && (
                <div style={{ color: '#a3e635', fontSize: 10, marginTop: 2, fontWeight: 700 }}>Focus ON</div>
            )}
        </div>
    </div>
);

export default function Dashboard() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalSessions: 0,
        avgFocus: 0,
        studyTime: '0 hrs',
        totalNotes: 0
    });
    const [recentSessions, setRecentSessions] = useState([]);
    const [focusOverview, setFocusOverview] = useState({
        focused: 0,
        distracted: 0,
        away: 0,
        average: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [sessionsRes, focusRes, notesRes] = await Promise.all([
                    api.get('/sessions'),
                    api.get('/focus/user-stats'),
                    api.get('/notes')
                ]);

                const sessions = sessionsRes.data || [];
                setRecentSessions(sessions.slice(0, 5).map(s => ({
                    id: s._id,
                    title: s.title,
                    time: new Date(s.createdAt).toLocaleDateString(),
                    score: s.focusScore || 0,
                    duration: s.duration ? `${Math.floor(s.duration / 60)}m` : '0m',
                    summary: s.summary || '',
                    focusMonitorUsed: !!s.focusMonitorUsed,
                })));

                const focusData = focusRes.data || { average: 0, breakdown: { focused: 0, distracted: 0, away: 0 } };
                setFocusOverview({
                    average: focusData.average || 0,
                    focused: focusData.breakdown?.focused || 0,
                    distracted: focusData.breakdown?.distracted || 0,
                    away: focusData.breakdown?.away || 0
                });

                // Calculate total study time
                const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
                const hrs = (totalMinutes / 3600).toFixed(1);

                setStats({
                    totalSessions: sessions.length,
                    avgFocus: Math.round(focusData.average || 0),
                    studyTime: `${hrs} hrs`,
                    totalNotes: notesRes.data?.length || 0
                });

            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
            <Sidebar />
            <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 56, background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
                    <div>
                        <div style={{ color: C.white, fontWeight: 700, fontSize: 18, fontFamily: 'Georgia, serif' }}>Dashboard</div>
                        <div style={{ color: C.muted, fontSize: 12, marginTop: 1 }}>Welcome back, {user?.name || 'Scholar'}! Ready to learn?</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#111', border: `1px solid ${C.cardBorder}`, borderRadius: 8, padding: '6px 12px' }}>
                            <Search size={13} color={C.muted} />
                            <input placeholder="Search sessions, notes…" style={{ background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13, width: 160 }} />
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
                    {loading ? (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 size={32} color={C.lime} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                                {[
                                    { icon: UploadCloud, title: 'Upload Document', sub: 'Start a new learning session', onClick: () => navigate('/upload') },
                                    { icon: Play, title: 'Continue Learning', sub: 'Resume your last session', onClick: () => {
                                        if (recentSessions.length > 0) {
                                            // `id` here is the Mongo session id in this component.
                                            // Keep compatibility by routing through /session/:id redirect.
                                            navigate(`/session/${recentSessions[0].id}/slide/0`);
                                        }
                                    } },
                                ].map(({ icon: Icon, title, sub, onClick }, i) => (
                                    <Card key={i} style={{ padding: '20px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color 0.2s', animation: `fadeUp 0.4s ${i * 0.08}s ease both` }}
                                        onMouseEnter={e => e.currentTarget.style.borderColor = C.limeBorder}
                                        onMouseLeave={e => e.currentTarget.style.borderColor = C.cardBorder}
                                        onClick={onClick}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.limeDim, border: `1px solid ${C.limeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon size={16} color={C.lime} />
                                            </div>
                                            <div>
                                                <div style={{ color: C.white, fontSize: 14, fontWeight: 600 }}>{title}</div>
                                                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{sub}</div>
                                            </div>
                                        </div>
                                        <ArrowUpRight size={15} color={C.muted} />
                                    </Card>
                                ))}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
                                <StatCard icon={Target} value={stats.totalSessions} label="Total Sessions" delta="+recent" delay={0} />
                                <StatCard icon={TrendingUp} value={`${stats.avgFocus}%`} label="Avg. Focus Score" delta="Performance" delay={0.06} />
                                <StatCard icon={Clock} value={stats.studyTime} label="Study Time" delta="Cumulative" delay={0.12} />
                                <StatCard icon={FileText} value={stats.totalNotes} label="Notes Created" delta="Personal library" delay={0.18} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14 }}>
                                <Card style={{ padding: 22 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                                        <div>
                                            <div style={{ color: C.white, fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif' }}>Recent Sessions</div>
                                            <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Your latest learning activities</div>
                                        </div>
                                        <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: C.lime, fontSize: 12, fontWeight: 600 }}
                                            onClick={() => navigate('/sessions')}
                                        >
                                            View all <ChevronRight size={13} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {recentSessions.length > 0 ? (
                                            recentSessions.map((s, i) => <SessionRow key={i} {...s} delay={i * 0.06} />)
                                        ) : (
                                            <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>No sessions yet. Upload a document to start learning!</div>
                                        )}
                                    </div>
                                </Card>

                                <Card style={{ padding: 22 }}>
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ color: C.white, fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif' }}>Focus Overview</div>
                                        <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Your attention performance</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                                        <CircleProgress value={focusOverview.average} size={130} />
                                    </div>
                                    <BarRow label="Focused" pct={focusOverview.focused} delay={0.1} />
                                    <BarRow label="Distracted" pct={focusOverview.distracted} delay={0.2} color="#f87171" />
                                    <BarRow label="Away" pct={focusOverview.away} delay={0.3} color="#fbbf24" />
                                </Card>
                            </div>
                        </>
                    )}
                </main>
            </div>

            <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes barGrow { from { transform:scaleX(0); } to { transform:scaleX(1); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 99px; }
        input::placeholder { color: #444; }
      `}</style>
        </div>
    );
}