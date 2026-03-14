import React, { useEffect, useRef, useState } from 'react';

const FocusMonitor = ({ sessionId, onFocusUpdate }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const wsRef = useRef(null);
    const [isCalibrated, setIsCalibrated] = useState(false);
    const [calibrationProgress, setCalibrationProgress] = useState(0);
    const [status, setStatus] = useState('INITIALIZING');
    const [focusVal, setFocusVal] = useState(100);
    const [blinkTimer, setBlinkTimer] = useState(0);
    const alarmAudioRef = useRef(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

    const handleUnlock = () => {
        if (alarmAudioRef.current) {
            alarmAudioRef.current.play()
                .then(() => {
                    alarmAudioRef.current.pause();
                    setIsAudioUnlocked(true);
                    setStatus(isCalibrated ? "SOUND ENABLED" : "CALIBRATING...");
                    console.log("Audio unlocked successfully via gesture.");
                })
                .catch(e => console.error("Unlock failed:", e));
        }
    };

    useEffect(() => {
        // Initialize Alarm with explicit error handling
        const audio = new Audio('/1208.MP3');
        audio.loop = true;
        audio.preload = 'auto';
        alarmAudioRef.current = audio;

        // Verify audio file accessibility
        audio.addEventListener('canplaythrough', () => console.log("Alarm audio loaded and ready."));
        audio.addEventListener('error', (e) => console.error("Alarm audio load error:", e));

        // Initialize WebSocket
        const wsUrl = `ws://127.0.0.1:8000/api/focus/ws/${sessionId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.is_calibrated) {
                setIsCalibrated(true);
                setFocusVal(data.focus_val);
                setStatus(data.status);
                setBlinkTimer(data.blink_timer);
                
                // Notify parent about focus and alarm state
                if (onFocusUpdate) {
                    onFocusUpdate({
                        val: data.focus_val,
                        status: data.status,
                        isAlarming: data.alarm
                    });
                }

                if (data.alarm && !isMuted) {
                    if (alarmAudioRef.current.paused) {
                        console.log("ALARM TRIGGERED: Status =", data.status);
                        alarmAudioRef.current.play()
                            .then(() => {
                                console.log("Alarm playing.");
                                setIsAudioUnlocked(true); // Successfully played
                            })
                            .catch(e => {
                                console.error("Alarm play blocked:", e);
                                setIsAudioUnlocked(false);
                                setStatus("ALARM BLOCKED - CLICK TO FIX");
                            });
                    }
                } else {
                    if (!alarmAudioRef.current.paused) {
                        console.log("Stopping alarm audio.");
                        alarmAudioRef.current.pause();
                    }
                }
            } else {
                setIsCalibrated(false);
                setCalibrationProgress(data.calibration_progress || 0);
                setStatus(data.status || 'CALIBRATING...');
            }
        };

        ws.onclose = () => {
            console.log("WebSocket closed");
        };

        // Initialize Camera
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Error accessing webcam:", err);
                setStatus("CAMERA ERROR");
            }
        };

        startCamera();

        // Frame sending loop
        const sendFrame = () => {
            if (ws.readyState === WebSocket.OPEN && videoRef.current && canvasRef.current) {
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                canvas.width = 300; // Reduce size for faster transmission
                canvas.height = 225;
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                
                const frame = canvas.toDataURL('image/jpeg', 0.5);
                ws.send(JSON.stringify({ type: 'frame', frame }));
            }
        };

        const intervalId = setInterval(sendFrame, 200); // 5 FPS

        return () => {
            clearInterval(intervalId);
            ws.close();
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            if (alarmAudioRef.current) {
                alarmAudioRef.current.pause();
            }
        };
    }, [sessionId, isMuted]);

    const recalibrate = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'reset' }));
            setIsCalibrated(false);
            setCalibrationProgress(0);
        }
    };

    return (
        <div className="focus-monitor-container">
            <div className={`webcam-pip ${!isAudioUnlocked ? 'audio-blocked' : ''}`} onClick={!isAudioUnlocked ? handleUnlock : undefined}>
                <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
                
                {!isAudioUnlocked && (
                    <div className="audio-unlock-overlay fade-in">
                        <div className="unlock-icon">🚫🔊</div>
                        <span>Tap to Unlock Sound</span>
                    </div>
                )}

                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                <div className="pip-overlay">
                    <div className="pip-status">
                        <div className={`status-dot ${status.includes('FOCUSED') ? 'good' : 'bad'}`} />
                        <span>{status}</span>
                    </div>
                    {isCalibrated && (
                        <div className="pip-timer">
                            <span>⏱️ {blinkTimer}s without blink/move</span>
                        </div>
                    )}
                </div>

                <div className="pip-controls">
                    <button className="pip-btn" onClick={recalibrate} title="Recalibrate">
                        <span>🔄</span>
                    </button>
                    <button className="pip-btn" onClick={() => setIsMuted(!isMuted)} title={isMuted ? "Unmute Alarm" : "Mute Alarm"}>
                        <span>{isMuted ? '🔇' : '🔊'}</span>
                    </button>
                </div>
            </div>

            <div className="focus-meter-card">
                <div className="meter-label">Focus Score</div>
                <div className="meter-ring">
                    <svg viewBox="0 0 36 36" className="circular-chart">
                        <path className="circle-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path className={`circle ${focusVal > 75 ? 'good' : (focusVal > 40 ? 'warn' : 'bad')}`}
                            strokeDasharray={`${focusVal}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <text x="18" y="20.35" className="percentage">{Math.round(focusVal)}%</text>
                    </svg>
                </div>
                {!isCalibrated && (
                   <div className="calibration-box">
                       <div className="calib-label">Calibrating...</div>
                       <div className="calib-bar">
                           <div className="calib-progress" style={{ width: `${calibrationProgress}%` }} />
                       </div>
                   </div>
                )}
            </div>
        </div>
    );
};

export default FocusMonitor;
