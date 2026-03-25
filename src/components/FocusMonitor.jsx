import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import clsx from 'clsx';
import { Camera, Eye, EyeOff, BellRing, Settings2 } from 'lucide-react';

const WS_BASE = 'ws://127.0.0.1:8000/api/focus/ws';

export default function FocusMonitor({ sessionId, onFocusUpdate }) {
  const webcamRef = useRef(null);
  const wsRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState('Off');
  const [focusState, setFocusState] = useState('focused'); // 'focused', 'distracted', 'alarming'
  const [debugImage, setDebugImage] = useState(null);
  const [focusScore, setFocusScore] = useState(100);
  
  // Audio state
  const [audioPlayed, setAudioPlayed] = useState(false);
  const alarmAudio = useRef(null);
  
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    alarmAudio.current = new Audio('/1208.mp3');
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const connectWS = useCallback(() => {
    if (!sessionId) return;
    
    const ws = new WebSocket(`${WS_BASE}/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Focus WebSocket connected');
      setMonitorStatus('Connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      setMonitorStatus(data.status || 'Active');
      setFocusScore(data.focus_val !== undefined ? Math.round(data.focus_val * 100) : 100);

      const isDistracted = data.status === 'No Face' || data.status === 'Looking Away' || data.status === 'Eyes Closed';
      
      if (data.alarm) {
        setFocusState('alarming');
        if (!audioPlayed) {
          try {
            alarmAudio.current.currentTime = 0;
            alarmAudio.current.play();
            setAudioPlayed(true);
          } catch(e) {
            console.error("Audio playback failed", e);
          }
        }
      } else if (isDistracted) {
        setFocusState('distracted');
      } else {
        setFocusState('focused');
      }

      if (!data.alarm && audioPlayed) {
        alarmAudio.current.pause();
        alarmAudio.current.currentTime = 0;
        setAudioPlayed(false);
      }
      
      if (onFocusUpdate) onFocusUpdate({ 
        isAlarming: !!data.alarm, 
        rawStatus: data.status,
        focusScore: data.focus_val !== undefined ? data.focus_val * 100 : 100
      });
      
      if (data.debug_image) setDebugImage(`data:image/jpeg;base64,${data.debug_image}`);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setMonitorStatus('Error');
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      if (isRunning) {
        setMonitorStatus('Disconnected (Retrying...)');
        setTimeout(connectWS, 2000);
      } else {
        setMonitorStatus('Off');
      }
    };
  }, [sessionId, isRunning, audioPlayed, onFocusUpdate]);

  useEffect(() => {
    if (isRunning) {
      connectWS();
    } else {
      if (wsRef.current) wsRef.current.close();
      setMonitorStatus('Off');
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [isRunning, connectWS]);

  // Capture loop
  useEffect(() => {
    let interval;
    if (isRunning && wsRef.current?.readyState === WebSocket.OPEN) {
      interval = setInterval(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc && wsRef.current?.readyState === WebSocket.OPEN) {
          // Extract base64 part
          const base64 = imageSrc.split(',')[1];
          wsRef.current.send(JSON.stringify({ image: base64 }));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const statusIcons = {
    'focused': <Eye size={16} className="text-emerald-400" />,
    'distracted': <EyeOff size={16} className="text-amber-400" />,
    'alarming': <BellRing size={16} className="text-red-400 animate-bounce" />,
    'disabled': <Camera size={16} className="text-slate-400" />
  };

  const statusColors = {
    'focused': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    'distracted': 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    'alarming': 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]',
    'disabled': 'bg-slate-800/50 border-slate-700 text-slate-400'
  };

  const currentState = !isRunning ? 'disabled' : focusState;

  return (
    <div className="glass-card overflow-hidden">
      
      {/* Minimized Header Bar */}
      <div 
        className={clsx(
          "flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors hover:bg-slate-800/50",
          isExpanded ? "border-b border-slate-700/50 bg-slate-800/30" : ""
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <Camera size={16} />
          </div>
          <span className="text-sm font-semibold text-white tracking-wide">Focus Monitor</span>
          <div className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border flex items-center gap-1.5 transition-all duration-300", statusColors[currentState])}>
            {statusIcons[currentState]}
            {isRunning ? monitorStatus : 'Disabled'}
          </div>
          {isRunning && (
            <div className="text-[10px] font-bold text-slate-400">
              Score: {focusScore}%
            </div>
          )}
        </div>
        <button className="text-slate-500 hover:text-indigo-400 transition-colors p-1">
          <Settings2 size={16} />
        </button>
      </div>

      {/* Expanded Content Area */}
      {isExpanded && (
        <div className="p-4 bg-slate-900/40 relative">
           
           <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
             
             {/* Feed container */}
             <div className="relative w-40 h-[90px] rounded-xl overflow-hidden border border-slate-700 bg-black shrink-0 shadow-inner group">
               {isRunning ? (
                 <>
                   <Webcam
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ facingMode: "user" }}
                      className="w-full h-full object-cover transform -scale-x-100"
                   />
                   {/* Scanning overlay effect */}
                   <div className="absolute inset-0 bg-indigo-500/10 mix-blend-screen pointer-events-none">
                     <div className="w-full h-1 bg-indigo-400/50 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-[scan_3s_ease-in-out_infinite]"></div>
                   </div>
                 </>
               ) : (
                 <div className="flex flex-col items-center justify-center w-full h-full text-slate-600 gap-1 bg-slate-900">
                    <Camera size={20} />
                    <span className="text-[10px] font-medium uppercase tracking-wider">Camera Off</span>
                 </div>
               )}
               {debugImage && isRunning && (
                 <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 flex items-center justify-center">
                    <img src={debugImage} alt="debug" className="w-full h-full object-contain mix-blend-screen" />
                 </div>
               )}
             </div>

             {/* Controls */}
             <div className="flex-1 flex flex-col gap-3">
               <div>
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Attention AI Engine</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">Actively scans eye movement, blinks, and head orientation to detect distraction and pause lessons.</p>
               </div>
               
               <div className="flex items-center justify-between">
                 <button 
                  onClick={() => setIsRunning(!isRunning)}
                  className={clsx(
                    "px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all shadow-sm flex items-center gap-2",
                    isRunning 
                      ? "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700" 
                      : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                  )}
                 >
                   {isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
                 </button>
               </div>
             </div>

           </div>
        </div>
      )}
    </div>
  );
}
