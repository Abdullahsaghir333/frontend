import { useMemo, useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import FocusMonitor from '../components/FocusMonitor';

const PYTHON_API = 'http://127.0.0.1:8000/api';
const NODE_API = '/api';

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
    const [sessionData, setSessionData] = useState(null);
    const [slides, setSlides] = useState([]);

    const [slideIndex, setSlideIndex] = useState(routeSlideIndex);
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
    const [awaitingFinalDecision, setAwaitingFinalDecision] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    const [focusStats, setFocusStats] = useState({ average: 100, current: 100, count: 1 });
    const [focusMonitorUsed, setFocusMonitorUsed] = useState(false);
    const [bookmarkedKeys, setBookmarkedKeys] = useState(() => new Set());

    // ── mongoSessionId ref so addBookmark never has a stale closure ──
    const mongoSessionIdRef = useRef(mongoSessionId);
    useEffect(() => { mongoSessionIdRef.current = mongoSessionId; }, [mongoSessionId]);

    // ── slides ref for same reason ──
    const slidesRef = useRef(slides);
    useEffect(() => { slidesRef.current = slides; }, [slides]);

    // ── Refs ──────────────────────────────────────────────
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
    const sessionStartedAtRef = useRef(Date.now());

    // Keep refs in sync with state
    useEffect(() => { teacherStateRef.current = teacherState; }, [teacherState]);
    useEffect(() => { slideIndexRef.current = slideIndex; }, [slideIndex]);
    useEffect(() => { activePointRef.current = activePoint; }, [activePoint]);
    useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
    useEffect(() => { setSlideIndex(routeSlideIndex); }, [routeSlideIndex]);

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

        if (mongoSessionIdRef.current) {
            axios.post(`${NODE_API}/focus`, {
                sessionId: mongoSessionIdRef.current,
                status: data.isAlarming ? 'distracted' : (data.rawStatus === 'DISTRACTED' ? 'away' : 'focused'),
                focusScore: data.focusScore
            }, { withCredentials: true }).catch(() => { });
        }
    }, []);

    // ── Session fetch ──────────────────────────────────────
    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await axios.get(`${PYTHON_API}/session/${sessionId}`);
                setSessionData(res.data);
                const theSlides = res.data.slides || res.data.state?.slides || [];
                setSlides(theSlides);

                if (!mongoSessionIdRef.current) {
                    try {
                        const dbRes = await axios.get(`${NODE_API}/sessions`, { withCredentials: true });
                        const match = dbRes.data.find(s => s.pythonSessionId === sessionId);
                        if (match) {
                            setMongoSessionId(match._id);
                            mongoSessionIdRef.current = match._id;
                        } else {
                            // Fallback: create Mongo session if upload step failed to persist it.
                            const fallbackTitle =
                                (location.state?.fileName ? String(location.state.fileName).replace(/\.[^/.]+$/, '') : null) ||
                                `Session ${sessionId.slice(0, 8)}`;
                            const created = await axios.post(`${NODE_API}/sessions`, {
                                pythonSessionId: sessionId,
                                title: fallbackTitle,
                                fileName: location.state?.fileName || 'Uploaded material',
                                topicsTotal: (theSlides || []).length || 0,
                            }, { withCredentials: true });
                            const newId = created.data?._id || null;
                            setMongoSessionId(newId);
                            mongoSessionIdRef.current = newId;
                        }
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

        const wsUrl = `${PYTHON_API.replace('http', 'ws')}/session/${sessionId}/ws`;
        const ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'session_slides' && data.session) {
                    setSessionData(data.session);
                    setSlides(data.session.slides || []);
                    return;
                }
                if (data.type === 'slide_ready') {
                    setSlides(prev => {
                        const newSlides = [...prev];
                        const idx = data.slide_id;
                        while (newSlides.length <= idx) newSlides.push(null);
                        newSlides[idx] = { ...(newSlides[idx] || {}), ...(data.slide || {}) };
                        return newSlides;
                    });
                }
            } catch (e) {
                console.warn('[WS] Parse error:', e);
            }
        };

        ws.onclose = () => console.log('[WS] Disconnected');
        ws.onerror = (err) => console.error('[WS] Error:', err);

        return () => {
            ws.close();
            stopRecognitionRef.current = true;
            try { recognitionRef.current?.stop(); } catch (_) { }
            audioRef.current?.pause();
            qaAudioRef.current?.pause();
        };
    }, [sessionId]);

    const slide = slides[slideIndex];

    useEffect(() => {
        if (!sessionId || !slides || slides.length === 0) return;
        if (slideIndex < 0) { navigate(`/session/${sessionId}/slide/0`, { replace: true }); return; }
        if (slideIndex > slides.length - 1) { navigate(`/session/${sessionId}/slide/${slides.length - 1}`, { replace: true }); }
    }, [slides.length, slideIndex, sessionId, navigate]);

    // ── Prefetch Audio ─────────────────────────────────────
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
        preload(slideIndex);
        preload(slideIndex + 1);
        preload(slideIndex + 2);
    }, [slideIndex, slides.length, sessionId]);

    // ── Slide audio playback ───────────────────────────────
    useEffect(() => {
        if (!sessionId || slides.length === 0) return;
        const currentSlide = slides[slideIndex];
        if (!currentSlide || !currentSlide.script || !currentSlide.points?.length) return;

        const playStream = async () => {
            try {
                if (!audioRef.current) audioRef.current = new Audio();
                const a = audioRef.current;
                a.crossOrigin = 'anonymous';
                a.pause();
                a.src = `${PYTHON_API}/session/${sessionId}/slides/${slideIndex}/audio`;
                a.currentTime = 0;
                if (teacherStateRef.current === 'teaching' && !isAlarmingRef.current) {
                    await a.play().catch(e => console.warn('Audio play prevented', e));
                }
            } catch (err) {
                console.error('Failed to play slide audio', err);
            }
        };
        playStream();
    }, [slideIndex, sessionId, slides, slides.length]);

    // ── Bullet point timing ────────────────────────────────
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
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
                setActivePoint(0); setWhiteboardPlan(null); setDisplayedText('');
                return;
            }
            if (teacherStateRef.current === 'teaching' && slideIndex === slides.length - 1) {
                askPostSessionQuestion();
            }
        };
        a.addEventListener('timeupdate', onTime);
        a.addEventListener('ended', onEnded);
        return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnded); };
    }, [slide, slideIndex, slides.length]);

    // ── Typing effect ──────────────────────────────────────
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

    // ── Speech recognition ─────────────────────────────────
    const initRecognition = () => {
        try {
            if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recog = new SpeechRecognition();
            recog.continuous = true;
            recog.interimResults = true;
            recog.lang = 'en-US';
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
                if (shouldRestart && !stopRecognitionRef.current) {
                    try { recog.start(); } catch (_) { }
                }
            };
            recognitionRef.current = recog;
        } catch (e) {
            console.error('[STT] Init failed:', e);
        }
    };

    const handleSpeechTranscript = (transcript) => {
        const currentState = teacherStateRef.current;
        const lower = transcript.toLowerCase();

        if (awaitingFinalDecision) {
            if (lower.includes('no') || lower.includes('nope') || lower.includes('nah')) {
                finalizeSessionAndOpenNotes(); return;
            }
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
        try { recognitionRef.current?.start(); } catch (e) { console.warn("Mic already active"); }
    };

    const resumeTeaching = () => {
        if (awaitingFinalDecision) return;
        setTeacherState('teaching'); teacherStateRef.current = 'teaching';
        setQaBulletPoints(null); setQaQuestion(''); setWhiteboardPlan(null); handlingSpeechRef.current = false;
        stopRecognitionRef.current = true;
        try { recognitionRef.current?.stop(); } catch (e) { }
        if (audioRef.current) {
            audioRef.current.currentTime = pausedAudioTimeRef.current;
            audioRef.current.play().catch(err => console.error("Playback failed:", err));
        }
    };

    const resetSilenceTimer = () => {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(flushQuestionBuffer, 2000);
    };

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
            setMessages(prev => [...prev, { id: Date.now(), from: 'student', text: questionText, time: 'Now' }]);
            setTeacherState('answering'); teacherStateRef.current = 'answering'; handlingSpeechRef.current = true;

            const res = await fetch(`${PYTHON_API}/session/${sid}/question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: questionText, slide_index: slideIndexRef.current, point_index: activePointRef.current }),
            });
            if (!res.ok) {
                if (res.status === 429 || res.status === 503) alert('AI is busy. Please wait a moment and try again.');
                throw new Error(`Question API returned ${res.status}`);
            }
            const data = await res.json();
            setQaQuestion(questionText); setQaBulletPoints(data.bullet_points || []); setWhiteboardPlan(null);
            const detailAns = data.detail_ans || data.answer || '';
            if (detailAns) setMessages(prev => [...prev, { id: Date.now() + 1, from: 'teacher', text: detailAns, time: 'Now' }]);
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
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: detailAns }),
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
        } catch (err) {
            console.error('[QA] Audio failed:', err);
            transitionToConfirming();
        }
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
        const keyPoints = coveredSlides
            .flatMap(s => (s?.points || []).map(p => (typeof p === 'string' ? p : p?.text || '')))
            .map(t => t.trim()).filter(Boolean).slice(0, 20);
        const topicNotes = coveredSlides.map(s => ({
            topic: s?.title || 'Topic',
            content: (s?.points || []).map(p => (typeof p === 'string' ? p : p?.text || '')).filter(Boolean).join(' '),
        })).filter(t => t.content);
        const summary = buildSessionSummary();
        const cheatsheet = keyPoints.slice(0, 12).map((pt, i) => {
            const words = String(pt).split(/\s+/).filter(Boolean);
            return { term: words.slice(0, 4).join(' ') || `Concept ${i + 1}`, def: String(pt).trim() };
        });
        const content = [summary, '', 'Key Points:', ...keyPoints.map((k, i) => `${i + 1}. ${k}`), '', 'Q&A:',
            ...messages.filter(m => m.from === 'student' || m.from === 'teacher').slice(-20)
                .map(m => `${m.from === 'student' ? 'Student' : 'Teacher'}: ${m.text}`)
        ].join('\n');
        return { title: `${sessionData?.title || 'Session'} Notes`, summary, keyPoints, topicNotes, cheatsheet, content };
    };

    // ── FIXED addBookmark ──────────────────────────────────
    // Uses refs so it always has fresh mongoSessionId & slides, no stale closure.
    // Removed `disabled` prop — that was silently swallowing clicks.
    const addBookmark = useCallback(async (slideIdx, pointIdx, pointText) => {
        const currentMongoId = mongoSessionIdRef.current;
        const key = `${slideIdx}:${pointIdx}:${pointText}`;

        console.log('[Bookmark] addBookmark called', { slideIdx, pointIdx, pointText, currentMongoId });

        // Optimistically mark as bookmarked in UI immediately
        setBookmarkedKeys(prev => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
        });

        const shortText = pointText.length > 50 ? pointText.substring(0, 50) + '...' : pointText;

        if (!currentMongoId) {
            alert(`📌 Bookmarked locally: "${shortText}"\n\n⚠️ Session not yet linked to DB — this won't persist after the session ends.`);
            return;
        }

        try {
            await axios.post(`${NODE_API}/bookmarks/add`, {
                sessionId: currentMongoId,
                content: pointText,
                slideIndex: slideIdx,
                pointIndex: pointIdx,
                slideTitle: slidesRef.current?.[slideIdx]?.title || '',
            }, { withCredentials: true });

            alert(`📌 Bookmarked: "${shortText}"\nThis will appear in your session notes.`);
        } catch (e) {
            console.error('[Bookmark] Server save failed:', e);
            alert(`📌 Bookmarked locally: "${shortText}"\n(Server save failed — check console)`);
        }
    }, []);

    useEffect(() => {
        const loadExistingBookmarks = async () => {
            if (!mongoSessionId) return;
            try {
                const bmRes = await axios.get(`${NODE_API}/bookmarks/${mongoSessionId}`, { withCredentials: true });
                const bookmarks = bmRes.data?.bookmarks || [];
                const keys = new Set(bookmarks.map(b => `${b.slideIndex}:${b.pointIndex}:${b.content}`));
                setBookmarkedKeys(keys);
            } catch (_) { }
        };
        loadExistingBookmarks();
    }, [mongoSessionId]);

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
                await axios.patch(`${NODE_API}/sessions/${currentMongoId}`, {
                    status: 'completed', duration: durationSeconds, focusScore: focusStats.average,
                    topicsCovered: Math.max(1, slideIndex + 1), summary: buildSessionSummary(),
                    focusMonitorUsed, focusLogsCount: focusMonitorUsed ? Math.max(0, focusStats.count - 1) : 0,
                    completedAt: new Date().toISOString(),
                }, { withCredentials: true });

                let bookmarks = [];
                try {
                    const bmRes = await axios.get(`${NODE_API}/bookmarks/${currentMongoId}`, { withCredentials: true });
                    bookmarks = bmRes.data?.bookmarks || [];
                } catch (_) { }
                const bookmarkTexts = bookmarks.map(b => String(b?.content || '').trim()).filter(Boolean);

                let notePayload = buildNotePayload();
                try {
                    const gen = await fetch(`${PYTHON_API}/session/${sessionId}/notes/generate`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bookmarks }),
                    });
                    if (gen.ok) {
                        const data = await gen.json();
                        notePayload = {
                            title: `${sessionData?.title || 'Session'} Notes`,
                            summary: data.summary || notePayload.summary,
                            keyPoints: data.keyPoints || notePayload.keyPoints,
                            importantPoints: (data.importantPoints?.length > 0) ? data.importantPoints : bookmarkTexts,
                            topicNotes: data.topicNotes || notePayload.topicNotes,
                            cheatsheet: data.cheatsheet || notePayload.cheatsheet,
                            content: notePayload.content,
                        };
                    }
                } catch (_) { notePayload.importantPoints = bookmarkTexts; }

                await axios.post(`${NODE_API}/notes/compile`, { sessionId: currentMongoId, ...notePayload }, { withCredentials: true });
            }
        } catch (err) {
            console.error('Error ending session:', err);
        } finally {
            setIsFinalizing(false);
            navigate(`/notes?sessionId=${mongoSessionIdRef.current || ''}`);
        }
    };

    const askPostSessionQuestion = () => {
        if (awaitingFinalDecision || isFinalizing) return;
        setAwaitingFinalDecision(true);
        setTeacherState('confirming'); teacherStateRef.current = 'confirming';
        setMessages(prev => [...prev, {
            id: Date.now(), from: 'teacher',
            text: 'We have completed all slides. Do you have any final question? Say yes to ask, or no to finish and generate downloadable notes.',
            time: 'Now'
        }]);
        stopRecognitionRef.current = false;
        setTimeout(() => { try { recognitionRef.current?.start(); } catch (_) { } }, 200);
    };


    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: '#fff' }}>
            Loading Session…
        </div>
    );

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#020617' }}>
            <style>{`
                /* ── Each slide point is a button ── */
                .point-btn {
                    display: block;
                    width: 100%;
                    text-align: left;
                    padding: 12px 16px;
                    margin-bottom: 6px;
                    border-radius: 10px;
                    border: 1px solid rgba(148,163,184,0.15);
                    background: rgba(30,41,59,0.4);
                    color: #e2e8f0;
                    font-size: inherit;
                    font-family: inherit;
                    line-height: 1.6;
                    cursor: pointer;
                    transition: background 0.2s, border-color 0.2s, transform 0.1s;
                }
                .point-btn:hover {
                    background: rgba(168,85,247,0.1);
                    border-color: rgba(168,85,247,0.35);
                }
                .point-btn:active {
                    transform: scale(0.98);
                    background: rgba(168,85,247,0.18);
                }
                .point-btn.bookmarked {
                    border-left: 3px solid #a855f7;
                    background: rgba(168,85,247,0.08);
                    cursor: default;
                }
                .point-btn.bookmarked:hover {
                    background: rgba(168,85,247,0.08);
                    border-color: rgba(168,85,247,0.35);
                    transform: none;
                }
                .bm-icon {
                    display: inline-flex;
                    vertical-align: middle;
                    margin-right: 6px;
                }
            `}</style>

            <Sidebar />

            <div style={{ marginLeft: 200, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <main className="sessionPage">

                    {/* ── CENTER STAGE (SLIDES) ── */}
                    <section className="sessionMain">
                        <div className="card slideCard h-full flex flex-col items-stretch">
                            <div className="slideHeader">
                                <div>
                                    <div className="slideLabel">
                                        {whiteboardPlan ? 'Q&A Whiteboard' : (awaitingFinalDecision ? 'Session Complete' : 'Current slide')}
                                    </div>
                                    <div className="slideTitle">
                                        {whiteboardPlan ? 'Explaining…' : (awaitingFinalDecision ? 'Any final question?' : slide?.title || 'Loading content…')}
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
                            ) : awaitingFinalDecision ? (
                                <div className="whiteboardDrawArea fade-in flex-1">
                                    <div style={{ width: '100%', padding: '0 20px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 28, marginBottom: 12 }}>🎓</div>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>All slides completed</div>
                                        <div style={{ color: '#94a3b8', marginBottom: 18 }}>Do you have any final question?</div>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                                            <button className="btnOutline" onClick={() => { setAwaitingFinalDecision(false); enterListeningMode(); }}>
                                                Yes, ask question
                                            </button>
                                            <button className="btn-primary" onClick={finalizeSessionAndOpenNotes}>
                                                No, generate notes & PDF
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <ul className="slideList flex-1">
                                  {slide.points?.map((p, idx) => {
    const pText = typeof p === 'string' ? p : p.text;
    const isPast = idx < activePoint;
    const isActive = idx === activePoint;
    const isHidden = idx > activePoint;
    const bmKey = `${slideIndex}:${idx}:${pText}`;
    const isBm = bookmarkedKeys.has(bmKey);

    if (isHidden) return null; // ← don't render hidden points at all

    return (
        <li key={idx} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <button
                type="button"
                className={`point-btn${isBm ? ' bookmarked' : ''}${isActive ? ' active-point' : ''}`}
                onClick={() => { if (!isBm) addBookmark(slideIndex, idx, pText); }}
            >
                {isBm && (
                    <span className="bm-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                            fill="#a855f7" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                        </svg>
                    </span>
                )}
                {isActive ? (displayedText || '\u00A0') : pText}
            </button>
        </li>
    );
})}
                                </ul>
                            )}

                            {/* Controls */}
                            <div className="slideActions" style={{ justifyContent: 'center', marginTop: 'auto', paddingTop: 20 }}>
                                <button className="btnOutline" onClick={() => navigate(`/session/${sessionId}/slide/${Math.max(0, slideIndex - 1)}`)}>
                                    Previous
                                </button>

                                {teacherState === 'teaching' && (
                                    <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }} onClick={enterListeningMode}>
                                        🎤 Interrupt & Ask
                                    </button>
                                )}
                                {(teacherState === 'listening' || teacherState === 'confirming') && (
                                    <button className="btn-primary" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }} onClick={resumeTeaching}>
                                        ▶ Resume Teaching
                                    </button>
                                )}
                                {teacherState === 'answering' && (
                                    <button className="btnOutline" disabled style={{ opacity: 0.5 }}>Answering…</button>
                                )}

                                <button className="btnOutline" onClick={() => navigate(`/session/${sessionId}/slide/${Math.min(slides.length - 1, slideIndex + 1)}`)}>
                                    Next
                                </button>
                                <button className="btnOutline" style={{ borderColor: '#ef4444', color: '#ef4444', marginLeft: 20 }} onClick={finalizeSessionAndOpenNotes}>
                                    End Session
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── SIDE PANEL ── */}
                    <aside className="sessionSide">
                        <FocusMonitor
                            sessionId={sessionId}
                            onFocusUpdate={handleFocusUpdate}
                            onRunningChange={(running) => { if (running) setFocusMonitorUsed(true); }}
                        />

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
                                <button className="btn-primary !px-4 !py-2 !rounded-lg" onClick={sendQuestionManual}>Send</button>
                            </div>
                        </div>
                    </aside>

                </main>
            </div>
        </div>
    );
}