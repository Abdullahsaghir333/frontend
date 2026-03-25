import { useMemo, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import FocusMonitor from '../components/FocusMonitor';

const PYTHON_API = 'http://127.0.0.1:8000/api';
const NODE_API = 'http://localhost:5000/api';

export default function SessionRoom() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { id: sessionId } = useParams();

    const [mongoSessionId, setMongoSessionId] = useState(location.state?.mongoSessionId || null);
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState(null);
    const [slides, setSlides] = useState([]);

    const [slideIndex, setSlideIndex] = useState(0);
    const [activePoint, setActivePoint] = useState(0);
    const [displayedText, setDisplayedText] = useState('');

    // teacher states: teaching | listening | answering | confirming
    const [teacherState, setTeacherState] = useState('teaching');

    const [qaQuestion, setQaQuestion] = useState('');
    const [qaBulletPoints, setQaBulletPoints] = useState(null);
    const [whiteboardPlan, setWhiteboardPlan] = useState(null);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([
        { id: 1, from: 'teacher', text: "Hello! Let's begin the session. Interrupt me anytime with a question!", time: 'Now' }
    ]);

    const [focusStats, setFocusStats] = useState({ average: 100, current: 100, count: 1 });

    // ── Refs (avoid stale closures in event handlers) ──────
    const teacherStateRef = useRef('teaching');
    const slideIndexRef = useRef(0);
    const activePointRef = useRef(0);
    const sessionIdRef = useRef(sessionId);

    const audioRef = useRef(null);
    const qaAudioRef = useRef(null);
    const recognitionRef = useRef(null);
    const stopRecognitionRef = useRef(false);
    const handlingSpeechRef = useRef(false);
    const questionBufferRef = useRef('');
    const silenceTimerRef = useRef(null);
    const pausedAudioTimeRef = useRef(0);
    const isAlarmingRef = useRef(false);
    const preloadedAudioRef = useRef({});

    // Keep refs in sync with state
    useEffect(() => { teacherStateRef.current = teacherState; }, [teacherState]);
    useEffect(() => { slideIndexRef.current = slideIndex; }, [slideIndex]);
    useEffect(() => { activePointRef.current = activePoint; }, [activePoint]);
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

    const teacherStatus = useMemo(() => {
        if (teacherState === 'listening') return 'Listening to your question…';
        if (teacherState === 'answering') return 'Answering your question…';
        if (teacherState === 'confirming') return 'Say "clear" to resume teaching…';
        return 'Teaching from the slide…';
    }, [teacherState]);

    // ── Focus handler ──────────────────────────────────────
    const handleFocusUpdate = useCallback((data) => {
        if (data.isAlarming && !isAlarmingRef.current) {
            if (teacherStateRef.current === 'teaching') audioRef.current?.pause();
            else if (teacherStateRef.current === 'answering') qaAudioRef.current?.pause();
        } else if (!data.isAlarming && isAlarmingRef.current) {
            if (teacherStateRef.current === 'teaching' && audioRef.current) audioRef.current.play().catch(() => { });
            else if (teacherStateRef.current === 'answering' && qaAudioRef.current) qaAudioRef.current.play().catch(() => { });
        }
        isAlarmingRef.current = data.isAlarming;

        setFocusStats(prev => {
            const newCount = prev.count + 1;
            const newAvg = ((prev.average * prev.count) + data.focusScore) / newCount;
            return { current: Math.round(data.focusScore), average: Math.round(newAvg), count: newCount };
        });

        if (mongoSessionId) {
            axios.post(`${NODE_API}/focus`, {
                sessionId: mongoSessionId,
                status: data.isAlarming ? 'distracted' : (data.rawStatus === 'Looked Away' ? 'away' : 'focused'),
                focusScore: data.focusScore
            }, { withCredentials: true }).catch(() => { });
        }
    }, [mongoSessionId]);

    // ── Session fetch ──────────────────────────────────────
    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await axios.get(`${PYTHON_API}/session/${sessionId}`);
                setSessionData(res.data);
                const theSlides = res.data.slides || res.data.state?.slides || [];
                setSlides(theSlides);

                if (!mongoSessionId) {
                    try {
                        const dbRes = await axios.get(`${NODE_API}/sessions`, { withCredentials: true });
                        const match = dbRes.data.find(s => s.pythonSessionId === sessionId);
                        if (match) setMongoSessionId(match._id);
                    } catch (_) { /* non-fatal */ }
                }
            } catch (err) {
                console.error('Error fetching session:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSession();
        initRecognition();

        return () => {
            stopRecognitionRef.current = true;
            try { recognitionRef.current?.stop(); } catch (_) { }
            audioRef.current?.pause();
            qaAudioRef.current?.pause();
        };
    }, [sessionId]);

    const slide = slides[slideIndex];

    // ── Prefetch Audio Blobs ───────────────────────────────
    useEffect(() => {
        if (!sessionId || slides.length === 0) return;

        const preload = async (idx) => {
            if (idx >= slides.length) return;
            if (preloadedAudioRef.current[idx] || preloadedAudioRef.current[`fetching_${idx}`]) return;

            preloadedAudioRef.current[`fetching_${idx}`] = true;
            try {
                const res = await fetch(`${PYTHON_API}/session/${sessionId}/slides/${idx}/audio`);
                if (res.ok) {
                    const blob = await res.blob();
                    preloadedAudioRef.current[idx] = URL.createObjectURL(blob);
                }
            } catch (err) {
                console.error('Audio preload failed for slide', idx, err);
            } finally {
                delete preloadedAudioRef.current[`fetching_${idx}`];
            }
        };

        // Preload current, next, and the one after
        preload(slideIndex);
        preload(slideIndex + 1);
        preload(slideIndex + 2);
    }, [slideIndex, slides.length, sessionId]);

    // ── Slide audio playback ───────────────────────────────
    useEffect(() => {
        if (!sessionId || slides.length === 0) return;

        const playStream = async () => {
            // Preload next slide audio in background
            if (slideIndex < slides.length - 1) {
                fetch(`${PYTHON_API}/session/${sessionId}/slides/${slideIndex + 1}/audio`).catch(() => { });
            }

            try {
                if (!audioRef.current) audioRef.current = new Audio();
                const a = audioRef.current;
                a.crossOrigin = 'anonymous';
                a.pause();
                a.src = `${PYTHON_API}/session/${sessionId}/slides/${slideIndex}/audio`;
                a.currentTime = 0;

                if (teacherStateRef.current === 'teaching' && !isAlarmingRef.current) {
                    await a.play().catch(e => console.warn('Audio play prevented (requires user interaction first)', e));
                }
            } catch (err) {
                console.error('Failed to play slide audio', err);
            }
        };
        playStream();
    }, [slideIndex, sessionId, slides.length]);

    // ── Bullet point timing ────────────────────────────────
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;

        const onTime = () => {
            if (teacherStateRef.current !== 'teaching') return;
            const tms = a.currentTime * 1000;
            const timings = slide?.point_timings || [];
            for (const tm of timings) {
                if (tms >= tm.start_ms && tms < tm.end_ms) {
                    setActivePoint(tm.point_index);
                    break;
                }
            }
        };

        const onEnded = () => {
            if (teacherStateRef.current === 'teaching' && slideIndex < slides.length - 1) {
                setSlideIndex(i => i + 1);
                setActivePoint(0);
                setWhiteboardPlan(null);
                setDisplayedText('');
            }
        };

        a.addEventListener('timeupdate', onTime);
        a.addEventListener('ended', onEnded);
        return () => {
            a.removeEventListener('timeupdate', onTime);
            a.removeEventListener('ended', onEnded);
        };
    }, [slide, slideIndex, slides.length]);

    // ── Typing effect ──────────────────────────────────────
    useEffect(() => {
        if (!slide?.points) return;
        const pt = slide.points[activePoint];
        const text = typeof pt === 'string' ? pt : pt?.text || '';
        let i = 0;
        let current = '';
        setDisplayedText('');
        const interval = setInterval(() => {
            if (i < text.length) {
                current += text.charAt(i);
                setDisplayedText(current);
                i++;
            } else {
                clearInterval(interval);
            }
        }, 30);
        return () => clearInterval(interval);
    }, [activePoint, slideIndex, slide]);

    // ── Speech recognition ─────────────────────────────────
    const initRecognition = () => {
        try {
            if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recog = new SpeechRecognition();

            recog.continuous = true;
            recog.interimResults = true;
            recog.lang = 'en-US';

            recog.onstart = () => {
                console.log('[STT] Mic Active ✓');
                stopRecognitionRef.current = false;
            };

            recog.onerror = (e) => {
                console.warn('[STT] Error:', e.error);
            };

            recog.onresult = (ev) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = ev.resultIndex; i < ev.results.length; ++i) {
                    if (ev.results[i].isFinal) finalTranscript += ev.results[i][0].transcript;
                    else interimTranscript += ev.results[i][0].transcript;
                }
                const currentText = finalTranscript || interimTranscript;
                if (currentText.trim()) handleSpeechTranscript(currentText.trim());
            };

            recog.onend = () => {
                // ONLY restart if the state is 'listening' or 'confirming'
                const shouldRestart = teacherStateRef.current === 'listening' || teacherStateRef.current === 'confirming';
                if (shouldRestart && !stopRecognitionRef.current) {
                    try { recog.start(); } catch (_) { }
                } else {
                    console.log('[STT] Mic turned off (Not in Listening state)');
                }
            };

            recognitionRef.current = recog;
            // DO NOT call recog.start() here.
        } catch (e) {
            console.error('[STT] Init failed:', e);
        }
    };
    // ── FIX: handleSpeechTranscript now handles ALL states ──
    const handleSpeechTranscript = (transcript) => {
        const currentState = teacherStateRef.current;
        const lower = transcript.toLowerCase();

        // 1. If teaching, any sound should trigger the "Listening" lock
        if (currentState === 'teaching') {
            enterListeningMode();
            questionBufferRef.current = transcript;
            resetSilenceTimer();
            return;
        }

        // 2. If already listening, keep appending and resetting the 2s timer
        if (currentState === 'listening') {
            questionBufferRef.current = transcript; // Recognition provides the full context in onresult
            resetSilenceTimer();
            return;
        }

        // 3. Confirming state
        if (currentState === 'confirming') {
            if (lower.includes('clear') || lower.includes('okay') || lower.includes('yes')) {
                resumeTeaching();
            } else if (lower.length > 5) { // If they ask a real follow-up
                enterListeningMode();
                questionBufferRef.current = transcript;
                resetSilenceTimer();
            }
        }
    };
    // Transition to listening state and pause audio
    const enterListeningMode = () => {
        console.log('[STT] Starting Voice Capture...');
        if (audioRef.current) {
            pausedAudioTimeRef.current = audioRef.current.currentTime;
            audioRef.current.pause();
        }
        questionBufferRef.current = '';
        setTeacherState('listening');
        teacherStateRef.current = 'listening';

        // Force Start the Mic manually
        stopRecognitionRef.current = false;
        try {
            recognitionRef.current?.start();
        } catch (e) {
            console.warn("Mic already active or failed to start");
        }
    };

    const resumeTeaching = () => {
        setTeacherState('teaching');
        teacherStateRef.current = 'teaching';
        setQaBulletPoints(null);
        setQaQuestion('');
        setWhiteboardPlan(null);
        handlingSpeechRef.current = false;

        // Turn OFF the Mic when returning to lecture
        stopRecognitionRef.current = true;
        try {
            recognitionRef.current?.stop();
        } catch (e) { }

        if (audioRef.current) {
            audioRef.current.currentTime = pausedAudioTimeRef.current;
            audioRef.current.play().catch(err => console.error("Playback failed:", err));
        }
    };

    // Reset the 2s silence timer — fires flushQuestionBuffer when user stops talking
    const resetSilenceTimer = () => {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(flushQuestionBuffer, 2000);
    };

    const flushQuestionBuffer = async () => {
        const currentState = teacherStateRef.current;
        const questionText = questionBufferRef.current.trim();

        console.log('[STT] Flush triggered. Buffer:', questionText);

        if (currentState !== 'listening') return;

        if (!questionText) {
            // Only resume if we've been listening for a while and truly heard nothing
            console.log('[STT] Nothing heard, resuming lecture...');
            resumeTeaching();
            return;
        }

        // We have a question! 
        await submitQuestionToBackend(questionText);
    };

    const submitQuestionToBackend = async (questionText) => {
        const sid = sessionIdRef.current;
        if (!sid) return;

        console.log('[QA] Submitting:', questionText);

        // Stop recognition while we process — prevents double-triggering
        stopRecognitionRef.current = true;
        try { recognitionRef.current?.stop(); } catch (_) { }

        try {
            setMessages(prev => [...prev, { id: Date.now(), from: 'student', text: questionText, time: 'Now' }]);
            setTeacherState('answering');
            teacherStateRef.current = 'answering';
            handlingSpeechRef.current = true;

            // ── 1. Get text answer ─────────────────────────
            const res = await fetch(`${PYTHON_API}/session/${sid}/question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: questionText,
                    slide_index: slideIndexRef.current,
                    point_index: activePointRef.current,
                }),
            });

            if (!res.ok) {
                if (res.status === 429 || res.status === 503) {
                    alert('AI is busy. Please wait a moment and try again.');
                }
                throw new Error(`Question API returned ${res.status}`);
            }

            const data = await res.json();
            console.log('[QA] Got answer:', data);

            setQaQuestion(questionText);
            setQaBulletPoints(data.bullet_points || []);
            setWhiteboardPlan(null);

            const detailAns = data.detail_ans || data.answer || '';
            if (detailAns) {
                setMessages(prev => [...prev, { id: Date.now() + 1, from: 'teacher', text: detailAns, time: 'Now' }]);
            }

            // ── 2. Get TTS audio for the answer ───────────
            if (detailAns) {
                await playAnswerAudio(sid, detailAns);
            } else {
                // No answer text — go straight to confirming
                transitionToConfirming();
            }

        } catch (err) {
            console.error('[QA] Failed:', err);
            setMessages(prev => [...prev, {
                id: Date.now(),
                from: 'teacher',
                text: 'Sorry, I had trouble answering that. Let\'s continue.',
                time: 'Now'
            }]);
            resumeTeaching();
        }
    };

    const playAnswerAudio = async (sid, detailAns) => {
        try {
            if (!qaAudioRef.current) qaAudioRef.current = new Audio();
            const qa = qaAudioRef.current;

            const audioRes = await fetch(`${PYTHON_API}/session/${sid}/question/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: detailAns }),
            });

            // If state changed while we were waiting for audio, abort
            if (teacherStateRef.current !== 'answering') return;

            if (!audioRes.ok) {
                console.warn('[QA] Audio endpoint returned', audioRes.status, '— skipping audio');
                transitionToConfirming();
                return;
            }

            const adata = await audioRes.json();
            const chunks = adata.chunks || [];

            if (chunks.length === 0) {
                transitionToConfirming();
                return;
            }

            // Play chunks sequentially
            let currIdx = 0;
            const playNext = async () => {
                if (teacherStateRef.current !== 'answering') return;

                if (currIdx >= chunks.length) {
                    transitionToConfirming();
                    return;
                }

                try {
                    const base64Str = chunks[currIdx];
                    const byteChars = atob(base64Str);
                    const byteArr = new Uint8Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                    const blob = new Blob([byteArr], { type: 'audio/mpeg' });
                    const url = URL.createObjectURL(blob);

                    qa.src = url;
                    qa.onended = () => {
                        URL.revokeObjectURL(url);
                        currIdx++;
                        playNext();
                    };
                    qa.onerror = () => {
                        currIdx++;
                        playNext();
                    };
                    await qa.play();
                } catch (e) {
                    currIdx++;
                    playNext();
                }
            };

            await playNext();

        } catch (err) {
            console.error('[QA] Audio playback failed:', err);
            transitionToConfirming();
        }
    };

    const transitionToConfirming = () => {
        setTeacherState('confirming');
        teacherStateRef.current = 'confirming';
        handlingSpeechRef.current = false;
        // Resume speech recognition so student can say "clear"
        stopRecognitionRef.current = false;
        setTimeout(() => {
            try { recognitionRef.current?.start(); } catch (_) { }
        }, 300);
    };


    const sendQuestionManual = async () => {
        const q = question.trim();
        if (!q || !sessionId) return;
        setQuestion('');
        enterListeningMode();
        await submitQuestionToBackend(q);
    };

    const endSession = async () => {
        audioRef.current?.pause();
        try {
            if (mongoSessionId) {
                await axios.patch(`${NODE_API}/sessions/${mongoSessionId}`, {
                    status: 'completed',
                    duration: 300,
                    focusScore: focusStats.average,
                    topicsCovered: Math.max(1, slideIndex + 1)
                }, { withCredentials: true });
                await axios.post(`${NODE_API}/notes/compile`, { sessionId: mongoSessionId }, { withCredentials: true });
            }
        } catch (err) {
            console.error('Error ending session:', err);
        } finally {
            navigate('/sessions');
        }
    };

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff' }}>
            Loading Session…
        </div>
    );

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#020617' }}>
            <Sidebar />

            <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <main className="sessionPage">

                    {/* ── CENTER STAGE (SLIDES) ── */}
                    <section className="sessionMain">
                        <div className="card slideCard h-full flex flex-col items-stretch">
                            <div className="slideHeader">
                                <div>
                                    <div className="slideLabel">{whiteboardPlan ? 'Q&A Whiteboard' : 'Current slide'}</div>
                                    <div className="slideTitle">
                                        {whiteboardPlan ? 'Explaining…' : slide?.title || 'Loading content…'}
                                    </div>
                                </div>
                                <div className="slideCount flex gap-2">
                                    <span className={`statusIndicator ${teacherState}`}></span>
                                    {teacherStatus}
                                </div>
                            </div>

                            {qaBulletPoints ? (
                                <div className="whiteboardDrawArea fade-in flex-1">
                                    <div style={{ width: '100%', padding: '0 20px' }}>
                                        <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: 12 }}>
                                            Q&A Answer — Key Points
                                        </div>
                                        {qaQuestion && (
                                            <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: 20, fontStyle: 'italic', borderLeft: '4px solid #a855f7', paddingLeft: 16, color: '#e5e7eb' }}>
                                                Q: {qaQuestion}
                                            </div>
                                        )}
                                        <ul className="slideList">
                                            {qaBulletPoints.map((point, idx) => (
                                                <li key={idx} className="active" style={{ fontSize: '1.3em', marginBottom: 10 }}>{point}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ) : whiteboardPlan ? (
                                <div className="whiteboardDrawArea fade-in flex-1">
                                    <div className="handwriting font-marker">
                                        {whiteboardPlan.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                                    </div>
                                </div>
                            ) : (
                                <ul className="slideList flex-1">
                                    {slide?.points?.map((p, idx) => {
                                        const pText = typeof p === 'string' ? p : p.text;
                                        const isPast = idx < activePoint;
                                        const isActive = idx === activePoint;
                                        return (
                                            <li key={idx} className={isActive ? 'active' : isPast ? 'past' : 'hidden'}>
                                                {isActive ? (displayedText || '\u00A0') : pText}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}

                            {/* Controls */}
                            <div className="slideActions" style={{ justifyContent: 'center', marginTop: 'auto', paddingTop: 20 }}>
                                <button className="btnOutline" onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}>
                                    Previous
                                </button>

                                {teacherState === 'teaching' && (
                                    <button
                                        className="btn-primary"
                                        style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
                                        onClick={enterListeningMode}
                                    >
                                        🎤 Interrupt & Ask
                                    </button>
                                )}

                                {(teacherState === 'listening' || teacherState === 'confirming') && (
                                    <button
                                        className="btn-primary"
                                        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                                        onClick={resumeTeaching}
                                    >
                                        ▶ Resume Teaching
                                    </button>
                                )}

                                {teacherState === 'answering' && (
                                    <button className="btnOutline" disabled style={{ opacity: 0.5 }}>
                                        Answering…
                                    </button>
                                )}

                                <button className="btnOutline" onClick={() => setSlideIndex(Math.min(slides.length - 1, slideIndex + 1))}>
                                    Next
                                </button>

                                <button
                                    className="btnOutline"
                                    style={{ borderColor: '#ef4444', color: '#ef4444', marginLeft: 20 }}
                                    onClick={endSession}
                                >
                                    End Session
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── SIDE PANEL ── */}
                    <aside className="sessionSide">
                        <FocusMonitor sessionId={sessionId} onFocusUpdate={handleFocusUpdate} />

                        <div className="card chatCard">
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>Teacher Chat</div>
                                <div style={{ fontSize: 12, color: '#888' }}>Ask questions via voice or text</div>
                            </div>

                            <div className="chatBody">
                                {messages.map((m) => (
                                    <div key={m.id} className={`msg ${m.from === 'teacher' ? 'msgTeacher' : 'msgStudent'}`}>
                                        <div className="msgMeta">
                                            <span className="msgFrom">{m.from === 'teacher' ? 'AI Teacher' : 'You'}</span>
                                        </div>
                                        <div className="msgText">{m.text}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="chatComposer">
                                <textarea
                                    className="chatInput"
                                    rows={2}
                                    placeholder="Type a question and press Enter…"
                                    value={question}
                                    onChange={e => setQuestion(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestionManual(); } }}
                                />
                                <button className="btn-primary !px-4 !py-2 !rounded-lg" onClick={sendQuestionManual}>
                                    Send
                                </button>
                            </div>
                        </div>
                    </aside>

                </main>
            </div>
        </div>
    );
}