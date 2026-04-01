import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── Global keyframes injected once into <head> ─────────────────────────── */
const AVATAR_CSS = `
@keyframes av-breathe {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-0.9px); }
}
@keyframes av-talk {
  0%,100% { transform: translateY(0px); }
  25%     { transform: translateY(-0.7px); }
  75%     { transform: translateY(0.4px); }
}
@keyframes av-listen {
  0%,100% { transform: rotate(0deg) translateY(0px); }
  40%     { transform: rotate(1.4deg) translateY(-0.5px); }
  80%     { transform: rotate(-0.9deg) translateY(0.3px); }
}
@keyframes av-confirm {
  0%,100% { transform: translateY(0px); }
  50%     { transform: translateY(-1.1px); }
}
@keyframes av-think-dot {
  0%,60%,100% { opacity: 0.15; transform: scale(0.8); }
  30%         { opacity: 1;    transform: scale(1.15); }
}
@keyframes av-ring-listen {
  0%,100% { opacity: 0.4; }
  50%     { opacity: 0.9; }
}
@keyframes av-ring-talk {
  0%,100% { opacity: 0.35; r: 22; }
  50%     { opacity: 0.65; r: 23.2; }
}
`;

function injectAvatarStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('acadomi-avatar-css')) return;
  const tag = document.createElement('style');
  tag.id = 'acadomi-avatar-css';
  tag.textContent = AVATAR_CSS;
  document.head.appendChild(tag);
}

/* ─── Smoothed lip-sync hook ─────────────────────────────────────────────── */
function useSmoothedLip(lipFn, active) {
  const val = useRef(0);
  return useCallback(() => {
    const raw = lipFn ? lipFn() : 0;
    const shaped = active ? Math.min(1, Math.pow(Math.max(0, raw), 0.72) * 1.35 + raw * 0.42) : 0;
    const target = active ? shaped : 0;
    const alpha = target > val.current ? 0.48 : 0.2;
    val.current = val.current * (1 - alpha) + target * alpha;
    return val.current;
  }, [lipFn, active]);
}

/* ─── Avatar ─────────────────────────────────────────────────────────────── */
export function Avatar({
  getVolume,
  getLipSync,
  teacherState = 'teaching',
  slideIndex = 0,
  activePoint = 0,
  slidePointCount = 0,
  stageMode = 'slides',
  layout = 'pip',
}) {
  injectAvatarStyles();

  const upperLipRef = useRef(null);
  const lowerLipRef = useRef(null);
  const mouthInnerRef = useRef(null);
  const mouthSkinRef = useRef(null);
  const rafRef = useRef(null);

  // FIX: Prefer getLipSync over getVolume — getLipSync is the accurate
  // speech-envelope signal. getVolume is only a fallback for legacy callers.
  const lipFn = getLipSync || getVolume;

  const [blink, setBlink] = useState(false);
  const [armPhase, setArmPhase] = useState(2);   // 1=up 2=mid 3=down
  const armTimer = useRef(null);

  /* ── State flags ── */
  const isListening = teacherState === 'listening';
  const isAnswering = teacherState === 'answering' || stageMode === 'qa';
  const isConfirming = teacherState === 'confirming' || stageMode === 'complete';
  const isTeaching = !isListening && !isAnswering && !isConfirming;
  const isSpeaking = isTeaching || isAnswering;

  const getLip = useSmoothedLip(lipFn, isSpeaking);

  /**
   * Mouth: Duolingo-style motion — separate jaw (vertical) and spread (horizontal)
   * with out-of-phase wobble so it reads as speech, not a static “O”.
   */
  useEffect(() => {
    const tick = () => {
      const v = getLip();
      const open = Math.min(1, v * 1.02 + v * v * 0.28);
      const t = performance.now() * 0.001;

      const wobbleV = 0.48 + 0.52 * Math.sin(t * 13.2);
      const wobbleH = 0.46 + 0.54 * Math.sin(t * 10.8 + 1.1);
      const flutter = 0.85 + 0.15 * Math.sin(t * 22.4);

      const jaw = open * wobbleV * flutter;
      const spread = open * wobbleH * flutter;

      const maxJawRy = 2.05;
      const upperRy = 0.34 + jaw * maxJawRy * 0.52;
      const lowerRy = 0.32 + jaw * maxJawRy * 0.55;
      const upperCy = 50.05 - jaw * 0.95;
      const lowerCy = 51.85 + jaw * 1.15;

      const rxUpper = 2.85 + spread * 4.1 + jaw * 0.75;
      const rxLower = 2.65 + spread * 3.85 + jaw * 0.65;

      if (upperLipRef.current) {
        upperLipRef.current.setAttribute('rx', rxUpper.toFixed(2));
        upperLipRef.current.setAttribute('ry', upperRy.toFixed(2));
        upperLipRef.current.setAttribute('cy', upperCy.toFixed(2));
      }
      if (lowerLipRef.current) {
        lowerLipRef.current.setAttribute('rx', rxLower.toFixed(2));
        lowerLipRef.current.setAttribute('ry', lowerRy.toFixed(2));
        lowerLipRef.current.setAttribute('cy', lowerCy.toFixed(2));
      }

      if (mouthInnerRef.current) {
        const innerOn = open > 0.06 ? 1 : 0;
        mouthInnerRef.current.setAttribute('opacity', innerOn.toFixed(2));
        mouthInnerRef.current.setAttribute('rx', (1.1 + jaw * 2.35 + spread * 1.5).toFixed(2));
        mouthInnerRef.current.setAttribute('ry', (0.35 + jaw * 1.65).toFixed(2));
        mouthInnerRef.current.setAttribute('cy', (51.15 + jaw * 0.45).toFixed(2));
      }

      if (mouthSkinRef.current) {
        const relax = Math.max(0, 1 - open * 1.15);
        mouthSkinRef.current.setAttribute('opacity', (0.28 + relax * 0.72).toFixed(2));
        mouthSkinRef.current.setAttribute('ry', (2.25 + relax * 0.45).toFixed(2));
        mouthSkinRef.current.setAttribute('rx', (5.1 + relax * 0.55).toFixed(2));
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getLip]);

  /* ── Blink ── */
  useEffect(() => {
    let tid;
    const go = () => {
      tid = setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); go(); }, 110);
      }, 2600 + Math.random() * 2800);
    };
    go();
    return () => clearTimeout(tid);
  }, []);

  /* ── Arm phase tracks active bullet ── */
  useEffect(() => {
    if (!isTeaching) { setArmPhase(2); return; }
    clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => {
      const t = slidePointCount > 1 ? activePoint / (slidePointCount - 1) : 0.5;
      setArmPhase(t < 0.35 ? 1 : t < 0.65 ? 2 : 3);
    }, 280);
    return () => clearTimeout(armTimer.current);
  }, [activePoint, slidePointCount, isTeaching]);

  /* ── Derived geometry ── */
  const pt = slidePointCount > 1 ? activePoint / (slidePointCount - 1) : 0.5;
  const bodyLean = isTeaching ? (-1.8 + pt * 3.6) : 0;
  const headNod = isTeaching ? (-1.2 + pt * 2.4) : 0;
  const pupilX = isTeaching ? (-0.7 + pt * 1.4) : 0;

  // Right arm endpoint
  const [rx2, ry2] = armPhase === 1 ? [80, 54]
    : armPhase === 3 ? [84, 64]
      : [82, 59];

  /* ── Theme per state ── */
  const ringColor = isListening ? '#22c55e' : isAnswering ? '#a855f7' : isConfirming ? '#f59e0b' : '#6366f1';
  const shirtColor = isListening ? '#064e3b' : isAnswering ? '#4c1d95' : isConfirming ? '#78350f' : '#312e81';
  const eyeScaleY = blink ? 0.04 : 1;

  /* ── Animation ── */
  const animName = isListening ? 'av-listen'
    : isAnswering ? 'av-talk'
      : isConfirming ? 'av-confirm'
        : 'av-breathe';
  const animDur = isAnswering ? '0.85s' : isListening ? '3.8s' : '4.2s';

  const pipScale = layout === 'pip' ? 0.88 : layout === 'inline' ? 0.94 : 1;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ display: 'block' }}
      >
        <g transform={`translate(50,52) scale(${pipScale}) translate(-50,-52)`}>

          {/* State ring */}
          <circle
            cx="50" cy="44" r="22"
            fill="none" stroke={ringColor} strokeWidth="1.1"
            opacity={isTeaching ? 0.2 : 0.48}
            style={{
              animation: isListening ? 'av-ring-listen 1.1s ease-in-out infinite'
                : isAnswering ? 'av-ring-talk 0.85s ease-in-out infinite'
                  : 'none',
            }}
          />

          {/* Body lean wrapper */}
          <g style={{ transformOrigin: '50px 56px', transform: `rotate(${bodyLean}deg)`, transition: 'transform 0.38s ease-out' }}>

            {/* Main idle animation */}
            <g style={{ animation: `${animName} ${animDur} ease-in-out infinite` }}>

              {/* Shirt */}
              <rect x="30" y="62" width="40" height="30" rx="9" fill={shirtColor} />
              {/* Neck */}
              <rect x="43" y="55" width="14" height="13" rx="4" fill="#fecdd3" />

              {/* Head */}
              <g style={{ transformOrigin: '50px 44px', transform: `rotate(${headNod}deg)`, transition: 'transform 0.32s ease-out' }}>

                <circle cx="50" cy="44" r="17.5" fill="#fecdd3" />

                {/* Hair */}
                <path d="M33,41 Q35,23 50,22 Q65,23 67,41 Q61,28 50,28 Q39,28 33,41Z" fill="#92400e" />
                <path d="M36,34 Q42,26 50,25 Q58,26 64,34" fill="none" stroke="#7c3626" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" />

                {/* Ear when listening */}
                {isListening && <ellipse cx="32.5" cy="44" rx="3.5" ry="5" fill="#fecdd3" />}

                {/* Left eye */}
                <g style={{ transformOrigin: '43px 42px', transform: `translateX(${pupilX}px) scaleY(${eyeScaleY})`, transition: 'transform 0.1s' }}>
                  <ellipse cx="43" cy="42" rx="3.4" ry="3.7" fill="#1e293b" />
                  <circle cx="44.2" cy="40.8" r="1.05" fill="white" />
                </g>

                {/* Right eye */}
                <g style={{ transformOrigin: '57px 42px', transform: `translateX(${pupilX}px) scaleY(${eyeScaleY})`, transition: 'transform 0.1s' }}>
                  <ellipse cx="57" cy="42" rx="3.4" ry="3.7" fill="#1e293b" />
                  <circle cx="58.2" cy="40.8" r="1.05" fill="white" />
                </g>

                {/* Eyebrows */}
                <path
                  d="M39.5,38 Q43,36.8 46.5,38"
                  stroke="#92400e" strokeWidth="1.3" fill="none" strokeLinecap="round"
                  style={{ transform: isTeaching && pt < 0.4 ? 'translateY(-0.5px)' : 'none', transition: 'transform 0.3s' }}
                />
                <path
                  d="M53.5,38 Q57,36.8 60.5,38"
                  stroke="#92400e" strokeWidth="1.3" fill="none" strokeLinecap="round"
                  style={{ transform: isTeaching && pt < 0.4 ? 'translateY(-0.5px)' : 'none', transition: 'transform 0.3s' }}
                />

                {/* Mouth area: skin fades when open; inner cavity reads as depth */}
                <ellipse
                  ref={mouthSkinRef}
                  cx="50"
                  cy="51"
                  rx="5.65"
                  ry="2.7"
                  fill="#fecdd3"
                  opacity={0.92}
                />
                <ellipse
                  ref={mouthInnerRef}
                  cx="50"
                  cy="51.15"
                  rx="1.2"
                  ry="0.4"
                  fill="#4a0d24"
                  opacity={0}
                />
                <ellipse ref={upperLipRef} cx="50" cy="50.05" rx="2.85" ry="0.34" fill="#b0124a" />
                <ellipse ref={lowerLipRef} cx="50" cy="51.85" rx="2.65" ry="0.32" fill="#9c0f42" />
                {/* Smile (only shown when not speaking) */}
                {!isSpeaking && (
                  <path d="M45.5,51 Q50,54 54.5,51" stroke="#c2185b" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.65" />
                )}

                {/* Thinking dots */}
                {isConfirming && (
                  <>
                    <circle cx="62" cy="34" r="1.8" fill="#f59e0b" style={{ animation: 'av-think-dot 1.4s 0s infinite' }} />
                    <circle cx="67" cy="29" r="1.8" fill="#f59e0b" style={{ animation: 'av-think-dot 1.4s 0.45s infinite' }} />
                    <circle cx="72" cy="25" r="1.8" fill="#f59e0b" style={{ animation: 'av-think-dot 1.4s 0.9s infinite' }} />
                  </>
                )}

                {/* Sound wave arcs (listening) */}
                {isListening && (
                  <>
                    <path d="M20,40 Q17,44 20,48" fill="none" stroke="#22c55e" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
                    <path d="M17,37 Q12,44 17,51" fill="none" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
                  </>
                )}
              </g>{/* end head */}

              {/* Arms */}
              {isTeaching ? (
                <>
                  {/* Right: pointing at slide content */}
                  <line
                    x1="70" y1="68" x2={rx2} y2={ry2}
                    stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round"
                    style={{ transition: 'x2 0.42s ease-out, y2 0.42s ease-out' }}
                  />
                  <circle cx={rx2 + 0.4} cy={ry2 - 0.8} r="2.5" fill="#fecdd3" />
                  {/* Left: relaxed rest */}
                  <line x1="30" y1="68" x2="20" y2={70 - pt * 3} stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round" style={{ transition: 'y2 0.42s ease-out' }} />
                </>
              ) : isListening ? (
                <>
                  <line x1="70" y1="68" x2="83" y2="61" stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round" />
                  <line x1="30" y1="68" x2="17" y2="61" stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round" />
                </>
              ) : isAnswering ? (
                <>
                  <line x1="70" y1="68" x2="83" y2="57" stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round" />
                  <circle cx="83.5" cy="56" r="2.5" fill="#fecdd3" />
                  <line x1="30" y1="68" x2="18" y2="63" stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <line x1="30" y1="70" x2="23" y2="80" stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round" />
                  <line x1="70" y1="70" x2="77" y2="80" stroke="#fecdd3" strokeWidth="3.4" strokeLinecap="round" />
                </>
              )}

            </g>{/* end anim group */}
          </g>{/* end body lean */}
        </g>
      </svg>
    </div>
  );
}