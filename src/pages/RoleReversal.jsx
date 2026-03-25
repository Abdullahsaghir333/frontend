import { useState } from 'react';
import { api } from '../context/AuthContext';
import { Mic, UploadCloud, Play, CheckCircle, AlertCircle, Lightbulb, Activity } from 'lucide-react';

export default function RoleReversal() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('upload'); 

  // Mock handler
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await api.post('/role-reversal/analyze', { text: "Student mock explanation" });
      setTimeout(() => {
        setAnalysis(res.data.feedback);
        setLoading(false);
      }, 1500); // simulate some delay
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full py-8 flex flex-col relative z-10 items-center justify-center">
      
      {/* Background glow specific to this page */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[160px] pointer-events-none mix-blend-screen"></div>

      <div className="text-center mb-10 w-full relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-semibold tracking-wide uppercase mb-4 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
          <Activity size={16} /> Active Learning
        </div>
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400 mb-4 drop-shadow-sm font-outfit">
          Role Reversal Mode
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto font-light">
          Teach the concepts back to the AI. It will analyze your understanding and identify exactly where you need improvement.
        </p>
      </div>

      <div className="glass-card w-full max-w-3xl p-8 relative z-10">
        
        {/* Toggle Mode */}
        <div className="flex justify-center mb-10 bg-slate-900/60 p-1.5 rounded-2xl w-max mx-auto border border-slate-700/60 shadow-inner">
          <button 
            className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${mode === 'upload' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-white'}`} 
            onClick={() => setMode('upload')}
          >
            Upload Audio
          </button>
          <button 
            className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${mode === 'record' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-white'}`} 
            onClick={() => setMode('record')}
          >
            Record Voice
          </button>
        </div>

        {/* Input Area */}
        <div className="min-h-[220px] flex flex-col items-center justify-center border-2 border-dashed border-slate-700/60 rounded-[2rem] bg-slate-800/30 p-10 mb-8 transition-colors hover:border-purple-500/50 hover:bg-slate-800/50">
          {mode === 'upload' ? (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-purple-500/10 text-purple-400 rounded-3xl flex items-center justify-center mb-5 shadow-inner border border-purple-500/20">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Upload your explanation</h3>
              <p className="text-sm text-slate-500 mb-6 font-medium">Accepts MP3, WAV up to 10MB</p>
              <button className="btn-secondary">Browse Audio Files</button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-red-500/10 text-red-400 rounded-3xl flex items-center justify-center mb-5 shadow-inner border border-red-500/20 relative">
                 <div className="absolute inset-0 bg-red-500/20 rounded-3xl blur-md animate-pulse"></div>
                 <Mic size={32} className="relative z-10" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Click to start recording</h3>
              <p className="text-sm text-slate-500 mb-6 font-medium">Speak clearly to teach the AI what you learned</p>
              <button className="px-8 py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 shadow-[0_4px_15px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2 transform hover:-translate-y-0.5">
                <Mic size={18} /> Start Recording
              </button>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button 
          className="btn-primary w-full py-4 text-lg font-bold tracking-wide flex justify-center items-center gap-3 relative overflow-hidden"
          onClick={handleSubmit}
          disabled={loading}
          style={{ background: 'linear-gradient(135deg, #a855f7, #6366f1)' }}
        >
          {loading ? (
            <><div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> Brainstorming specific feedback...</>
          ) : (
            <><Play size={20} fill="currentColor" /> Submit for Analysis</>
          )}
        </button>

        {/* Results Area */}
        {analysis && (
          <div className="mt-10 fade-in border-t border-slate-700/50 pt-10">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Feedback Report</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 glass-card">
                <div className="w-full flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><CheckCircle size={20}/></div>
                  <h4 className="text-emerald-400 font-bold text-lg">Strengths</h4>
                </div>
                <ul className="text-sm text-slate-300 space-y-3 font-medium">
                  {analysis.correct.map((item, i) => (
                    <li key={i} className="flex gap-2"><span className="text-emerald-500">•</span> <span className="leading-snug">{item}</span></li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 glass-card">
                <div className="w-full flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center"><AlertCircle size={20}/></div>
                  <h4 className="text-red-400 font-bold text-lg">Mistakes</h4>
                </div>
                <ul className="text-sm text-slate-300 space-y-3 font-medium">
                  {analysis.mistakes.map((item, i) => (
                    <li key={i} className="flex gap-2"><span className="text-red-500">•</span> <span className="leading-snug">{item}</span></li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-3xl bg-blue-500/10 border border-blue-500/20 glass-card">
                <div className="w-full flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center"><Lightbulb size={20}/></div>
                  <h4 className="text-blue-400 font-bold text-lg">Suggest</h4>
                </div>
                <ul className="text-sm text-slate-300 space-y-3 font-medium">
                  {analysis.suggestions.map((item, i) => (
                    <li key={i} className="flex gap-2"><span className="text-blue-500">•</span> <span className="leading-snug">{item}</span></li>
                  ))}
                </ul>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
