import { useMemo, useState, useEffect, useRef } from 'react'
import './App.css'

const API_BASE = 'http://127.0.0.1:8000/api'

export default function App() {
  const [step, setStep] = useState('upload')
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [slides, setSlides] = useState([])
  const [slideIndex, setSlideIndex] = useState(0)
  const [activePoint, setActivePoint] = useState(0)
  const [displayedText, setDisplayedText] = useState('')
  const [teacherState, setTeacherState] = useState('teaching') // teaching, listening, answering, confirming
  const teacherStateRef = useRef('teaching')
  const [question, setQuestion] = useState('')
  const [qaBulletPoints, setQaBulletPoints] = useState(null) // array of strings when in Q&A mode
  const [qaQuestion, setQaQuestion] = useState('') // The student's question
  const [whiteboardPlan, setWhiteboardPlan] = useState(null)
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: 'teacher',
      text: 'Upload notes and I will generate a structured lesson.',
      time: 'Now',
    },
  ])

  const slide = slides[slideIndex]

  const audioRef = useRef(null)
  const recognitionRef = useRef(null)
  const stopRecognitionRef = useRef(false)
  const handlingSpeechRef = useRef(false)
  const questionBufferRef = useRef('')
  const silenceTimerRef = useRef(null)
  const slideIndexRef = useRef(0)
  const activePointRef = useRef(0)
  const sessionIdRef = useRef(null)
  const pausedAudioTimeRef = useRef(0) // remember where we paused the slide audio
  const qaAudioRef = useRef(null) // separate audio element for Q&A answer TTS

  // Keep refs in sync with state so speech callbacks always have fresh values
  useEffect(() => { teacherStateRef.current = teacherState }, [teacherState])
  useEffect(() => { slideIndexRef.current = slideIndex }, [slideIndex])
  useEffect(() => { activePointRef.current = activePoint }, [activePoint])
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  const teacherStatus = useMemo(() => {
    if (teacherState === 'listening') return 'Listening to your question…'
    if (teacherState === 'answering') return 'Answering your question…'
    if (teacherState === 'confirming') return 'Waiting for you to say "clear"…'
    return 'Teaching from the slide…'
  }, [teacherState])

  const onPickFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
  }

  const startSession = async () => {
    if (!file) {
      alert('Please upload your notes first.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Failed to create session: ${res.status} ${errText}`)
      }

      const data = await res.json()

      setSessionId(data.id)
      setSlides(data.slides)
      setSlideIndex(0)
      setActivePoint(0)
      setStep('session')
      setTeacherState('teaching')

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          from: 'teacher',
          text: 'Your notes have been processed. Let’s begin.',
          time: 'Now',
        },
        {
          id: Date.now() + 1,
          from: 'teacher',
          text: data.notes_text || '(no extracted text)',
          time: 'Now',
        },
      ])
      // start speech recognition immediately
      initRecognition()
    } catch (err) {
      console.error(err)
      alert('Backend error. Check server.')
    }
  }

  const prevSlide = () =>
    setSlideIndex((i) => (i === 0 ? slides.length - 1 : i - 1))

  const nextSlide = () => {
    if (slideIndex < slides.length - 1) {
      setSlideIndex((i) => i + 1)
      setWhiteboardPlan(null)
      setDisplayedText('') // reset typing animation
    }
  }

  // Auto-play slide audio when slide changes and session exists
  useEffect(() => {
    if (!sessionId) return
    const currentSlide = slides[slideIndex]

    const playStream = async () => {
      // If this slide was generated as an empty background stub, fetch the populated one
      if (currentSlide && (!currentSlide.script || !currentSlide.point_timings || currentSlide.point_timings.length === 0)) {
        try {
          const res = await fetch(`${API_BASE}/session/${sessionId}`)
          if (res.ok) {
            const data = await res.json()
            setSlides(data.slides) // Update UI with populated text/timings
          }
        } catch (e) {
          console.error('Failed to sync background slide', e)
        }
      }

      try {
        if (!audioRef.current) audioRef.current = new Audio()
        const a = audioRef.current
        a.crossOrigin = 'anonymous'
        a.pause()
        a.src = `${API_BASE}/session/${sessionId}/slides/${slideIndex}/audio`
        a.currentTime = 0
        await a.play().catch((e) => console.warn('Audio play prevented', e))
      } catch (err) {
        console.error('Failed to play slide audio stream', err)
      }
    }
    playStream()
  }, [slideIndex, sessionId])

  // update active bullet based on audio progress & Auto-advance slide when audio finishes
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => {
      const tms = a.currentTime * 1000
      const timings = slide?.point_timings || []
      for (const tm of timings) {
        if (tms >= tm.start_ms && tms < tm.end_ms) {
          setActivePoint(tm.point_index)
          break
        }
      }
    }

    // Auto progress to next slide when audio finishes
    const onEnded = () => {
      if (slideIndex < slides.length - 1) {
        nextSlide()
      }
    }

    // Preload next audio shortly before this one ends (or just in the background)
    if (slideIndex < slides.length - 1 && sessionId) {
      const nextUrl = `${API_BASE}/session/${sessionId}/slides/${slideIndex + 1}/audio`
      const preloadLink = document.createElement('link')
      preloadLink.href = nextUrl
      preloadLink.rel = 'preload'
      preloadLink.as = 'fetch'
      document.head.appendChild(preloadLink)
    }

    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnded)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnded)
    }
  }, [slide, slideIndex, slides.length])

  // Typing animation effect for the active point
  useEffect(() => {
    if (!slide || !slide.points) return
    const currentPointText = slide.points[activePoint]?.text || ''

    let i = 0
    let currentText = ''
    setDisplayedText('') // erase exactly when changing bullets

    const interval = setInterval(() => {
      if (i < currentPointText.length) {
        currentText += currentPointText.charAt(i)
        setDisplayedText(currentText)
        i++
      } else {
        clearInterval(interval)
      }
    }, 30) // 30ms per character typing speed

    return () => clearInterval(interval)
  }, [activePoint, slideIndex, slide])

  // NOTE: removed the 10s auto-resume timer that was conflicting with the Q&A flow.
  // The user can always click "Resume Teaching" if they want to cancel their question.

  // initialize speech recognition
  const initRecognition = () => {
    try {
      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        return
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recog = new SpeechRecognition()
      recog.continuous = true
      recog.interimResults = false
      recog.lang = 'en-US'

      recog.onresult = (ev) => {
        const last = ev.results[ev.results.length - 1]
        const transcript = last[0].transcript.trim()
        if (!transcript) return
        handleSpeechTranscript(transcript)
      }
      recog.onerror = (e) => console.error('Recognition error', e)
      recog.onend = () => {
        if (!stopRecognitionRef.current) {
          try { recog.start() } catch (_) { }
        }
      }
      recog.start()
      recognitionRef.current = recog
      stopRecognitionRef.current = false
    } catch (e) {
      console.debug('initRecognition failed', e)
    }
  }

  // Send the question to the backend
  const submitQuestionToBackend = async (questionText) => {
    const sid = sessionIdRef.current
    if (!sid) {
      console.warn('No sessionId, cannot submit question')
      setTeacherState('teaching')
      audioRef.current?.play().catch(() => { })
      handlingSpeechRef.current = false
      return
    }

    try {
      // Remember where the slide audio was paused so we can resume later
      if (audioRef.current) {
        pausedAudioTimeRef.current = audioRef.current.currentTime
      }

      setMessages((prev) => [...prev, { id: Date.now(), from: 'student', text: questionText, time: 'Now' }])
      setTeacherState('answering')

      const res = await fetch(`${API_BASE}/session/${sid}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          slide_index: slideIndexRef.current,
          point_index: activePointRef.current,
        }),
      })

      if (!res.ok) {
        if (res.status === 429) {
          alert('Gemini API Quota Exceeded! The free tier limits requests. Please wait about 1 minute and try asking again.')
        }
        throw new Error(`question API returned ${res.status}`)
      }

      // If user clicked Resume Teaching while waiting for fetch, abort!
      if (teacherStateRef.current !== 'answering') {
        console.log('Q&A fetch aborted by user state change')
        return
      }

      const data = await res.json()

      // Store the bullet points for the Q&A whiteboard slide
      setQaQuestion(questionText)
      setQaBulletPoints(data.bullet_points || [])
      setWhiteboardPlan(null) // clear old format

      const detailAns = data.detail_ans || ''
      setMessages((prev) => [...prev, { id: Date.now() + 1, from: 'teacher', text: detailAns, time: 'Now' }])

      // Play TTS audio of the detailed answer
      if (detailAns) {
        try {
          const audioUrl = `${API_BASE}/session/${sid}/question/audio`
          if (!qaAudioRef.current) qaAudioRef.current = new Audio()
          const qa = qaAudioRef.current

          // Stop recognition while teacher speaks to avoid feedback
          try { recognitionRef.current?.stop() } catch (_) { }
          stopRecognitionRef.current = true

          // Fetch the array of base64 audio chunks
          const audioRes = await fetch(audioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: detailAns }),
          })

          if (teacherStateRef.current !== 'answering') return;

          if (audioRes.ok) {
            const data = await audioRes.json()
            const chunks = data.chunks || []

            if (chunks.length > 0) {
              let currentChunkIdx = 0

              const playNextChunk = async () => {
                if (teacherStateRef.current !== 'answering') return;

                if (currentChunkIdx >= chunks.length) {
                  // All chunks finished playing
                  setTeacherState('confirming')
                  handlingSpeechRef.current = false
                  stopRecognitionRef.current = false
                  try { recognitionRef.current?.start() } catch (_) { }
                  return
                }

                // Convert base64 to blob url
                const base64Str = chunks[currentChunkIdx]
                const byteCharacters = atob(base64Str)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'audio/mpeg' })

                qa.src = URL.createObjectURL(blob)
                qa.onended = playNextChunk

                await qa.play().catch((e) => {
                  console.warn('Q&A audio play prevented', e)
                  playNextChunk() // attempt to move to next if blocked
                })

                currentChunkIdx++
              }

              // Start playing the first chunk
              await playNextChunk()
            } else {
              // no chunks returned
              setTimeout(() => {
                setTeacherState('confirming')
                handlingSpeechRef.current = false
                stopRecognitionRef.current = false
                try { recognitionRef.current?.start() } catch (_) { }
              }, 3000)
            }
          } else {
            // Audio generation failed, just move to confirming after a brief pause
            setTimeout(() => {
              setTeacherState('confirming')
              handlingSpeechRef.current = false
              stopRecognitionRef.current = false
              try { recognitionRef.current?.start() } catch (_) { }
            }, 3000)
          }
        } catch (audioErr) {
          console.error('Q&A audio failed', audioErr)
          setTimeout(() => {
            setTeacherState('confirming')
            handlingSpeechRef.current = false
            stopRecognitionRef.current = false
            try { recognitionRef.current?.start() } catch (_) { }
          }, 3000)
        }
      } else {
        // No answer text, just go to confirming
        setTimeout(() => {
          setTeacherState('confirming')
          handlingSpeechRef.current = false
          stopRecognitionRef.current = false
          try { recognitionRef.current?.start() } catch (_) { }
        }, 3000)
      }
    } catch (err) {
      console.error('Failed to submit question', err)
      setTeacherState('teaching')
      setQaBulletPoints(null)
      setWhiteboardPlan(null)
      audioRef.current?.play().catch(() => { })
      handlingSpeechRef.current = false
      stopRecognitionRef.current = false
      try { recognitionRef.current?.start() } catch (_) { }
    }
  }

  // Flush the accumulated question buffer
  const flushQuestionBuffer = async () => {
    handlingSpeechRef.current = true
    try { recognitionRef.current?.stop() } catch (_) { }

    const questionText = questionBufferRef.current.trim()
    questionBufferRef.current = ''

    if (!questionText) {
      setTeacherState('teaching')
      audioRef.current?.play().catch(() => { })
      handlingSpeechRef.current = false
      try { recognitionRef.current?.start() } catch (_) { }
      return
    }

    await submitQuestionToBackend(questionText)
  }

  const handleSpeechTranscript = (transcript) => {
    const lowerTranscript = transcript.toLowerCase()
    const currentState = teacherStateRef.current

    console.log('[STT]', currentState, ':', transcript)

    // ── CONFIRMING state: check for "clear" vs follow-up ──
    if (currentState === 'confirming') {
      if (lowerTranscript.includes('clear') || lowerTranscript.includes('yes') || lowerTranscript.includes('okay') || lowerTranscript.includes('got it')) {
        // Student confirmed, resume teaching from where we paused
        setTeacherState('teaching')
        setQaBulletPoints(null)
        setQaQuestion('')
        setWhiteboardPlan(null)
        setMessages((prev) => [...prev, { id: Date.now(), from: 'student', text: transcript, time: 'Now' }])
        setMessages((prev) => [...prev, { id: Date.now() + 1, from: 'teacher', text: 'Great! Resuming the lesson...', time: 'Now' }])
        // Resume slide audio from where it was paused
        if (audioRef.current) {
          audioRef.current.currentTime = pausedAudioTimeRef.current
          audioRef.current.play().catch(() => { })
        }
        return
      } else {
        // Not clear — treat as a follow-up question
        handlingSpeechRef.current = true
        audioRef.current?.pause()
        setTeacherState('listening')
        questionBufferRef.current = transcript
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = setTimeout(flushQuestionBuffer, 4000)
        return
      }
    }

    // ── LISTENING state: accumulate the question ──
    if (currentState === 'listening') {
      questionBufferRef.current += (questionBufferRef.current ? ' ' : '') + transcript
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(flushQuestionBuffer, 4000)
      return
    }

    // ── TEACHING state: auto-detect interruption ──
    if (currentState === 'teaching') {
      // Auto-interruption disabled due to speaker bleed / background noise.
      // User must explicitly click "Interrupt & Ask Question" to pause the lesson.
      return
    }

    // In any other state (answering), just ignore
  }

  const sendQuestion = async () => {
    const q = question.trim()
    if (!q || !sessionId) return

    setMessages((prev) => [...prev, { id: Date.now(), from: 'student', text: q, time: 'Just now' }])
    setQuestion('')

    // Remember where audio was paused
    if (audioRef.current) {
      audioRef.current.pause()
      pausedAudioTimeRef.current = audioRef.current.currentTime
    }

    handlingSpeechRef.current = true
    await submitQuestionToBackend(q)
  }

  return (
    <div className="appRoot">
      <header className="topBar">
        <div className="brand">
          <div className="brandMark">AI</div>
          <div className="brandText">
            <div className="brandTitle">Interactive Teacher Session</div>
            <div className="brandSubtitle">
              Real Gemini-powered teaching session
            </div>
          </div>
        </div>
      </header>

      {step === 'upload' ? (
        <main className="uploadPage">
          <section className="card uploadCard">
            <h1 className="h1">Upload your notes</h1>

            <label className="dropzone">
              <input
                className="dropzoneInput"
                type="file"
                onChange={onPickFile}
              />
              <div className="dropzoneInner">
                <div className="dropzoneTitle">
                  Click to upload notes
                </div>
                {fileName && (
                  <div className="filePill">
                    <span className="fileDot" />
                    <span className="fileName">{fileName}</span>
                  </div>
                )}
              </div>
            </label>

            <div className="actionsRow">
              <button className="btnPrimary" onClick={startSession}>
                Submit & Start Session
              </button>
            </div>
          </section>
        </main>
      ) : (
        <main className="sessionPage" style={{ gridTemplateColumns: '1fr' }}>
          <section className="sessionMain">
            {/* slide bullets only, no teacher video */}
            <div className="card slideCard">
              <div className="slideHeader">
                <div>
                  <div className="slideLabel">{whiteboardPlan ? 'Q&A Whiteboard' : 'Current slide'}</div>
                  <div className="slideTitle">
                    {whiteboardPlan ? 'Explaining...' : slide?.title}
                  </div>
                </div>
                <div className="slideCount">
                  <span className={`statusIndicator ${teacherState}`}></span>
                  {teacherStatus}
                </div>
              </div>

              {qaBulletPoints ? (
                <div className="whiteboardDrawArea fade-in">
                  <div style={{ width: '100%', padding: '0 20px' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--soft)', marginBottom: '12px' }}>Q&A Answer — Key Points</div>

                    {qaQuestion && (
                      <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '20px', fontStyle: 'italic', borderLeft: '4px solid var(--accent)', paddingLeft: '16px', color: 'var(--text)' }}>
                        Q: {qaQuestion}
                      </div>
                    )}

                    <ul className="slideList">
                      {qaBulletPoints.map((point, idx) => (
                        <li key={idx} className="active" style={{ fontSize: '1.3em', marginBottom: '10px' }}>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : whiteboardPlan ? (
                <div className="whiteboardDrawArea fade-in">
                  <div className="handwriting font-marker">
                    {whiteboardPlan.split('\n').map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <ul className="slideList">
                  {slide?.points?.map((p, idx) => {
                    const isPast = idx < activePoint;
                    const isActive = idx === activePoint;

                    return (
                      <li
                        key={idx}
                        className={isActive ? 'active' : isPast ? 'past' : 'hidden'}
                        style={isPast ? { opacity: 1 } : {}}
                      >
                        {isActive ? (displayedText || '\u00A0') : p.text}
                      </li>
                    )
                  })}
                </ul>
              )}

              <div className="slideActions" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '1rem' }}>
                <button className="btnOutline" onClick={prevSlide}>
                  Previous
                </button>

                {teacherState === 'teaching' && (
                  <button
                    className="btnPrimary"
                    style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none' }}
                    onClick={() => {
                      audioRef.current?.pause()
                      setTeacherState('listening')
                      questionBufferRef.current = ''
                      clearTimeout(silenceTimerRef.current)
                      // restart recognition fresh
                      try { recognitionRef.current?.stop() } catch (_) { }
                      setTimeout(() => { try { recognitionRef.current?.start() } catch (_) { } }, 300)
                    }}
                  >
                    🎤 Interrupt & Ask Question
                  </button>
                )}

                {(teacherState === 'listening' || teacherState === 'confirming') && (
                  <button
                    className="btnPrimary"
                    style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none' }}
                    onClick={() => {
                      clearTimeout(silenceTimerRef.current)
                      questionBufferRef.current = ''
                      handlingSpeechRef.current = false
                      // Stop Q&A answer audio if playing
                      if (qaAudioRef.current) {
                        qaAudioRef.current.pause()
                        qaAudioRef.current.src = ''
                      }
                      setTeacherState('teaching')
                      setQaBulletPoints(null)
                      setQaQuestion('')
                      setWhiteboardPlan(null)
                      // Resume slide audio from where it was paused
                      if (audioRef.current) {
                        audioRef.current.currentTime = pausedAudioTimeRef.current
                        audioRef.current.play().catch(() => { })
                      }
                    }}
                  >
                    ▶ Resume Teaching
                  </button>
                )}

                {teacherState === 'answering' && (
                  <button className="btnOutline" disabled style={{ opacity: 0.5 }}>
                    Answering...
                  </button>
                )}

                <button className="btnOutline" onClick={nextSlide}>
                  Next
                </button>
              </div>
            </div>
          </section>

          <aside className="sessionSide" style={{ display: 'none' }}>
            <div className="card chatCard">
              <div className="chatBody">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`msg ${m.from === 'teacher'
                      ? 'msgTeacher'
                      : 'msgStudent'
                      }`}
                  >
                    <div className="msgMeta">
                      <span className="msgFrom">
                        {m.from === 'teacher'
                          ? 'Teacher'
                          : 'You'}
                      </span>
                    </div>
                    <div className="msgText">{m.text}</div>
                  </div>
                ))}
              </div>

              <div className="chatComposer">
                <textarea
                  className="chatInput"
                  rows={2}
                  value={question}
                  onChange={(e) =>
                    setQuestion(e.target.value)
                  }
                  placeholder="Ask a question..."
                />
                <button
                  className="btnPrimary btnSend"
                  onClick={sendQuestion}
                >
                  Send
                </button>
              </div>
            </div>
          </aside>
        </main>
      )}
    </div>
  )
}