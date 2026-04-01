import { useState } from 'react';
import { api } from '../context/AuthContext';
import { Mic, UploadCloud, Play, CheckCircle, AlertCircle, Lightbulb, Activity, Loader2 } from 'lucide-react';

const C = {
    bg: '#0a0a0a', card: '#111111', cardBorder: '#1e1e1e',
    lime: '#c8e000', limeDim: 'rgba(200,224,0,0.12)',
    limeBorder: 'rgba(200,224,0,0.25)',
    white: '#ffffff', muted: '#737373', soft: '#a3a3a3', text: '#d4d4d4',
    red: '#f87171', redDim: 'rgba(248,113,113,0.1)', redBorder: 'rgba(248,113,113,0.25)',
    green: '#4ade80', greenDim: 'rgba(74,222,128,0.1)', greenBorder: 'rgba(74,222,128,0.25)',
    blue: '#60a5fa', blueDim: 'rgba(96,165,250,0.1)', blueBorder: 'rgba(96,165,250,0.25)',
};

export default function RoleReversal() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('upload'); 
  const [recording, setRecording] = useState(false);

  // Mock handler
  const handleSubmit = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      // const res = await api.post('/role-reversal/analyze', { text: "Student mock explanation" });
      setTimeout(() => {
        setAnalysis({
          correct: ["Great explanation of the core concept.", "Good use of terminology."],
          mistakes: ["Forgot to cover the edge cases.", "Slightly confused the second variable."],
          suggestions: ["Try explaining it with an analogy next time.", "Review section 3 of your notes."]
        });
        setLoading(false);
      }, 1500); // simulate some delay
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', background: C.bg, minHeight: '100%' }}>
      {/* Topbar */}
      <header style={{
        position: 'sticky', top: 56, zIndex: 40,
        height: 60, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px'
      }}>
        <div>
          <div style={{ color: C.white, fontWeight: 700, fontSize: 18, fontFamily: 'Georgia, serif' }}>Role Reversal</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 1, fontFamily: 'sans-serif' }}>Teach the concepts back to the AI</div>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '40px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <div style={{ maxWidth: 800, width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Intro Section */}
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, background: C.limeDim, border: `1px solid ${C.limeBorder}`, color: C.lime, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
              <Activity size={14} /> Active Learning
            </div>
            <h1 style={{ fontSize: 42, fontWeight: 700, color: C.white, fontFamily: 'Georgia, serif', margin: '0 0 16px 0' }}>Teach the AI</h1>
            <p style={{ fontSize: 15, color: C.soft, lineHeight: 1.6, maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
              Explain your topic out loud. The AI will analyze your explanation to identify knowledge gaps and reinforce your understanding.
            </p>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 24, padding: 32, display: 'flex', flexDirection: 'column', gap: 32 }}>
            
            {/* Toggle Mode */}
            <div style={{ display: 'flex', background: '#0a0a0a', border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: 6, margin: '0 auto' }}>
              <button 
                onClick={() => setMode('upload')}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'sans-serif',
                  background: mode === 'upload' ? C.cardBorder : 'transparent',
                  color: mode === 'upload' ? C.white : C.muted,
                  fontWeight: mode === 'upload' ? 600 : 500, transition: 'all 0.2s'
                }}
              >
                Upload Audio
              </button>
              <button 
                onClick={() => setMode('record')}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'sans-serif',
                  background: mode === 'record' ? C.cardBorder : 'transparent',
                  color: mode === 'record' ? C.white : C.muted,
                  fontWeight: mode === 'record' ? 600 : 500, transition: 'all 0.2s'
                }}
              >
                Record Voice
              </button>
            </div>

            {/* Input Area */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 240, border: `2px dashed ${mode === 'record' && recording ? C.redBorder : C.cardBorder}`,
              background: mode === 'record' && recording ? C.redDim : '#0a0a0a', borderRadius: 20, padding: 32,
              transition: 'all 0.3s ease'
            }}>
              {mode === 'upload' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: 20, background: C.limeDim, color: C.lime, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, border: `1px solid ${C.limeBorder}` }}>
                    <UploadCloud size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, color: C.white, fontWeight: 600, fontFamily: 'sans-serif', margin: '0 0 8px 0' }}>Upload your explanation</h3>
                  <p style={{ fontSize: 13, color: C.muted, fontFamily: 'sans-serif', margin: '0 0 24px 0' }}>Accepts MP3, WAV up to 10MB</p>
                  <button style={{ padding: '10px 24px', borderRadius: 12, border: `1px solid ${C.cardBorder}`, background: '#111', color: C.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    Browse Audio Files
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ 
                    width: 64, height: 64, borderRadius: 20, 
                    background: recording ? C.redDim : 'rgba(255,255,255,0.05)', 
                    color: recording ? C.red : C.soft, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, 
                    border: `1px solid ${recording ? C.redBorder : C.cardBorder}`,
                    animation: recording ? 'pulseRed 1.5s infinite' : 'none'
                  }}>
                    <Mic size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, color: C.white, fontWeight: 600, fontFamily: 'sans-serif', margin: '0 0 8px 0' }}>
                    {recording ? 'Recording in progress...' : 'Click to start recording'}
                  </h3>
                  <p style={{ fontSize: 13, color: C.muted, fontFamily: 'sans-serif', margin: '0 0 24px 0' }}>
                    Speak clearly to teach the AI what you learned
                  </p>
                  <button 
                    onClick={() => setRecording(!recording)}
                    style={{ 
                      padding: '12px 28px', borderRadius: 12, border: 'none', 
                      background: recording ? C.red : C.cardBorder, 
                      color: recording ? '#fff' : C.white, 
                      fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'all 0.2s', boxShadow: recording ? '0 4px 15px rgba(239,68,68,0.3)' : 'none'
                    }}
                  >
                    {!recording ? <><Mic size={16} /> Start Recording</> : <><div style={{ width: 12, height: 12, background: '#fff', borderRadius: 2 }}/> Stop Recording</>}
                  </button>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button 
              onClick={handleSubmit} disabled={loading}
              style={{
                width: '100%', padding: 18, borderRadius: 16, border: 'none', background: C.lime,
                color: '#0a0a0a', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
                opacity: loading ? 0.7 : 1, transition: 'transform 0.2s'
              }}
            >
              {loading ? (
                <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Brainstorming specific feedback...</>
              ) : (
                <><Play size={18} fill="currentColor" /> Submit for Analysis</>
              )}
            </button>

            {/* Results Area */}
            {analysis && (
              <div style={{ marginTop: 16, borderTop: `1px solid ${C.cardBorder}`, paddingTop: 32, animation: 'fadeUp 0.5s ease' }}>
                <h3 style={{ fontSize: 24, fontWeight: 700, color: C.white, fontFamily: 'Georgia, serif', textAlign: 'center', margin: '0 0 24px 0' }}>Feedback Report</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                  
                  <div style={{ padding: 24, borderRadius: 20, background: C.greenDim, border: `1px solid ${C.greenBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(74,222,128,0.15)', color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={20}/></div>
                      <h4 style={{ color: C.green, fontWeight: 700, fontSize: 16, margin: 0, fontFamily: 'sans-serif' }}>Strengths</h4>
                    </div>
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {analysis.correct.map((item, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#e2e8f0', fontFamily: 'sans-serif', lineHeight: 1.5 }}><span style={{ color: C.green }}>•</span> <span>{item}</span></li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding: 24, borderRadius: 20, background: C.redDim, border: `1px solid ${C.redBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(248,113,113,0.15)', color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={20}/></div>
                      <h4 style={{ color: C.red, fontWeight: 700, fontSize: 16, margin: 0, fontFamily: 'sans-serif' }}>Mistakes</h4>
                    </div>
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {analysis.mistakes.map((item, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#e2e8f0', fontFamily: 'sans-serif', lineHeight: 1.5 }}><span style={{ color: C.red }}>•</span> <span>{item}</span></li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ padding: 24, borderRadius: 20, background: C.blueDim, border: `1px solid ${C.blueBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(96,165,250,0.15)', color: C.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Lightbulb size={20}/></div>
                      <h4 style={{ color: C.blue, fontWeight: 700, fontSize: 16, margin: 0, fontFamily: 'sans-serif' }}>Suggestions</h4>
                    </div>
                    <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {analysis.suggestions.map((item, i) => (
                        <li key={i} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#e2e8f0', fontFamily: 'sans-serif', lineHeight: 1.5 }}><span style={{ color: C.blue }}>•</span> <span>{item}</span></li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <style>{`
        @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
