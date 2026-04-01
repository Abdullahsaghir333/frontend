import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useContext, useCallback, Suspense } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import FocusMonitor from '../components/FocusMonitor';
import { MessageSquare, ChevronRight } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useAudioAnalyser } from '../hooks/useAudioAnalyser';

const PYTHON_API = 'http://127.0.0.1:8000/api';
const NODE_API = '/api';

class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info); }
    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{ color: '#f87171', padding: 16, background: 'rgba(239,68,68,0.08)', borderRadius: 8, fontSize: 13, border: '1px solid rgba(239,68,68,0.3)' }}>
                    ⚠ Component failed: {String(this.state.error?.message || 'unknown error')}
                </div>
            );
        }
        return this.props.children;
    }
}

const TypewriterText = ({ text }) => {
    const [displayed, setDisplayed] = useState('');
    useEffect(() => {
        if (!text) { setDisplayed(''); return; }
        let i = 0; let current = '';
        setDisplayed('');
        const interval = setInterval(() => {
            if (i < text.length) { current += text.charAt(i); setDisplayed(current); i++; }
            else clearInterval(interval);
        }, 15);
        return () => clearInterval(interval);
    }, [text]);
    return <span>{displayed}{displayed.length < (text?.length ?? 0) ? <span className="typewriter-cursor" /> : null}</span>;
};

export default function SessionRoom() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const { id: sessionId, slideIndex: slideIndexParam } = useParams();

    const routeSlideIndex = useMemo(() => {
        const n = Number.parseInt(slideIndexParam ?? '0', 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }, [slideIndexParam]);

    const [mongoSessionId, setMongoSessionId] = useState(location.state?.mongoSessionId || null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [sessionData, setSessionData] = useState(null);
    const [slides, setSlides] = useState([]);

    const [slideIndex, setSlideIndex] = useState(routeSlideIndex);
    const [activePoint, setActivePoint] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [teacherState, setTeacherState] = useState('teaching');

    const [qaQuestion, setQaQuestion] = useState('');
    const [qaBulletPoints, setQaBulletPoints] = useState(null);
    const [whiteboardPlan, setWhiteboardPlan] = useState(null);
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([
        { id: 1, from: 'teacher', text: "Hello! Let's begin the session. Interrupt me anytime with a question!", time: 'Now' }
    ]);
    const [awaitingFinalDecision, setAwaitingFinalDecision] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    const [focusStats, setFocusStats] = useState({ average: 100, current: 100, count: 1 });
    const [focusMonitorUsed, setFocusMonitorUsed] = useState(false);
    const [bookmarkedKeys, setBookmarkedKeys] = useState(() => new Set());
    const [justBookmarkedKeys, setJustBookmarkedKeys] = useState(() => new Set());
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [audioLoading, setAudioLoading] = useState(true);
    const [interruptRipple, setInterruptRipple] = useState(false);
    const [slidePlaybackProgress, setSlidePlaybackProgress] = useState(0);

    const avatarStageMode = useMemo(() => {
        if (qaBulletPoints) return 'qa';
        if (whiteboardPlan) return 'whiteboard';
        if (awaitingFinalDecision) return 'complete';
        return 'slides';
    }, [qaBulletPoints, whiteboardPlan, awaitingFinalDecision]);

    // ── Refs ──
    const mongoSessionIdRef = useRef(mongoSessionId);
    useEffect(() => { mongoSessionIdRef.current = mongoSessionId; }, [mongoSessionId]);
    const slidesRef = useRef(slides);
    useEffect(() => { slidesRef.current = slides; }, [slides]);
    const teacherStateRef = useRef('teaching');
    const slideIndexRef = useRef(0);
    const activePointRef = useRef(0);
    const sessionIdRef = useRef(sessionId);

    const audioRef = useRef(null);
    const qaAudioRef = useRef(null);
    if (typeof window !== 'undefined') {
        if (!audioRef.current) audioRef.current = new Audio();
        if (!qaAudioRef.current) qaAudioRef.current = new Audio();
    }

    const recognitionRef = useRef(null);
    const stopRecognitionRef = useRef(false);
    const handlingSpeechRef = useRef(false);
    const questionBufferRef = useRef('');
    const silenceTimerRef = useRef(null);
    const pausedAudioTimeRef = useRef(0);
    const isAlarmingRef = useRef(false);
    const preloadedAudioRef = useRef({});
    const sessionStartedAtRef = useRef(Date.now());

    useEffect(() => { teacherStateRef.current = teacherState; }, [teacherState]);
    useEffect(() => { slideIndexRef.current = slideIndex; }, [slideIndex]);
    useEffect(() => { activePointRef.current = activePoint; }, [activePoint]);
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
    useEffect(() => { setSlideIndex(routeSlideIndex); }, [routeSlideIndex]);
    useEffect(() => { setSlidePlaybackProgress(0); }, [slideIndex]);

    // ── Audio progress sync ──
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        const syncProgress = () => {
            if (teacherStateRef.current !== 'teaching') return;
            const d = a.duration;
            if (d && isFinite(d) && d > 0) setSlidePlaybackProgress(Math.min(1, Math.max(0, a.currentTime / d)));
        };
        a.addEventListener('timeupdate', syncProgress);
        a.addEventListener('seeked', syncProgress);
        a.addEventListener('loadedmetadata', syncProgress);
        return () => {
            a.removeEventListener('timeupdate', syncProgress);
            a.removeEventListener('seeked', syncProgress);
            a.removeEventListener('loadedmetadata', syncProgress);
        };
    }, [slideIndex, slides.length, loading]);

    const teacherStatus = useMemo(() => {
        if (teacherState === 'listening') return 'Listening to your question…';
        if (teacherState === 'answering') return 'Answering your question…';
        if (teacherState === 'confirming') return 'Say "clear" to resume teaching…';
        return 'Teaching from the slide…';
    }, [teacherState]);

    const slideAudio = useAudioAnalyser(audioRef);
    const qaAudio = useAudioAnalyser(qaAudioRef);
    const getVolume = useCallback(() => (teacherState === 'answering' ? qaAudio.getVolume() : slideAudio.getVolume()), [teacherState, qaAudio, slideAudio]);
    const getLipSync = useCallback(() => (teacherState === 'answering' ? qaAudio.getLipSync() : slideAudio.getLipSync()), [teacherState, qaAudio, slideAudio]);

    // Browsers often start AudioContext suspended; resume on first interaction so lip-sync analyser works.
    useEffect(() => {
        const resume = () => {
            slideAudio.resumeAudio?.();
            qaAudio.resumeAudio?.();
        };
        window.addEventListener('pointerdown', resume, { passive: true });
        window.addEventListener('keydown', resume);
        return () => {
            window.removeEventListener('pointerdown', resume);
            window.removeEventListener('keydown', resume);
        };
    }, [slideAudio, qaAudio]);

    // ── Focus handler ──
    const handleFocusUpdate = useCallback((data) => {
        if (data.isAlarming && !isAlarmingRef.current) {
            if (teacherStateRef.current === 'teaching') audioRef.current?.pause();
            else if (teacherStateRef.current === 'answering') qaAudioRef.current?.pause();
        } else if (!data.isAlarming && isAlarmingRef.current) {
            if (teacherStateRef.current === 'teaching') audioRef.current?.play().catch(() => { });
            else if (teacherStateRef.current === 'answering') qaAudioRef.current?.play().catch(() => { });
        }
        isAlarmingRef.current = data.isAlarming;
        setFocusStats(prev => {
            const newCount = prev.count + 1;
            const newAvg = ((prev.average * prev.count) + data.focusScore) / newCount;
            return { current: Math.round(data.focusScore), average: Math.round(newAvg), count: newCount };
        });
        if (mongoSessionIdRef.current) {
            axios.post(`${NODE_API}/focus`, {
                sessionId: mongoSessionIdRef.current,
                status: data.isAlarming ? 'distracted' : (data.rawStatus === 'DISTRACTED' ? 'away' : 'focused'),
                focusScore: data.focusScore
            }, { withCredentials: true }).catch(() => { });
        }
    }, []);

    // ── Session fetch ──
    useEffect(() => {
        if (!sessionId) { setLoadError('No session ID in URL.'); setLoading(false); return; }

        const fetchSession = async () => {
            try {
                let sessionDataToUse = null;
                try {
                    const res = await axios.get(`${PYTHON_API}/session/${sessionId}`);
                    sessionDataToUse = res.data;
                } catch (pyErr) {
                    if (pyErr.response && pyErr.response.status === 404) {
                        try {
                            const dbRes = await axios.get(`${NODE_API}/sessions`, { withCredentials: true });
                            const match = dbRes.data.find(s => s.pythonSessionId === sessionId);
                            if (match && match.slidesData && match.slidesData.length > 0) {
                                const restoreRes = await axios.post(`${PYTHON_API}/session/${sessionId}/restore`, {
                                    notes_text: match.notesText || '', slides: match.slidesData, difficulty: match.difficulty || 'medium'
                                });
                                sessionDataToUse = restoreRes.data;
                                if (match.chatHistory?.length > 0) setMessages(match.chatHistory);
                                setMongoSessionId(match._id); mongoSessionIdRef.current = match._id;
                            } else throw new Error('No restore data found');
                        } catch (restoreErr) { throw restoreErr; }
                    } else throw pyErr;
                }

                setSessionData(sessionDataToUse);
                const theSlides = sessionDataToUse?.slides || sessionDataToUse?.state?.slides || [];
                setSlides(theSlides);

                if (!mongoSessionIdRef.current) {
                    try {
                        const dbRes = await axios.get(`${NODE_API}/sessions`, { withCredentials: true });
                        const match = dbRes.data.find(s => s.pythonSessionId === sessionId);
                        if (match) {
                            setMongoSessionId(match._id); mongoSessionIdRef.current = match._id;
                            if (match.chatHistory?.length > 0) setMessages(match.chatHistory);
                        } else {
                            const fallbackTitle = (location.state?.fileName ? String(location.state.fileName).replace(/\.[^/.]+$/, '') : null) || `Session ${sessionId.slice(0, 8)}`;
                            const created = await axios.post(`${NODE_API}/sessions`, {
                                pythonSessionId: sessionId, title: fallbackTitle,
                                fileName: location.state?.fileName || 'Uploaded material',
                                topicsTotal: (theSlides || []).length || 0,
                            }, { withCredentials: true });
                            const newId = created.data?._id || null;
                            setMongoSessionId(newId); mongoSessionIdRef.current = newId;
                        }
                    } catch (_) { }
                }
            } catch (err) {
                console.error('Error fetching/restoring session:', err);
                setLoadError(`Failed to load session: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchSession();
        initRecognition();

        const wsUrl = `${PYTHON_API.replace('http', 'ws')}/session/${sessionId}/ws`;
        let ws;
        try {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'session_slides' && data.session) { setSessionData(data.session); setSlides(data.session.slides || []); return; }
                    if (data.type === 'slide_ready') {
                        setSlides(prev => {
                            const newSlides = [...prev];
                            const idx = data.slide_id;
                            while (newSlides.length <= idx) newSlides.push(null);
                            newSlides[idx] = { ...(newSlides[idx] || {}), ...(data.slide || {}) };
                            return newSlides;
                        });
                    }
                } catch (e) { console.warn('[WS] Parse error:', e); }
            };
            ws.onclose = () => console.debug('[WS] Disconnected');
            ws.onerror = () => { };
        } catch (wsErr) { console.warn('[WS] Could not connect:', wsErr); }

        return () => {
            if (ws) { ws.onerror = null; if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'unmount'); }
            stopRecognitionRef.current = true;
            try { recognitionRef.current?.stop(); } catch (_) { }
            audioRef.current?.pause();
            qaAudioRef.current?.pause();
        };
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId || !slides || slides.length === 0) return;
        if (slideIndex < 0) { navigate(`/session/${sessionId}/slide/0`, { replace: true }); return; }
        if (slideIndex > slides.length - 1) navigate(`/session/${sessionId}/slide/${slides.length - 1}`, { replace: true });
    }, [slides.length, slideIndex, sessionId, navigate]);

    // ── Prefetch audio ──
    useEffect(() => {
        if (!sessionId || slides.length === 0) return;
        const preload = async (idx) => {
            if (idx >= slides.length) return;
            if (preloadedAudioRef.current[idx] || preloadedAudioRef.current[`fetching_${idx}`]) return;
            preloadedAudioRef.current[`fetching_${idx}`] = true;
            try {
                const res = await fetch(`${PYTHON_API}/session/${sessionId}/slides/${idx}/audio`);
                if (res.ok) { const blob = await res.blob(); preloadedAudioRef.current[idx] = URL.createObjectURL(blob); }
            } catch (err) { console.error('Audio preload failed for slide', idx, err); }
            finally { delete preloadedAudioRef.current[`fetching_${idx}`]; }
        };
        preload(slideIndex); preload(slideIndex + 1); preload(slideIndex + 2);
    }, [slideIndex, slides.length, sessionId]);

    // ── Slide audio playback ──
    useEffect(() => {
        if (!sessionId || slides.length === 0) return;
        const currentSlide = slides[slideIndex];
        if (!currentSlide || !currentSlide.script || !currentSlide.points?.length) { setAudioLoading(false); return; }
        const playStream = async () => {
            try {
                setAudioLoading(true);
                if (!audioRef.current) audioRef.current = new Audio();
                const a = audioRef.current;
                a.crossOrigin = 'anonymous';
                a.pause();
                a.src = `${PYTHON_API}/session/${sessionId}/slides/${slideIndex}/audio`;
                a.currentTime = 0;
                a.oncanplaythrough = () => setAudioLoading(false);
                if (teacherStateRef.current === 'teaching' && !isAlarmingRef.current) {
                    const p = a.play();
                    if (p !== undefined) p.catch(e => { if (e?.name === 'AbortError') return; console.warn('Audio play prevented:', e); setAudioLoading(false); });
                } else setAudioLoading(false);
            } catch (err) { console.error('Failed to play slide audio:', err); setAudioLoading(false); }
        };
        playStream();
    }, [slideIndex, sessionId, slides, slides.length]);

    const slide = slides[slideIndex] ?? null;

    /** Instructor beside the active bullet; hide bottom-right PiP in this mode */
    const showInlineInstructor = useMemo(() => (
        (slide?.points?.length ?? 0) > 0 &&
        !qaBulletPoints &&
        !whiteboardPlan &&
        !awaitingFinalDecision &&
        !audioLoading
    ), [slide?.points?.length, qaBulletPoints, whiteboardPlan, awaitingFinalDecision, audioLoading]);

    const activePointRowRef = useRef(null);

    useLayoutEffect(() => {
        if (!showInlineInstructor) return;
        const el = activePointRowRef.current;
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [activePoint, slideIndex, showInlineInstructor]);

    // ── Bullet point timing ──
    useEffect(() => {
        const a = audioRef.current;
        if (!a || !slide) return;
        const onTime = () => {
            if (teacherStateRef.current !== 'teaching') return;
            const tms = a.currentTime * 1000;
            const timings = slide?.point_timings || [];
            for (const tm of timings) {
                if (tms >= tm.start_ms && tms < tm.end_ms) { setActivePoint(tm.point_index); break; }
            }
        };
        const onEnded = () => {
            if (teacherStateRef.current === 'teaching' && slideIndex < slides.length - 1) {
                navigate(`/session/${sessionId}/slide/${slideIndex + 1}`);
                setActivePoint(0); setWhiteboardPlan(null); setDisplayedText(''); return;
            }
            if (teacherStateRef.current === 'teaching' && slideIndex === slides.length - 1) askPostSessionQuestion();
        };
        a.addEventListener('timeupdate', onTime);
        a.addEventListener('ended', onEnded);
        return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnded); };
    }, [slide, slideIndex, slides.length]);

    // ── Typing effect ──
    useEffect(() => {
        if (!slide?.points) return;
        const pt = slide.points[activePoint];
        const text = typeof pt === 'string' ? pt : pt?.text || '';
        let i = 0; let current = '';
        setDisplayedText('');
        const interval = setInterval(() => {
            if (i < text.length) { current += text.charAt(i); setDisplayedText(current); i++; }
            else clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
    }, [activePoint, slideIndex, slide]);

    // ── Speech recognition ──
    const initRecognition = () => {
        try {
            if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recog = new SpeechRecognition();
            recog.continuous = true; recog.interimResults = true; recog.lang = 'en-US';
            recog.onstart = () => { stopRecognitionRef.current = false; };
            recog.onerror = (e) => { console.warn('[STT] Error:', e.error); };
            recog.onresult = (ev) => {
                let interim = '', final = '';
                for (let i = ev.resultIndex; i < ev.results.length; ++i) {
                    if (ev.results[i].isFinal) final += ev.results[i][0].transcript;
                    else interim += ev.results[i][0].transcript;
                }
                const text = final || interim;
                if (text.trim()) handleSpeechTranscript(text.trim());
            };
            recog.onend = () => {
                const shouldRestart = teacherStateRef.current === 'listening' || teacherStateRef.current === 'confirming';
                if (shouldRestart && !stopRecognitionRef.current) try { recog.start(); } catch (_) { }
            };
            recognitionRef.current = recog;
        } catch (e) { console.error('[STT] Init failed:', e); }
    };

    const handleSpeechTranscript = (transcript) => {
        const currentState = teacherStateRef.current;
        const lower = transcript.toLowerCase();
        if (awaitingFinalDecision) {
            if (lower.includes('no') || lower.includes('nope') || lower.includes('nah')) { finalizeSessionAndOpenNotes(); return; }
            if (lower.includes('yes') || lower.includes('question')) {
                setAwaitingFinalDecision(false);
                setMessages(prev => [...prev, { id: Date.now(), from: 'teacher', text: 'Great, ask your final question now.', time: 'Now' }]);
                enterListeningMode(); return;
            }
            return;
        }
        if (currentState === 'teaching') { enterListeningMode(); questionBufferRef.current = transcript; resetSilenceTimer(); return; }
        if (currentState === 'listening') { questionBufferRef.current = transcript; resetSilenceTimer(); return; }
        if (currentState === 'confirming') {
            const isResume = lower.includes('clear') || lower.includes('okay') || lower.includes('ok') || lower.includes('resume') || lower.includes('yes');
            if (isResume) { resumeTeaching(); return; }
        }
    };

    const enterListeningMode = () => {
        if (audioRef.current) { pausedAudioTimeRef.current = audioRef.current.currentTime; audioRef.current.pause(); }
        questionBufferRef.current = '';
        setTeacherState('listening'); teacherStateRef.current = 'listening';
        stopRecognitionRef.current = false;
        try { recognitionRef.current?.start(); } catch (e) { console.warn('Mic already active'); }
    };

    const handleInterruptClick = () => {
        setInterruptRipple(true);
        setTimeout(() => { setInterruptRipple(false); enterListeningMode(); }, 400);
    };

    const resumeTeaching = () => {
        if (awaitingFinalDecision) return;
        setTeacherState('teaching'); teacherStateRef.current = 'teaching';
        setQaBulletPoints(null); setQaQuestion(''); setWhiteboardPlan(null); handlingSpeechRef.current = false;
        stopRecognitionRef.current = true;
        try { recognitionRef.current?.stop(); } catch (e) { }
        if (audioRef.current) {
            audioRef.current.currentTime = pausedAudioTimeRef.current;
            audioRef.current.play().catch(err => console.error('Playback failed:', err));
        }
    };

    const resetSilenceTimer = () => { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = setTimeout(flushQuestionBuffer, 2000); };

    const flushQuestionBuffer = async () => {
        const questionText = questionBufferRef.current.trim();
        if (teacherStateRef.current !== 'listening') return;
        if (!questionText) { resumeTeaching(); return; }
        await submitQuestionToBackend(questionText);
    };

    const submitQuestionToBackend = async (questionText) => {
        const sid = sessionIdRef.current;
        if (!sid) return;
        stopRecognitionRef.current = true;
        try { recognitionRef.current?.stop(); } catch (_) { }
        try {
            const studentMsg = { id: Date.now(), from: 'student', text: questionText, time: 'Now' };
            setMessages(prev => [...prev, studentMsg]);
            setTeacherState('answering'); teacherStateRef.current = 'answering'; handlingSpeechRef.current = true;
            const res = await fetch(`${PYTHON_API}/session/${sid}/question`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: questionText, slide_index: slideIndexRef.current, point_index: activePointRef.current }),
            });
            if (!res.ok) { if (res.status === 429 || res.status === 503) alert('AI is busy. Please wait a moment.'); throw new Error(`Question API returned ${res.status}`); }
            const data = await res.json();
            setQaQuestion(questionText); setQaBulletPoints(data.bullet_points || []); setWhiteboardPlan(null);
            const detailAns = data.detail_ans || data.answer || '';
            const teacherMsg = { id: Date.now() + 1, from: 'teacher', text: detailAns, time: 'Now' };
            if (detailAns) {
                setMessages(prev => [...prev, teacherMsg]);
                if (mongoSessionIdRef.current) {
                    axios.patch(`${NODE_API}/sessions/${mongoSessionIdRef.current}`, { chatHistory: [...messages, studentMsg, teacherMsg] }, { withCredentials: true }).catch(() => { });
                }
            }
            if (detailAns) await playAnswerAudioChunks(sid, detailAns);
            else transitionToConfirming();
        } catch (err) {
            console.error('[QA] Failed:', err);
            setMessages(prev => [...prev, { id: Date.now(), from: 'teacher', text: "Sorry, I had trouble answering that. Let's continue.", time: 'Now' }]);
            resumeTeaching();
        }
    };

    const playAnswerAudioChunks = async (sid, detailAns) => {
        try {
            if (!qaAudioRef.current) qaAudioRef.current = new Audio();
            const qa = qaAudioRef.current;
            qa.crossOrigin = 'anonymous';
            const res = await fetch(`${PYTHON_API}/session/${sid}/question/audio`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: detailAns }),
            });
            if (!res.ok) throw new Error(`Audio API returned ${res.status}`);
            const data = await res.json();
            const chunks = data?.chunks || [];
            if (!Array.isArray(chunks) || chunks.length === 0) { transitionToConfirming(); return; }
            let idx = 0;
            const playNext = async () => {
                if (teacherStateRef.current !== 'answering') return;
                if (idx >= chunks.length) { transitionToConfirming(); return; }
                try {
                    const bin = atob(chunks[idx]);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
                    qa.onended = () => { URL.revokeObjectURL(url); idx++; playNext(); };
                    qa.onerror = () => { URL.revokeObjectURL(url); idx++; playNext(); };
                    qa.pause(); qa.currentTime = 0; qa.src = url; await qa.play();
                } catch (e) { idx++; playNext(); }
            };
            await playNext();
        } catch (err) { console.error('[QA] Audio failed:', err); transitionToConfirming(); }
    };

    const transitionToConfirming = () => {
        setTeacherState('confirming'); teacherStateRef.current = 'confirming'; handlingSpeechRef.current = false;
        stopRecognitionRef.current = false;
        setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) { } }, 300);
    };

    const sendQuestionManual = async () => {
        if (awaitingFinalDecision) return;
        const q = question.trim();
        if (!q || !sessionId) return;
        setQuestion(''); enterListeningMode(); await submitQuestionToBackend(q);
    };

    const buildSessionSummary = () => {
        const covered = Math.max(1, Math.min(slides.length, slideIndex + 1));
        const titles = slides.slice(0, covered).map(s => s?.title).filter(Boolean);
        const qaCount = messages.filter(m => m.from === 'student').length;
        return `Covered ${covered} slide(s): ${titles.slice(0, 4).join(', ') || 'general topics'}. Questions asked: ${qaCount}. Average focus: ${focusStats.average}%.`;
    };

    const buildNotePayload = () => {
        const coveredSlides = slides.slice(0, Math.max(1, slideIndex + 1));
        const keyPoints = coveredSlides.flatMap(s => (s?.points || []).map(p => (typeof p === 'string' ? p : p?.text || ''))).map(t => t.trim()).filter(Boolean).slice(0, 20);
        const topicNotes = coveredSlides.map(s => ({ topic: s?.title || 'Topic', content: (s?.points || []).map(p => (typeof p === 'string' ? p : p?.text || '')).filter(Boolean).join(' ') })).filter(t => t.content);
        const summary = buildSessionSummary();
        const cheatsheet = keyPoints.slice(0, 12).map((pt, i) => { const words = String(pt).split(/\s+/).filter(Boolean); return { term: words.slice(0, 4).join(' ') || `Concept ${i + 1}`, def: String(pt).trim() }; });
        const content = [summary, '', 'Key Points:', ...keyPoints.map((k, i) => `${i + 1}. ${k}`), '', 'Q&A:', ...messages.filter(m => m.from === 'student' || m.from === 'teacher').slice(-20).map(m => `${m.from === 'student' ? 'Student' : 'Teacher'}: ${m.text}`)].join('\n');
        return { title: `${sessionData?.title || 'Session'} Notes`, summary, keyPoints, topicNotes, cheatsheet, content };
    };

    const addBookmark = useCallback(async (slideIdx, pointIdx, pointText) => {
        const currentMongoId = mongoSessionIdRef.current;
        const key = `${slideIdx}:${pointIdx}:${pointText}`;
        setBookmarkedKeys(prev => { if (prev.has(key)) return prev; const next = new Set(prev); next.add(key); return next; });
        const shortText = pointText.length > 50 ? pointText.substring(0, 50) + '...' : pointText;
        setJustBookmarkedKeys(prev => new Set(prev).add(key));
        setTimeout(() => { setJustBookmarkedKeys(prev => { const n = new Set(prev); n.delete(key); return n; }); }, 200);
        if (!currentMongoId) { alert(`📌 Bookmarked locally: "${shortText}"\n\n⚠️ Session not yet linked to DB.`); return; }
        try {
            await axios.post(`${NODE_API}/bookmarks/add`, { sessionId: currentMongoId, content: pointText, slideIndex: slideIdx, pointIndex: pointIdx, slideTitle: slidesRef.current?.[slideIdx]?.title || '' }, { withCredentials: true });
            alert(`📌 Bookmarked: "${shortText}"`);
        } catch (e) { console.error('[Bookmark] Server save failed:', e); alert(`📌 Bookmarked locally: "${shortText}"\n(Server save failed)`); }
    }, []);

    useEffect(() => {
        const loadExistingBookmarks = async () => {
            if (!mongoSessionId) return;
            try {
                const bmRes = await axios.get(`${NODE_API}/bookmarks/${mongoSessionId}`, { withCredentials: true });
                const bookmarks = bmRes.data?.bookmarks || [];
                setBookmarkedKeys(new Set(bookmarks.map(b => `${b.slideIndex}:${b.pointIndex}:${b.content}`)));
            } catch (_) { }
        };
        loadExistingBookmarks();
    }, [mongoSessionId]);

    const handlePauseSession = async () => {
        if (isFinalizing) return;
        setIsFinalizing(true);
        audioRef.current?.pause();
        stopRecognitionRef.current = true;
        try { recognitionRef.current?.stop(); } catch (_) { }
        try {
            const currentMongoId = mongoSessionIdRef.current;
            if (currentMongoId) {
                const durationSeconds = Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000));
                await axios.patch(`${NODE_API}/sessions/${currentMongoId}`, { status: 'paused', duration: durationSeconds, focusScore: focusStats.average, topicsCovered: Math.max(1, slideIndex + 1), lastSlideIndex: slideIndex, chatHistory: messages }, { withCredentials: true });
            }
        } catch (err) { console.error('Error pausing session:', err); }
        finally { setIsFinalizing(false); navigate('/sessions'); }
    };

    const finalizeSessionAndOpenNotes = async () => {
        if (isFinalizing) return;
        setIsFinalizing(true);
        audioRef.current?.pause();
        stopRecognitionRef.current = true;
        try { recognitionRef.current?.stop(); } catch (_) { }
        try {
            const currentMongoId = mongoSessionIdRef.current;
            if (currentMongoId) {
                const durationSeconds = Math.max(1, Math.round((Date.now() - sessionStartedAtRef.current) / 1000));
                await axios.patch(`${NODE_API}/sessions/${currentMongoId}`, { status: 'completed', duration: durationSeconds, focusScore: focusStats.average, topicsCovered: Math.max(1, slideIndex + 1), summary: buildSessionSummary(), focusMonitorUsed, focusLogsCount: focusMonitorUsed ? Math.max(0, focusStats.count - 1) : 0, completedAt: new Date().toISOString(), chatHistory: messages }, { withCredentials: true });
                let bookmarks = [];
                try { const bmRes = await axios.get(`${NODE_API}/bookmarks/${currentMongoId}`, { withCredentials: true }); bookmarks = bmRes.data?.bookmarks || []; } catch (_) { }
                const bookmarkTexts = bookmarks.map(b => String(b?.content || '').trim()).filter(Boolean);
                let notePayload = buildNotePayload();
                try {
                    const gen = await fetch(`${PYTHON_API}/session/${sessionId}/notes/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmarks }) });
                    if (gen.ok) {
                        const data = await gen.json();
                        notePayload = { title: `${sessionData?.title || 'Session'} Notes`, summary: data.summary || notePayload.summary, keyPoints: data.keyPoints || notePayload.keyPoints, importantPoints: (data.importantPoints?.length > 0) ? data.importantPoints : bookmarkTexts, topicNotes: data.topicNotes || notePayload.topicNotes, cheatsheet: data.cheatsheet || notePayload.cheatsheet, content: notePayload.content };
                    }
                } catch (_) { notePayload.importantPoints = bookmarkTexts; }
                await axios.post(`${NODE_API}/notes/compile`, { sessionId: currentMongoId, ...notePayload }, { withCredentials: true });
            }
        } catch (err) { console.error('Error ending session:', err); }
        finally { setIsFinalizing(false); navigate(`/notes?sessionId=${mongoSessionIdRef.current || ''}`); }
    };

    const askPostSessionQuestion = () => {
        if (awaitingFinalDecision || isFinalizing) return;
        setAwaitingFinalDecision(true);
        setTeacherState('confirming'); teacherStateRef.current = 'confirming';
        setMessages(prev => [...prev, { id: Date.now(), from: 'teacher', text: 'We have completed all slides. Do you have any final question? Say yes to ask, or no to finish and generate downloadable notes.', time: 'Now' }]);
        stopRecognitionRef.current = false;
        setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) { } }, 200);
    };

    // ── Loading / error ──
    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 38, height: 38, border: '3px solid rgba(99,102,241,0.3)', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ color: '#94a3b8', fontSize: 14 }}>Loading session…</span>
        </div>
    );

    if (loadError) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff', flexDirection: 'column', gap: 16, padding: 24 }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ color: '#f87171', fontSize: 16, fontWeight: 600 }}>Session Error</div>
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>{loadError}</div>
            <button className="btn-primary" onClick={() => navigate('/sessions')}>← Back to Sessions</button>
        </div>
    );

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0, background: '#020617', overflow: 'hidden' }}>
            <div className="session-room-shell">
            <style>{`
                /* ── Base ── */
                * { box-sizing: border-box; }

                /* Centered content width; outer row stays full-width dark (no white gutters). */
                .session-room-shell {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    min-height: 0;
                    width: 100%;
                    max-width: min(1280px, 100%);
                    margin-left: auto;
                    margin-right: auto;
                    padding-left: max(12px, env(safe-area-inset-left, 0px));
                    padding-right: max(12px, env(safe-area-inset-right, 0px));
                    padding-bottom: 12px;
                    box-sizing: border-box;
                }

                /* ── Layout ── */
                .sessionPage {
                    display: flex;
                    flex: 1;
                    flex-direction: row;
                    width: 100%;
                    min-height: 0;
                    overflow: hidden;
                    position: relative;
                    gap: 0;
                }
                .sessionMain {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    padding: 14px;
                    transition: padding-right 0.28s ease;
                    overflow: hidden;
                }
                .slideCard {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #0f172a;
                    border: 1px solid rgba(148,163,184,0.1);
                    border-radius: 16px;
                    padding: 22px 22px 16px;
                    overflow: hidden;
                    position: relative;
                    min-height: 0;
                    max-height: min(88vh, calc(100dvh - 56px - 28px));
                }

                /* ── Slide header ── */
                .slideHeader {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    margin-bottom: 18px;
                    flex-shrink: 0;
                    gap: 12px;
                }
                .slideLabel {
                    font-size: 10px !important;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #64748b;
                    margin-bottom: 4px;
                }
                .slideTitle {
                    font-size: 1.45rem !important;
                    font-weight: 700;
                    color: #f1f5f9;
                    line-height: 1.25;
                }
                .slideCount {
                    font-size: 11px;
                    color: #64748b;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-shrink: 0;
                    white-space: nowrap;
                }

                /* ── Status indicators ── */
                .statusIndicator {
                    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
                    display: inline-block;
                }
                .statusIndicator.teaching  { background:#6366f1; animation: si-pulse 2s ease-in-out infinite; }
                .statusIndicator.listening { background:#22c55e; animation: si-pulse 1s ease-in-out infinite; }
                .statusIndicator.answering { background:#a855f7; animation: si-pulse 0.8s ease-in-out infinite; }
                .statusIndicator.confirming{ background:#f59e0b; }
                @keyframes si-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }

                /* ── Scrollable slide content ── */
                .slide-content-area {
                    flex: 1;
                    overflow-y: auto;
                    overscroll-behavior: contain;
                    /* Right padding = PiP width (72px) + gap (14px) + margin (8px) */
                    padding-right: 96px;
                    padding-bottom: 8px;
                    min-height: 0;
                }
                .slide-content-area--inline {
                    padding-right: 12px;
                }
                .slide-content-area::-webkit-scrollbar { width: 4px; }
                .slide-content-area::-webkit-scrollbar-track { background: transparent; }
                .slide-content-area::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 2px; }

                /* ── Bullet point buttons ── */
                .point-btn {
                    position: relative; overflow: hidden; display: block; width: 100%; text-align: left;
                    padding: 11px 15px; margin-bottom: 6px; border-radius: 10px;
                    border: 1px solid rgba(148,163,184,0.13); background: rgba(30,41,59,0.45);
                    color: #e2e8f0; font-size: 0.95rem; font-family: inherit; line-height: 1.6;
                    cursor: pointer; transition: background 0.18s, border-color 0.18s, transform 0.1s;
                }
                .point-btn:hover { background: rgba(168,85,247,0.1); border-color: rgba(168,85,247,0.3); }
                .point-btn:active { transform: scale(0.985); }
                .point-btn.bookmarked { border-left: 3px solid #a855f7; background: rgba(168,85,247,0.07); cursor: default; }
                .point-btn.bookmarked:hover { background: rgba(168,85,247,0.07); transform: none; }
                @keyframes bm-bounce { 0%{transform:scale(1)} 50%{transform:scale(1.04)} 100%{transform:scale(1)} }
                .point-btn.just-bookmarked { animation: bm-bounce 200ms ease forwards; border-color: #a855f7; }
                @keyframes hgt-grow { from{height:0} to{height:100%} }
                .point-btn.active-point::before {
                    content:''; position:absolute; left:0; top:0; width:3px; height:100%;
                    background:#a855f7; border-radius:10px 0 0 10px;
                    animation: hgt-grow 0.28s ease forwards;
                }
                .bm-icon { display:inline-flex; vertical-align:middle; margin-right:5px; }

                .point-row-flex {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                }
                .point-row-flex--with-inline .point-btn {
                    flex: 1;
                    min-width: 0;
                    width: auto;
                }
                .instructor-inline-slot {
                    flex-shrink: 0;
                    width: 88px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 3px;
                    pointer-events: none;
                    animation: instructor-inline-in 0.38s ease;
                }
                @keyframes instructor-inline-in {
                    from { opacity: 0; transform: translateX(14px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .avatar-inline-box {
                    width: 88px;
                    height: 88px;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid rgba(99,102,241,0.28);
                    background: #0d1526;
                    box-shadow: 0 4px 18px rgba(0,0,0,0.55);
                    transform: scaleX(-1);
                }
                .avatar-inline-bar {
                    width: 88px;
                    height: 3px;
                    border-radius: 2px;
                    background: rgba(51,65,85,0.7);
                    overflow: hidden;
                }
                .avatar-inline-progress {
                    height: 100%;
                    border-radius: 2px;
                    background: #6366f1;
                    transition: width 0.1s linear;
                }

                /* ── PiP Avatar container ── */
                .avatar-pip-wrap {
                    position: absolute;
                    bottom: 68px;
                    right: 14px;
                    z-index: 40;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 3px;
                    pointer-events: none;
                }
                .avatar-pip-label {
                    font-size: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    color: rgba(100,116,139,0.7);
                }
                .avatar-pip-box {
                    width: 72px;
                    height: 72px;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid rgba(99,102,241,0.28);
                    background: #0d1526;
                    box-shadow: 0 4px 18px rgba(0,0,0,0.55);
                    /* Mirror so avatar faces slide content on the left */
                    transform: scaleX(-1);
                }
                .avatar-pip-bar {
                    width: 72px; height: 3px; border-radius: 2px;
                    background: rgba(51,65,85,0.7); overflow: hidden;
                }
                .avatar-pip-progress {
                    height: 100%; border-radius: 2px; background: #6366f1;
                    transition: width 0.1s linear;
                }

                /* ── Slide actions bar ── */
                .slideActions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                    padding-top: 14px;
                    margin-top: 4px;
                    border-top: 1px solid rgba(148,163,184,0.07);
                    flex-wrap: wrap;
                }

                /* ── Side panel ── */
                .sessionSide {
                    width: 330px;
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 14px 14px 14px 0;
                    overflow-y: auto;
                    transition: width 0.28s ease, opacity 0.28s ease, padding 0.28s ease;
                }
                .sessionSide.hidden-panel {
                    width: 0; opacity: 0; overflow: hidden; padding: 0; pointer-events: none;
                }
                .sessionSide::-webkit-scrollbar { width: 3px; }
                .sessionSide::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 2px; }

                /* ── Chat card ── */
                .chatCard {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #0f172a;
                    border: 1px solid rgba(148,163,184,0.1);
                    border-radius: 14px;
                    padding: 14px;
                    min-height: 0;
                    overflow: hidden;
                }
                .chatBody {
                    flex: 1; overflow-y: auto; display: flex; flex-direction: column;
                    gap: 9px; padding-right: 3px; margin-bottom: 10px; min-height: 0;
                }
                .chatBody::-webkit-scrollbar { width: 3px; }
                .chatBody::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius:2px; }
                .msg { display:flex; flex-direction:column; gap:2px; }
                .msgTeacher { align-items:flex-start; }
                .msgStudent { align-items:flex-end; }
                .msgMeta { font-size:10px; color:#64748b; }
                .msgFrom { font-weight:600; }
                .msgText { font-size:13px; line-height:1.55; padding:8px 12px; border-radius:10px; max-width:90%; }
                .msgTeacher .msgText { background:rgba(99,102,241,0.12); color:#c7d2fe; border-radius:3px 10px 10px 10px; }
                .msgStudent .msgText { background:rgba(168,85,247,0.14); color:#e9d5ff; border-radius:10px 3px 10px 10px; }
                .chatComposer { display:flex; gap:8px; flex-shrink:0; }
                .chatInput {
                    flex:1; background:rgba(30,41,59,0.8); border:1px solid rgba(148,163,184,0.14);
                    border-radius:8px; color:#e2e8f0; font-size:13px; padding:8px 12px;
                    resize:none; font-family:inherit; outline:none;
                }
                .chatInput:focus { border-color:rgba(99,102,241,0.45); }

                /* ── Misc ── */
                .whiteboardDrawArea { padding: 4px 0; }
                .handwriting { font-size: 1.3rem !important; min-height: 1.3rem; color: #e2e8f0; }
                .audio-shimmer { animation: shimmer 2s cubic-bezier(0.4,0,0.6,1) infinite; background: rgba(51,65,85,0.45); }
                @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }
                .fade-points-enter { opacity:0; animation: fadeIn 0.28s ease-in forwards; }
                @keyframes fadeIn { to{opacity:1} }
                .slideList { list-style:none; margin:0; padding:0; }

                @keyframes interrupt-ripple { 0%{transform:scale(1);opacity:0.55} 100%{transform:scale(2.4);opacity:0} }
                .interrupt-ripple {
                    position:absolute; inset:0; border-radius:99px;
                    background:rgba(239,68,68,0.35);
                    animation: interrupt-ripple 400ms ease-out forwards;
                    pointer-events:none;
                }

                /* ── Buttons ── */
                .btn-primary {
                    padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
                    background: linear-gradient(135deg,#6366f1,#4f46e5); color:#fff;
                    border: none; cursor: pointer; transition: opacity 0.15s, transform 0.1s;
                    white-space: nowrap;
                }
                .btn-primary:hover { opacity:0.9; }
                .btn-primary:active { transform:scale(0.97); }
                .btn-primary:disabled { opacity:0.45; cursor:not-allowed; }
                .btnOutline {
                    padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
                    background: transparent; color:#94a3b8;
                    border: 1px solid rgba(148,163,184,0.22); cursor:pointer;
                    transition: border-color 0.15s, color 0.15s, transform 0.1s;
                    white-space: nowrap;
                }
                .btnOutline:hover { border-color:rgba(148,163,184,0.45); color:#e2e8f0; }
                .btnOutline:active { transform:scale(0.97); }
                .btnOutline:disabled { opacity:0.4; cursor:not-allowed; }

                /* ── card helper ── */
                .card { background:#0f172a; border:1px solid rgba(148,163,184,0.1); border-radius:14px; padding:16px; }
            `}</style>

            <main className={`sessionPage`}>

                {/* ── Toggle side panel button ── */}
                <button
                    onClick={() => setIsSidePanelOpen(v => !v)}
                    style={{
                        position: 'fixed', right: isSidePanelOpen ? 344 : 16, top: 80, zIndex: 50,
                        padding: '8px', borderRadius: '50%',
                        background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8',
                        cursor: 'pointer', transition: 'right 0.28s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                    }}
                    title={isSidePanelOpen ? 'Close panel' : 'Chat & Focus'}
                >
                    {isSidePanelOpen ? <ChevronRight size={18} /> : <MessageSquare size={18} />}
                </button>

                {/* ── MAIN SLIDE AREA ── */}
                <section
                    className="sessionMain"
                    style={{ paddingRight: isSidePanelOpen ? 14 : 14 }}
                >
                    <div className="slideCard">

                        {/* Header */}
                        <div className="slideHeader">
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="slideLabel">
                                    {whiteboardPlan ? 'Q&A Whiteboard' : awaitingFinalDecision ? 'Session Complete' : `Slide ${slideIndex + 1} of ${slides.length}`}
                                </div>
                                <div className="slideTitle">
                                    {whiteboardPlan
                                        ? 'Explaining…'
                                        : awaitingFinalDecision
                                            ? 'Any final question?'
                                            : (slide?.title || 'Loading content…')}
                                </div>
                            </div>
                            <div className="slideCount">
                                <span className={`statusIndicator ${teacherState}`} />
                                {teacherStatus}
                            </div>
                        </div>

                        {/* ── Slide content (right-padded to never overlap PiP) ── */}
                        <div className={`slide-content-area${showInlineInstructor ? ' slide-content-area--inline' : ''}`}>

                            {qaBulletPoints ? (
                                <div className="whiteboardDrawArea fade-in">
                                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 10 }}>
                                        Q&A Answer — Key Points
                                    </div>
                                    {qaQuestion && (
                                        <div style={{ fontSize: '1.1em', fontWeight: 700, marginBottom: 16, fontStyle: 'italic', borderLeft: '3px solid #a855f7', paddingLeft: 12, color: '#e5e7eb' }}>
                                            Q: {qaQuestion}
                                        </div>
                                    )}
                                    <ul className="slideList">
                                        {qaBulletPoints.map((point, idx) => (
                                            <li key={idx} style={{ fontSize: '1.1em', marginBottom: 9, color: '#c7d2fe', lineHeight: 1.6, padding: '2px 0' }}>
                                                <TypewriterText text={point} />
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                            ) : whiteboardPlan ? (
                                <div className="whiteboardDrawArea fade-in">
                                    <div className="handwriting">
                                        <TypewriterText text={whiteboardPlan} />
                                    </div>
                                </div>

                            ) : awaitingFinalDecision ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 36, marginBottom: 14 }}>🎓</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>All slides completed!</div>
                                        <div style={{ color: '#94a3b8', marginBottom: 22, fontSize: 14 }}>Do you have any final question?</div>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                                            <button className="btnOutline" onClick={() => { setAwaitingFinalDecision(false); enterListeningMode(); }}>
                                                Yes, ask question
                                            </button>
                                            <button className="btn-primary" onClick={finalizeSessionAndOpenNotes}>
                                                No, generate notes &amp; PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            ) : audioLoading ? (
                                <ul className="slideList">
                                    {[1, 2, 3].map(i => (
                                        <li key={i} style={{ listStyle: 'none', padding: 0, margin: '0 0 6px' }}>
                                            <div className="point-btn audio-shimmer" style={{ height: '3.2rem', border: 'none' }} />
                                        </li>
                                    ))}
                                </ul>

                            ) : slide?.points?.length > 0 ? (
                                <ul className="slideList fade-points-enter">
                                    {slide.points.map((p, idx) => {
                                        const pText = typeof p === 'string' ? p : (p?.text ?? '');
                                        const isActive = idx === activePoint;
                                        const bmKey = `${slideIndex}:${idx}:${pText}`;
                                        const isBm = bookmarkedKeys.has(bmKey);
                                        const isJustBm = justBookmarkedKeys.has(bmKey);
                                        if (idx > activePoint) return null;
                                        const inlineHere = isActive && showInlineInstructor;
                                        return (
                                            <li
                                                key={idx}
                                                ref={inlineHere ? activePointRowRef : undefined}
                                                style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}
                                            >
                                                <div className={`point-row-flex${inlineHere ? ' point-row-flex--with-inline' : ''}`}>
                                                    <button
                                                        type="button"
                                                        className={`point-btn${isBm ? ' bookmarked' : ''}${isJustBm ? ' just-bookmarked' : ''}${isActive ? ' active-point' : ''}`}
                                                        style={{ marginBottom: 0 }}
                                                        onClick={() => { if (!isBm) addBookmark(slideIndex, idx, pText); }}
                                                    >
                                                        {isBm && (
                                                            <span className="bm-icon">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                                                                    fill="#a855f7" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                        {isActive ? (displayedText || '\u00A0') : pText}
                                                    </button>
                                                    {inlineHere && (
                                                        <div className="instructor-inline-slot">
                                                            <span className="avatar-pip-label">Instructor</span>
                                                            <div className="avatar-inline-box">
                                                                <Avatar
                                                                    getVolume={getVolume}
                                                                    getLipSync={getLipSync}
                                                                    teacherState={teacherState}
                                                                    slideIndex={slideIndex}
                                                                    activePoint={activePoint}
                                                                    slidePointCount={slide?.points?.length ?? 0}
                                                                    stageMode={avatarStageMode}
                                                                    layout="inline"
                                                                />
                                                            </div>
                                                            <div className="avatar-inline-bar">
                                                                <div
                                                                    className="avatar-inline-progress"
                                                                    style={{
                                                                        width: `${avatarStageMode === 'slides' && teacherState === 'teaching'
                                                                            ? slidePlaybackProgress * 100
                                                                            : 0}%`
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>

                            ) : (
                                <div style={{ color: '#64748b', fontSize: 13, padding: '24px 0' }}>
                                    {slide ? 'No bullet points on this slide.' : 'Waiting for slide content…'}
                                </div>
                            )}
                        </div>{/* end slide-content-area */}

                        {/* ── PiP Avatar — only when not showing instructor beside active bullet ── */}
                        {!showInlineInstructor && (
                            <div className="avatar-pip-wrap" aria-hidden="true">
                                <span className="avatar-pip-label">Instructor</span>
                                <div className="avatar-pip-box">
                                    <Avatar
                                        getVolume={getVolume}
                                        getLipSync={getLipSync}
                                        teacherState={teacherState}
                                        slideIndex={slideIndex}
                                        activePoint={activePoint}
                                        slidePointCount={slide?.points?.length ?? 0}
                                        stageMode={avatarStageMode}
                                        layout="pip"
                                    />
                                </div>
                                <div className="avatar-pip-bar">
                                    <div
                                        className="avatar-pip-progress"
                                        style={{
                                            width: `${avatarStageMode === 'slides' && teacherState === 'teaching'
                                                ? slidePlaybackProgress * 100
                                                : 0}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ── Controls ── */}
                        <div className="slideActions">
                            <button className="btnOutline"
                                onClick={() => navigate(`/session/${sessionId}/slide/${Math.max(0, slideIndex - 1)}`)}>
                                ← Previous
                            </button>

                            {teacherState === 'teaching' && (
                                <button
                                    className="btn-primary"
                                    style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', position: 'relative', overflow: 'hidden' }}
                                    onClick={handleInterruptClick}
                                >
                                    {interruptRipple && <div className="interrupt-ripple" />}
                                    🎤 Interrupt &amp; Ask
                                </button>
                            )}
                            {(teacherState === 'listening' || teacherState === 'confirming') && (
                                <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }} onClick={resumeTeaching}>
                                    ▶ Resume Teaching
                                </button>
                            )}
                            {teacherState === 'answering' && (
                                <button className="btnOutline" disabled style={{ opacity: 0.45 }}>Answering…</button>
                            )}

                            <button className="btnOutline"
                                onClick={() => navigate(`/session/${sessionId}/slide/${Math.min(slides.length - 1, slideIndex + 1)}`)}>
                                Next →
                            </button>

                            <button
                                className="btnOutline"
                                style={{ borderColor: 'rgba(239,68,68,0.45)', color: '#f87171', marginLeft: 'auto' }}
                                onClick={finalizeSessionAndOpenNotes}
                            >
                                End Session
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── SIDE PANEL ── */}
                <aside className={`sessionSide ${isSidePanelOpen ? '' : 'hidden-panel'}`}>
                    <ErrorBoundary fallback={<div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>Focus monitor unavailable</div>}>
                        <FocusMonitor
                            sessionId={sessionId}
                            onFocusUpdate={handleFocusUpdate}
                            onRunningChange={(running) => { if (running) setFocusMonitorUsed(true); }}
                        />
                    </ErrorBoundary>

                    <div className="chatCard">
                        <div style={{ marginBottom: 10, flexShrink: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>Teacher Chat</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Ask questions via voice or text</div>
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
                            <button className="btn-primary" style={{ padding: '8px 12px', alignSelf: 'flex-end' }} onClick={sendQuestionManual}>
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