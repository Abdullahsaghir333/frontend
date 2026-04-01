import { useEffect, useRef, useMemo } from 'react';

/** Survives React Strict Mode remounts: only one MediaElementSource per audio element is allowed. */
const LIP_SYNC_BUNDLE = '__acadomiLipSyncBundle';

/**
 * Hooks into an HTMLAudioElement for frequency + time-domain analysis.
 * getVolume: rough overall level (legacy).
 * getLipSync: RMS-based speech envelope with attack/release — better for mouth movement.
 */
export function useAudioAnalyser(audioElementOrRef) {
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const timeDataRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const envelopeRef = useRef(0);
    const smoothedLipRef = useRef(0);
    const floatTimeRef = useRef(null);

    useEffect(() => {
        const audioEl = audioElementOrRef?.current || audioElementOrRef;
        if (!audioEl) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        let bundle = audioEl[LIP_SYNC_BUNDLE];

        if (!bundle) {
            const audioCtx = new AudioContext();
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.12;
            analyser.minDecibels = -85;
            analyser.maxDecibels = -25;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const timeData = new Uint8Array(analyser.fftSize);
            const floatTime = new Float32Array(analyser.fftSize);

            try {
                const source = audioCtx.createMediaElementSource(audioEl);
                source.connect(analyser);
                analyser.connect(audioCtx.destination);
                bundle = {
                    analyser,
                    audioCtx,
                    dataArray,
                    timeData,
                    floatTime,
                    source,
                };
                audioEl[LIP_SYNC_BUNDLE] = bundle;
            } catch (e) {
                console.warn(
                    'Lip-sync: Web Audio failed (needs CORS on audio URL, or source already used).',
                    e
                );
                try { audioCtx.close(); } catch (_) { /* ignore */ }
                return;
            }
        }

        // Remount (Strict Mode): always point refs at the *connected* analyser, not a new orphan node.
        analyserRef.current = bundle.analyser;
        audioContextRef.current = bundle.audioCtx;
        dataArrayRef.current = bundle.dataArray;
        timeDataRef.current = bundle.timeData;
        floatTimeRef.current = bundle.floatTime;
        sourceRef.current = bundle.source;

        const resumeCtx = () => {
            const ctx = audioContextRef.current;
            if (ctx?.state === 'suspended') {
                ctx.resume().catch((err) => {
                    console.warn('AudioContext resume failed:', err);
                });
            }
        };

        audioEl.addEventListener('play', resumeCtx);
        audioEl.addEventListener('playing', resumeCtx);
        audioEl.addEventListener('canplay', resumeCtx);
        audioEl.addEventListener('canplaythrough', resumeCtx);
        audioEl.addEventListener('click', resumeCtx);
        audioEl.addEventListener('touchstart', resumeCtx);

        return () => {
            audioEl.removeEventListener('play', resumeCtx);
            audioEl.removeEventListener('playing', resumeCtx);
            audioEl.removeEventListener('canplay', resumeCtx);
            audioEl.removeEventListener('canplaythrough', resumeCtx);
            audioEl.removeEventListener('click', resumeCtx);
            audioEl.removeEventListener('touchstart', resumeCtx);
        };
    }, [audioElementOrRef]);

    return useMemo(() => ({
        resumeAudio() {
            const ctx = audioContextRef.current;
            if (ctx?.state === 'suspended') return ctx.resume().catch(() => { });
            return Promise.resolve();
        },

        getVolume() {
            const analyser = analyserRef.current;
            const dataArray = dataArrayRef.current;
            if (!analyser || !dataArray) return 0;

            analyser.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
            }

            const average = sum / dataArray.length;
            return Math.min(1, average / 128);
        },

        getLipSync() {
            const analyser = analyserRef.current;
            const audioCtx = audioContextRef.current;
            if (!analyser) return 0;

            if (audioCtx?.state === 'suspended') {
                audioCtx.resume().catch(() => { });
            }

            const n = analyser.fftSize;
            let floatBuf = floatTimeRef.current;
            if (!floatBuf || floatBuf.length !== n) {
                floatBuf = new Float32Array(n);
                floatTimeRef.current = floatBuf;
            }
            analyser.getFloatTimeDomainData(floatBuf);
            let sumSq = 0;
            for (let i = 0; i < n; i++) sumSq += floatBuf[i] * floatBuf[i];
            const rms = Math.sqrt(sumSq / n);

            const freq = dataArrayRef.current;
            let speechBand = 0;
            let hiBand = 0;
            if (freq && audioCtx) {
                analyser.getByteFrequencyData(freq);
                const sr = audioCtx.sampleRate;
                const fftSize = analyser.fftSize;
                const nBins = freq.length;
                const binLo = Math.max(0, Math.min(nBins - 1, Math.floor((300 / sr) * fftSize)));
                const binHi = Math.max(binLo, Math.min(nBins - 1, Math.floor((3400 / sr) * fftSize)));
                let s = 0;
                const span = Math.max(1, binHi - binLo + 1);
                for (let i = binLo; i <= binHi; i++) s += freq[i];
                speechBand = s / (span * 255);

                const hStart = Math.floor(freq.length * 0.55);
                let h = 0;
                const hSpan = freq.length - hStart;
                for (let i = hStart; i < freq.length; i++) h += freq[i];
                hiBand = hSpan > 0 ? h / (hSpan * 255) : 0;
            }

            let instant = Math.min(
                1,
                rms * 8.8 + rms * rms * 14 + speechBand * 1.05 + hiBand * 0.55
            );

            const prev = envelopeRef.current;
            const attack = 0.78;
            const release = 0.26;
            if (instant > prev) {
                envelopeRef.current = prev + (instant - prev) * attack;
            } else {
                envelopeRef.current = prev + (instant - prev) * release;
            }

            smoothedLipRef.current += (envelopeRef.current - smoothedLipRef.current) * 0.62;
            return Math.min(1, Math.max(0, smoothedLipRef.current));
        },
    }), []);
}
