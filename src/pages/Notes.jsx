import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, api } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import {
  Bell, Search, ChevronRight, Calendar,
  Copy, Download, FileText, Lightbulb,
  CheckCircle2, BookMarked, Tag, Loader2
} from 'lucide-react';

const C = {
  bg: '#0a0a0a', panel: '#0d0d0d', card: '#111111', cardBorder: '#1e1e1e',
  lime: '#c8e000', limeDim: 'rgba(200,224,0,0.12)',
  limeBorder: 'rgba(200,224,0,0.25)',
  white: '#ffffff', muted: '#555', text: '#ccc',
};

const SectionBlock = ({ icon: Icon, title, children }) => (
  <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '20px 22px', marginBottom: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Icon size={16} color={C.lime} />
      <span style={{ color: C.white, fontSize: 14, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{title}</span>
    </div>
    {children}
  </div>
);

export default function Notes() {
  const { user } = useContext(AuthContext);
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [activeTab, setActiveTab] = useState('notes');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await api.get('/notes');
        const data = res.data || [];
        setNotes(data);
        if (data.length > 0) setSelectedNote(data[0]);
      } catch (err) {
        console.error('Failed to fetch notes:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  const handleCopy = () => {
    if (!selectedNote) return;
    const text = selectedNote.content?.keyPoints?.join('\n') || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      <Sidebar />
      <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 60, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}>
          <div>
            <div style={{ color: C.white, fontWeight: 700, fontSize: 18, fontFamily: 'Georgia, serif' }}>Notes & Cheatsheets</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 1, fontFamily: 'sans-serif' }}>AI-generated study materials from your sessions</div>
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

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Notes list */}
          <div style={{ width: 240, flexShrink: 0, borderRight: `1px solid ${C.cardBorder}`, background: C.panel, overflowY: 'auto', padding: '20px 12px' }}>
            <div style={{ color: C.white, fontSize: 13, fontWeight: 700, fontFamily: 'sans-serif', marginBottom: 4, padding: '0 6px' }}>Your Notes</div>
            <div style={{ color: C.muted, fontSize: 12, fontFamily: 'sans-serif', marginBottom: 16, padding: '0 6px' }}>{notes.length} sessions</div>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                <Loader2 size={24} color={C.lime} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : notes.length > 0 ? (
              notes.map(note => (
                <div key={note._id} onClick={() => setSelectedNote(note)} style={{ padding: '12px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: selectedNote?._id === note._id ? C.limeDim : 'transparent', border: `1px solid ${selectedNote?._id === note._id ? C.limeBorder : 'transparent'}`, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (selectedNote?._id !== note._id) e.currentTarget.style.background = '#161616'; }}
                  onMouseLeave={e => { if (selectedNote?._id !== note._id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: selectedNote?._id === note._id ? C.limeDim : '#161616', border: `1px solid ${selectedNote?._id === note._id ? C.limeBorder : C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.lime}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.lime }} />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: selectedNote?._id === note._id ? C.white : C.text, fontSize: 12, fontWeight: 600, fontFamily: 'sans-serif', lineHeight: 1.4, marginBottom: 4 }}>{note.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.muted, fontSize: 11, fontFamily: 'sans-serif' }}><Calendar size={10} />{new Date(note.createdAt).toLocaleDateString()}</div>
                    </div>
                    <ChevronRight size={13} color={selectedNote?._id === note._id ? C.lime : C.muted} />
                  </div>
                </div>
              ))
            ) : (
                <div style={{ padding: '20px 6px', color: C.muted, fontSize: 12, textAlign: 'center' }}>No notes yet</div>
            )}
          </div>

          {/* Detail */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {selectedNote ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderBottom: `1px solid ${C.cardBorder}`, paddingBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[{ id: 'notes', icon: FileText, label: 'Notes' }, { id: 'cheatsheet', icon: Lightbulb, label: 'Cheatsheet' }].map(tab => (
                      <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, cursor: 'pointer', border: 'none', background: activeTab === tab.id ? C.limeDim : 'transparent', color: activeTab === tab.id ? C.lime : C.muted, fontSize: 13, fontFamily: 'sans-serif', fontWeight: activeTab === tab.id ? 600 : 500, outline: activeTab === tab.id ? `1px solid ${C.limeBorder}` : '1px solid transparent', transition: 'all 0.15s' }}>
                        <tab.icon size={14} />{tab.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, cursor: 'pointer', background: 'transparent', border: `1px solid ${C.cardBorder}`, color: copied ? C.lime : C.text, fontSize: 13, fontFamily: 'sans-serif' }}>
                      <Copy size={13} />{copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, cursor: 'pointer', background: C.limeDim, border: `1px solid ${C.limeBorder}`, color: C.lime, fontSize: 13, fontFamily: 'sans-serif', fontWeight: 600 }}>
                      <Download size={13} />Download PDF
                    </button>
                  </div>
                </div>

                <h2 style={{ color: C.white, fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 6 }}>{selectedNote.title}</h2>
                <div style={{ color: C.muted, fontSize: 13, fontFamily: 'sans-serif', marginBottom: 24 }}>{new Date(selectedNote.createdAt).toLocaleDateString()}</div>

                {activeTab === 'notes' && (
                  <div style={{ animation: 'fadeUp 0.3s ease both' }}>
                    <SectionBlock icon={BookMarked} title="Summary">
                      <p style={{ color: C.text, fontSize: 14, fontFamily: 'sans-serif', lineHeight: 1.7, margin: 0 }}>{selectedNote.content?.summary || 'No summary available.'}</p>
                    </SectionBlock>
                    <SectionBlock icon={CheckCircle2} title="Key Points">
                      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {selectedNote.content?.keyPoints?.map((pt, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: C.limeDim, border: `1px solid ${C.limeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.lime, fontFamily: 'sans-serif' }}>{i + 1}</div>
                            <span style={{ color: C.text, fontSize: 14, fontFamily: 'sans-serif', lineHeight: 1.6 }}>{pt}</span>
                          </li>
                        )) || <li style={{ color: C.muted, fontSize: 14 }}>No key points available.</li>}
                      </ol>
                    </SectionBlock>
                    <div>
                      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 14 }}>Topic Notes</div>
                      {selectedNote.content?.topicNotes?.map((t, i) => (
                        <div key={i} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><Tag size={13} color={C.lime} /><span style={{ color: C.lime, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>{t.topic}</span></div>
                          <p style={{ color: C.text, fontSize: 13, fontFamily: 'sans-serif', lineHeight: 1.65, margin: 0 }}>{t.content}</p>
                        </div>
                      )) || <div style={{ color: C.muted, fontSize: 13 }}>No topic-specific notes.</div>}
                    </div>
                  </div>
                )}

                {activeTab === 'cheatsheet' && (
                  <div style={{ animation: 'fadeUp 0.3s ease both' }}>
                    <SectionBlock icon={Lightbulb} title="Quick Reference">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {selectedNote.content?.cheatsheet?.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 0', borderBottom: i < selectedNote.content.cheatsheet.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                            <div style={{ width: 180, flexShrink: 0, color: C.lime, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>{item.term}</div>
                            <div style={{ color: C.text, fontSize: 13, fontFamily: 'sans-serif', lineHeight: 1.5 }}>{item.def}</div>
                          </div>
                        )) || <div style={{ color: C.muted, fontSize: 13 }}>No cheatsheet entries.</div>}
                      </div>
                    </SectionBlock>
                  </div>
                )}
              </>
            ) : !loading && (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 14 }}>
                  Select a note to view details
                </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #444; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 99px; }
      `}</style>
    </div>
  );
}