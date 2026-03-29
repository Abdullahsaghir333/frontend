import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';

const WS_BASE = 'ws://127.0.0.1:8000/api/focus/ws';

// ── Helpers ────────────────────────────────────────────────────────────────

function barColor(v) {
  if (!Number.isFinite(v)) return '#475569';
  if (v >= 75) return '#4ade80';
  if (v >= 40) return '#fbbf24';
  return '#f87171';
}

function statusColor(status) {
  if (status === 'FOCUSED') return '#4ade80';
  if (status === 'DISTRACTED') return '#fbbf24';
  if (status === 'NOT FOCUSED') return '#f87171';
  return '#475569';
}

function MetricBar({ label, value }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const col = barColor(pct);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <span style={{
        fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#475569', fontWeight: 700, width: 68, flexShrink: 0,
        fontFamily: "'Courier New', monospace",
      }}>{label}</span>
      <div style={{
        flex: 1, height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden', margin: '0 8px',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: pct + '%', background: col,
          transition: 'width 0.35s ease, background 0.35s ease',
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, fontFamily: "'Courier New', monospace",
        color: col, minWidth: 40, textAlign: 'right',
        transition: 'color 0.35s ease',
      }}>{pct}%</span>
    </div>
  );
}

function Readout({ label, value, valueColor }) {
  return (
    <div style={{ padding: '8px 12px', borderRight: '1px solid #1e293b', flex: 1 }}>
      <div style={{
        fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: '#334155', fontWeight: 700, marginBottom: 3,
        fontFamily: "'Courier New', monospace",
      }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 700, fontFamily: "'Courier New', monospace",
        color: valueColor || '#94a3b8',
        transition: 'color 0.3s ease',
      }}>{value}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function FocusMonitor({ sessionId, onFocusUpdate, onRunningChange }) {
  const webcamRef = useRef(null);
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const alarmOscRef = useRef(null);
  const alarmGainRef = useRef(null);
  const alarmPulseRef = useRef(null);

  // ── Stable refs for parent callbacks (prevents re-render reconnect storms) ──
  const onFocusUpdateRef = useRef(onFocusUpdate);
  const onRunningChangeRef = useRef(onRunningChange);
  const isRunningRef = useRef(false);

  useEffect(() => { onFocusUpdateRef.current = onFocusUpdate; }, [onFocusUpdate]);
  useEffect(() => { onRunningChangeRef.current = onRunningChange; }, [onRunningChange]);

  const [isRunning, setIsRunning] = useState(false);
  const [focusScore, setFocusScore] = useState(0);
  const [status, setStatus] = useState('OFF');          // 'FOCUSED' | 'DISTRACTED' | 'NOT FOCUSED' | 'OFF' | 'CALIBRATING'
  const [alarm, setAlarm] = useState(false);
  const [blinkTimer, setBlinkTimer] = useState(null);
  const [gazeStillTimer, setGazeStillTimer] = useState(null);
  const [gazeVariance, setGazeVariance] = useState(null);
  const [calibProgress, setCalibProgress] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [debugImage, setDebugImage] = useState(null);

  // Derived sub-scores (sent by backend or estimated)
  const [poseScore, setPoseScore] = useState(0);
  const [eyeScore, setEyeScore] = useState(0);
  const [gazeScore, setGazeScore] = useState(0);

  // ── Alarm sound ──────────────────────────────────────────────────────────

  const ensureAudioCtx = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => { });
    }
    return audioCtxRef.current;
  };

  const startAlarm = () => {
    try {
      const ctx = ensureAudioCtx();
      if (!alarmOscRef.current) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 880;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        alarmOscRef.current = osc;
        alarmGainRef.current = gain;
      }
      if (alarmPulseRef.current) return;
      console.log('[FocusMonitor] 🔔 ALARM STARTED');
      let on = false;
      alarmPulseRef.current = setInterval(() => {
        if (!alarmGainRef.current) return;
        on = !on;
        alarmGainRef.current.gain.setTargetAtTime(on ? 0.4 : 0, audioCtxRef.current.currentTime, 0.02);
      }, 400);
    } catch (e) {
      console.error('[FocusMonitor] Alarm start error:', e);
    }
  };

  const stopAlarm = () => {
    try {
      if (alarmPulseRef.current) { clearInterval(alarmPulseRef.current); alarmPulseRef.current = null; }
      if (alarmGainRef.current && audioCtxRef.current) {
        alarmGainRef.current.gain.setTargetAtTime(0, audioCtxRef.current.currentTime, 0.02);
      }
    } catch (_) { }
  };
  // ── WebSocket ────────────────────────────────────────────────────────────

  const connectWS = useCallback(() => {
    if (!sessionId) return;
    // Guard: don't open a second connection if one is already alive
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      return;
    }
    const ws = new WebSocket(`${WS_BASE}/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      const score = data.focus_val !== undefined ? Math.round(data.focus_val) : 0;
      setFocusScore(score);
      setBlinkTimer(data.blink_timer ?? null);
      setGazeStillTimer(data.gaze_still_timer ?? null);
      setGazeVariance(data.gaze_variance ?? null);

      if (data.calibration_progress !== undefined && data.calibration_progress !== null) {
        setCalibProgress(data.calibration_progress);
      }
      if (typeof data.is_calibrated === 'boolean') setIsCalibrated(data.is_calibrated);

      // Sub-scores (if backend sends them; else derive)
      setPoseScore(data.pose_score !== undefined ? Math.round(data.pose_score * 100) : Math.min(100, score + 10));
      setEyeScore(data.eye_score !== undefined ? Math.round(data.eye_score * 100) : Math.min(100, score + 5));
      setGazeScore(data.gaze_score !== undefined ? Math.round(data.gaze_score * 100) : Math.max(0, score - 10));

      const isAlarming = !!data.alarm;
      const rawStatus = data.status || 'FOCUSED';
      setAlarm(isAlarming);
      setStatus(rawStatus);

      if (isAlarming) startAlarm(); else stopAlarm();

      if (data.debug_image) setDebugImage(`data:image/jpeg;base64,${data.debug_image}`);

      if (onFocusUpdateRef.current) onFocusUpdateRef.current({
        isAlarming,
        rawStatus,
        focusScore: score,
      });
    };

    ws.onerror = () => setStatus('ERROR');
    ws.onclose = () => {
      stopAlarm();
      // Only reconnect if monitoring is still active
      if (isRunningRef.current) setTimeout(connectWS, 2000);
    };
  }, [sessionId]);   // ← only depend on sessionId (stable)

  useEffect(() => {
    isRunningRef.current = isRunning;
    if (isRunning) connectWS();
    else {
      wsRef.current?.close();
      wsRef.current = null;
      setStatus('OFF');
      setIsCalibrated(false);
      setCalibProgress(0);
      stopAlarm();
    }
    onRunningChangeRef.current?.(isRunning);
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [isRunning, connectWS]);

  // Frame capture loop
  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const src = webcamRef.current?.getScreenshot();
        if (src) wsRef.current.send(JSON.stringify({ frame: src.split(',')[1] }));
      }, 333);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => () => stopAlarm(), []);

  // ── Derived display values ───────────────────────────────────────────────

  const isCalibrating = isRunning && !isCalibrated;
  const calibPct = Math.max(0, Math.min(100, calibProgress));
  const col = isRunning ? statusColor(isCalibrating ? 'CALIBRATING' : status) : '#475569';
  const displayStatus = !isRunning ? 'OFF' : isCalibrating ? 'CALIBRATING' : status;

  const blinkColor = (() => {
    if (blinkTimer === null) return '#94a3b8';
    if (blinkTimer > 14) return '#f87171';
    if (blinkTimer > 8) return '#fbbf24';
    return '#94a3b8';
  })();

  const gazeStillColor = (() => {
    if (gazeStillTimer === null) return '#94a3b8';
    if (gazeStillTimer > 14) return '#f87171';
    if (gazeStillTimer > 8) return '#fbbf24';
    return '#94a3b8';
  })();

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#0a0f1e',
      border: '1px solid #1e293b',
      borderRadius: 12,
      overflow: 'hidden',
      fontFamily: "'Courier New', monospace",
    }}>

      {/* ── Header ── */}
      <div style={{
        background: '#060d1a',
        borderBottom: '1px solid #1e293b',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isRunning ? col : '#475569',
          boxShadow: isRunning ? `0 0 6px ${col}` : 'none',
          flexShrink: 0,
          transition: 'background 0.3s, box-shadow 0.3s',
        }} />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: '#94a3b8',
        }}>Focus Monitor</span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, letterSpacing: '0.12em',
          color: col, fontWeight: 700,
          transition: 'color 0.3s',
        }}>{displayStatus}</span>
      </div>

      {/* ── Calibration bar ── */}
      {isCalibrating && (
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid #1e293b',
          background: '#060d1a',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#6366f1', fontWeight: 700, marginBottom: 5,
          }}>
            <span>Calibrating...</span>
            <span>{Math.floor(calibPct)}/100</span>
          </div>
          <div style={{ height: 3, background: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#6366f1', borderRadius: 2,
              width: calibPct + '%', transition: 'width 0.2s ease',
            }} />
          </div>
        </div>
      )}

      {/* ── Feed + metric bars ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e293b' }}>

        {/* Camera / debug feed */}
        <div style={{
          width: 160, height: 120, background: '#000',
          borderRight: '1px solid #1e293b',
          flexShrink: 0, position: 'relative', overflow: 'hidden',
        }}>
          {isRunning ? (
            <>
              {debugImage ? (
                <img src={debugImage} alt="debug" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
              ) : (
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: 'user' }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
                />
              )}
              {/* Scan line */}
              <div style={{
                position: 'absolute', width: '100%', height: 1,
                background: `${col}66`,
                animation: 'focusScan 2s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
              {/* Corner brackets */}
              {[
                { top: 6, left: 6, borderTop: `1.5px solid ${col}`, borderLeft: `1.5px solid ${col}` },
                { top: 6, right: 6, borderTop: `1.5px solid ${col}`, borderRight: `1.5px solid ${col}` },
                { bottom: 6, left: 6, borderBottom: `1.5px solid ${col}`, borderLeft: `1.5px solid ${col}` },
                { bottom: 6, right: 6, borderBottom: `1.5px solid ${col}`, borderRight: `1.5px solid ${col}` },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 12, height: 12, ...s, pointerEvents: 'none', opacity: 0.8 }} />
              ))}
              <div style={{
                position: 'absolute', bottom: 5, left: 7,
                fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
                color: alarm ? '#f87171' : col,
                fontFamily: "'Courier New', monospace",
              }}>
                {alarm ? 'ALERT' : 'MONITORING'}
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', width: '100%', height: '100%',
              gap: 6, color: '#334155',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Camera Off</span>
            </div>
          )}
        </div>

        {/* Metric bars */}
        <div style={{
          flex: 1, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center',
        }}>
          <MetricBar label="Head Pose" value={isRunning && isCalibrated ? poseScore : 0} />
          <MetricBar label="Eye Open" value={isRunning && isCalibrated ? eyeScore : 0} />
          <MetricBar label="Gaze" value={isRunning && isCalibrated ? gazeScore : 0} />
          <MetricBar label="Focus" value={isRunning && isCalibrated ? focusScore : 0} />
        </div>
      </div>

      {/* ── Status + avg score ── */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', gap: 10,
        background: alarm ? 'rgba(220,38,38,0.06)' : 'transparent',
        transition: 'background 0.3s',
      }}>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: col,
          transition: 'color 0.3s',
          animation: alarm ? 'focusAlarmPulse 0.5s ease-in-out infinite' : 'none',
        }}>
          {displayStatus}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 8, letterSpacing: '0.14em', color: '#334155', textTransform: 'uppercase', marginBottom: 2 }}>Avg Score</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: col, lineHeight: 1, transition: 'color 0.3s' }}>
            {isRunning && isCalibrated ? focusScore : '—'}
            {isRunning && isCalibrated && <span style={{ fontSize: 12, fontWeight: 700 }}>%</span>}
          </div>
        </div>
      </div>

      {/* ── Alarm banner ── */}
      {alarm && (
        <div style={{
          margin: '6px 14px',
          background: 'rgba(220,38,38,0.15)',
          border: '1px solid rgba(220,38,38,0.4)',
          borderRadius: 6,
          padding: '7px 12px',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: '#f87171',
          textAlign: 'center',
          animation: 'focusAlarmPulse 0.5s ease-in-out infinite',
        }}>
          {status === 'PLEASE BLINK'
            ? `NO BLINK (${blinkTimer ?? 0}s) + NO EYE MOVE (${gazeStillTimer ?? 0}s) — PLEASE BLINK OR LOOK AROUND`
            : status === 'WAKE UP'
              ? 'EYES CLOSED TOO LONG — WAKE UP'
              : status === 'HEAD DOWN'
                ? 'HEAD DOWN TOO LONG — SIT UP'
                : 'NOT FOCUSED — ATTENTION REQUIRED'
          }
        </div>
      )}

      {/* ── Readouts ── */}
      <div style={{ display: 'flex', borderTop: '1px solid #1e293b' }}>
        <Readout
          label="No Blink"
          value={blinkTimer !== null ? `${blinkTimer}s` : '—'}
          valueColor={blinkColor}
        />
        <Readout
          label="Eye Still"
          value={gazeStillTimer !== null ? `${gazeStillTimer}s` : '—'}
          valueColor={gazeStillColor}
        />
        <Readout
          label="Gaze Var."
          value={gazeVariance !== null ? gazeVariance.toFixed(4) : '—'}
        />
        <div style={{ padding: '8px 12px', flex: 1, borderRight: 'none' }}>
          <div style={{
            fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: '#334155', fontWeight: 700, marginBottom: 3,
          }}>Calibration</div>
          <div style={{
            fontSize: 13, fontWeight: 700, fontFamily: "'Courier New', monospace",
            color: isCalibrated ? '#4ade80' : '#6366f1',
          }}>
            {!isRunning ? '—' : isCalibrated ? 'Ready' : `${Math.floor(calibPct)}/30`}
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{
        padding: '10px 14px', display: 'flex', gap: 8,
        borderTop: '1px solid #1e293b',
      }}>
        <button
          onClick={() => {
            // Pre-init AudioContext on user gesture so browser doesn't block alarm sound later
            ensureAudioCtx();
            setIsRunning(r => !r);
          }}
          style={{
            flex: 1, padding: '7px 0',
            borderRadius: 6, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            cursor: 'pointer', fontFamily: "'Courier New', monospace",
            border: `1px solid ${isRunning ? '#7f1d1d' : '#166534'}`,
            color: isRunning ? '#f87171' : '#4ade80',
            background: isRunning ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)',
            transition: 'all 0.15s',
          }}
        >
          {isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
        </button>

        {isRunning && (
          <button
            onClick={() => wsRef.current?.send(JSON.stringify({ type: 'reset' }))}
            style={{
              flex: 1, padding: '7px 0',
              borderRadius: 6, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: "'Courier New', monospace",
              border: '1px solid #1e293b', color: '#94a3b8', background: 'none',
              transition: 'all 0.15s',
            }}
          >
            Recalibrate
          </button>
        )}
      </div>

      {/* Inline keyframes via a style tag */}
      <style>{`
        @keyframes focusScan {
          0%   { top: 0; opacity: 1; }
          50%  { top: calc(100% - 1px); opacity: 0.3; }
          100% { top: 0; opacity: 1; }
        }
        @keyframes focusAlarmPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}