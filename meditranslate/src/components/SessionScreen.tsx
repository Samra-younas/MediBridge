import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Stethoscope } from 'lucide-react';
import type { SessionConfig, TranscriptEntry } from '../types';

interface SessionScreenProps {
  config: SessionConfig;
  onEnd: (transcript: TranscriptEntry[]) => void;
}

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const SILENCE_THRESHOLD = 12;
const SILENCE_MS        = 3000;
const MIN_BLOB_SIZE     = 6000;
const ECHO_COOLDOWN_MS  = 2000;
const FETCH_TIMEOUT_MS  = 15000; // 15 sec — if backend hangs, abort

export default function SessionScreen({ config, onEnd }: SessionScreenProps) {
  const timer    = useTimer();
  const timerRef = useRef(timer);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  const [micOn, setMicOn]                 = useState(true);
  const [audioOn, setAudioOn]             = useState(true);
  const [activeSpeaker, setActiveSpeaker] = useState<'doctor' | 'patient' | null>(null);
  const [transcript, setTranscript]       = useState<TranscriptEntry[]>([]);
  const [translating, setTranslating]     = useState(false);
  const [status, setStatus]               = useState('🎙️ Listening...');
  const [error, setError]                 = useState<string | null>(null); // user-visible error
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  const loopId      = useRef(0);
  const streamRef   = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioOnRef  = useRef(audioOn);
  useEffect(() => { audioOnRef.current = audioOn; }, [audioOn]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onerror   = () => rej(new Error('FileReader failed'));
      reader.onloadend = () => res((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });

  // ── Fetch with timeout — backend hang se app freeze nahi hoga ──
  async function fetchWithTimeout(url: string, options: RequestInit, ms: number) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e: any) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('Request timed out — backend too slow');
      throw e;
    }
  }

  // ── Core loop ─────────────────────────────────────────────────
  async function runLoop(id: number) {
    const alive = () => id === loopId.current;

    while (alive()) {
      setError(null);
      setStatus('🎙️ Listening...');

      if (!streamRef.current || !analyserRef.current) break;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';

      // ── Record ─────────────────────────────────────────────
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(streamRef.current, { mimeType });
      } catch (e) {
        setError('Recording failed — try refreshing the page');
        await sleep(2000);
        continue;
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data); };
      recorder.start(100);

      // ── Silence detection ───────────────────────────────────
      await new Promise<void>(resolve => {
        const buf          = new Uint8Array(analyserRef.current!.frequencyBinCount);
        let silenceStart: number | null = null;
        let speaking       = false;

        const tick = setInterval(() => {
          if (!alive()) { clearInterval(tick); resolve(); return; }
          if (!analyserRef.current) { clearInterval(tick); resolve(); return; }

          analyserRef.current.getByteFrequencyData(buf);
          const vol = buf.reduce((a, b) => a + b, 0) / buf.length;

          if (vol >= SILENCE_THRESHOLD) {
            silenceStart = null;
            if (!speaking) { speaking = true; setStatus('🔴 Speaking...'); }
          } else if (speaking) {
            if (!silenceStart) silenceStart = Date.now();
            const ms = Date.now() - silenceStart;
            setStatus(`⏸️ Pause ${(ms / 1000).toFixed(1)}s / 3s`);
            if (ms >= SILENCE_MS) { clearInterval(tick); resolve(); }
          }
        }, 100);
      });

      // ── Stop recorder ───────────────────────────────────────
      await new Promise<void>(r => { recorder.onstop = () => r(); recorder.stop(); });
      if (!alive()) break;

      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size < MIN_BLOB_SIZE) continue;

      // ── Send to backend ─────────────────────────────────────
      setTranslating(true);
      setStatus('⏳ Translating...');

      try {
        const base64 = await blobToBase64(blob);

        const res = await fetchWithTimeout(
          'http://localhost:8000/translate',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio_base64: base64,
              source_lang_code: config.doctorLanguage.code,
              source_lang_name: config.doctorLanguage.name,
              target_lang_code: config.patientLanguage.code,
              target_lang_name: config.patientLanguage.name,
              room_id: 'room-session',
              speaker: 'Doctor',
            }),
          },
          FETCH_TIMEOUT_MS
        );

        if (!alive()) break;

        // Check HTTP error (500, 503 etc)
        if (!res.ok) {
          throw new Error(`Backend error: ${res.status}`);
        }

        const data = await res.json();

        if (data.error) {
          // Backend returned logical error (no speech, etc) — not a crash, just retry
          console.warn('[TRANSLATE] Backend:', data.error);
        } else if (data.transcript && data.translation) {
          const speaker = data.detected_speaker === 'Patient' ? 'patient' : 'doctor';
          setActiveSpeaker(speaker);
          setTranscript(prev => [...prev, {
            id: Date.now().toString(),
            speaker,
            original:   data.transcript,
            translated: data.translation,
            timestamp:  timerRef.current,
          }]);

          // ── Play TTS ────────────────────────────────────────
          if (data.audio_base64 && audioOnRef.current && alive()) {
            setStatus('🔊 Playing...');
            const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);

            await new Promise<void>(r => {
              // Both ended AND error resolve — so loop never hangs
              audio.addEventListener('ended', () => r(), { once: true });
              audio.addEventListener('error', () => r(), { once: true });
              audio.play().catch(() => r()); // autoplay blocked → resolve immediately
            });

            if (alive()) {
              setStatus('⏳ Echo clearing...');
              await sleep(ECHO_COOLDOWN_MS);
            }
          }
        }

      } catch (e: any) {
        const msg = e?.message || 'Unknown error';
        console.error('[SESSION]', msg);

        if (msg.includes('timed out')) {
          setError('⏱️ Backend is slow — check if it\'s running');
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          setError('❌ Cannot reach backend — run: python app.py');
        } else if (msg.includes('Backend error')) {
          setError(`⚠️ Server error — ${msg}`);
        } else {
          setError(`⚠️ ${msg}`);
        }

        await sleep(2000); // wait before retry — don't spam
      } finally {
        setTranslating(false);
        setActiveSpeaker(null);
      }
    } // end while
  }

  // ── Start mic ─────────────────────────────────────────────────
  async function startSession() {
    if (streamRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      // Resume AudioContext — some browsers suspend until user gesture
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyser.fftSize = 512;

      streamRef.current   = stream;
      analyserRef.current = analyser;
      loopId.current++;
      runLoop(loopId.current);
    } catch (e: any) {
      // Mic permission denied or not available
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        setError('🎙️ Mic permission denied — allow microphone access in browser');
      } else if (e?.name === 'NotFoundError') {
        setError('🎙️ No microphone found — plug in a mic and refresh');
      } else {
        setError(`🎙️ Mic error: ${e?.message}`);
      }
      setMicOn(false);
    }
  }

  function stopSession() {
    loopId.current++;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current   = null;
    analyserRef.current = null;
    setStatus('⏹️ Stopped');
  }

  useEffect(() => {
    startSession();
    return () => stopSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMicToggle = () => {
    if (micOn) {
      stopSession();
      setMicOn(false);
      setStatus('🔇 Mic off');
    } else {
      setMicOn(true);
      startSession();
    }
  };

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', fontFamily: 'Sora, sans-serif' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <span style={{ fontWeight: '700', fontSize: '16px', color: '#111827' }}>Live Transcription</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: translating ? '#fef3c7' : '#f0fdf4', border: `1px solid ${translating ? '#fbbf24' : '#86efac'}` }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: translating ? '#f59e0b' : '#22c55e' }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: translating ? '#92400e' : '#166534' }}>{status}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>Live</span>
          </div>
        </div>
      </div>

      {/* Error banner — shows only when error exists */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px', padding: '0 4px' }}>✕</button>
        </div>
      )}

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* LEFT */}
        <div style={{ width: '60%', display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '16px', position: 'relative', backgroundColor: '#1e3a5f', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
              {activeSpeaker && (
                <div style={{ position: 'absolute', width: '90px', height: '90px', borderRadius: '50%', border: `2px solid ${activeSpeaker === 'doctor' ? '#60a5fa' : '#34d399'}`, opacity: 0.4, animation: 'ping 1.5s ease-out infinite' }} />
              )}
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', border: activeSpeaker ? `3px solid ${activeSpeaker === 'doctor' ? '#60a5fa' : '#34d399'}` : '3px solid transparent', transition: 'border-color 0.3s', zIndex: 1 }}>
                <Stethoscope style={{ width: '36px', height: '36px', color: '#93c5fd' }} />
              </div>
              {activeSpeaker && (
                <div style={{ display: 'flex', gap: '3px', zIndex: 1 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="speaking-bar" style={{ width: '3px', height: '16px', borderRadius: '2px', backgroundColor: activeSpeaker === 'doctor' ? '#60a5fa' : '#34d399' }} />
                  ))}
                </div>
              )}
              <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: '600', zIndex: 1 }}>
                {activeSpeaker === 'patient' ? '👤 Patient Speaking' : activeSpeaker === 'doctor' ? '🩺 Doctor Speaking' : 'Listening...'}
              </span>
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                {config.doctorLanguage.flag} {config.doctorLanguage.name} ↔ {config.patientLanguage.flag} {config.patientLanguage.name}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '8px 0' }}>
            <button onClick={handleMicToggle} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1.5px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: micOn ? '#6b7280' : '#ef4444' }}>
              {micOn ? <Mic style={{ width: '20px', height: '20px' }} /> : <MicOff style={{ width: '20px', height: '20px' }} />}
            </button>
            <button onClick={() => setAudioOn(v => !v)} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1.5px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: audioOn ? '#6b7280' : '#f59e0b' }}>
              {audioOn ? <Volume2 style={{ width: '20px', height: '20px' }} /> : <VolumeX style={{ width: '20px', height: '20px' }} />}
            </button>
            <button onClick={() => { stopSession(); onEnd(transcript); }} style={{ width: '52px', height: '52px', borderRadius: '50%', border: 'none', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', boxShadow: '0 4px 12px rgba(239,68,68,0.4)' }}>
              <PhoneOff style={{ width: '22px', height: '22px' }} />
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Session Info</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px' }}>Doctor</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', margin: 0 }}>{config.doctorLanguage.flag} {config.doctorLanguage.name}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px' }}>Patient</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', margin: 0 }}>{config.patientLanguage.flag} {config.patientLanguage.name}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Session time</span>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{timer}</span>
            </div>
            <button onClick={() => { stopSession(); onEnd(transcript); }} style={{ marginTop: '12px', width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #ef4444', backgroundColor: '#fff', color: '#ef4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
              Stop Recording
            </button>
          </div>

     

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <>
                {transcript.length === 0 && (
                  <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', paddingTop: '32px' }}>
                    Speak naturally — auto-detecting language…
                  </div>
                )}
                {transcript.map(entry => {
                  const isDoc = entry.speaker === 'doctor';
                  return (
                    <div key={entry.id} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: isDoc ? '#dbeafe' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: isDoc ? '#2563eb' : '#059669' }}>{isDoc ? 'Dr' : 'Pt'}</span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: isDoc ? '#2563eb' : '#059669' }}>{isDoc ? 'Doctor' : 'Patient'}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: 'auto' }}>{entry.timestamp}</span>
                      </div>
                      <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: isDoc ? '#eff6ff' : '#f0fdf4', border: `1px solid ${isDoc ? '#bfdbfe' : '#bbf7d0'}`, marginBottom: '6px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#1f2937', lineHeight: 1.5 }}>{entry.original}</p>
                      </div>
                      <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          → {isDoc ? config.patientLanguage.name : config.doctorLanguage.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{entry.translated}</p>
                      </div>
                    </div>
                  );
                })}
                {translating && (
                  <div style={{ display: 'flex', gap: '4px', padding: '8px 0', alignItems: 'center' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb', animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite` }} />
                    ))}
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '6px' }}>Translating…</span>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .speaking-bar { animation: speakBar 0.6s ease-in-out infinite; }
        .speaking-bar:nth-child(2) { animation-delay: 0.1s; }
        .speaking-bar:nth-child(3) { animation-delay: 0.2s; }
        .speaking-bar:nth-child(4) { animation-delay: 0.15s; }
        .speaking-bar:nth-child(5) { animation-delay: 0.05s; }
        @keyframes speakBar { 0%, 100% { transform: scaleY(0.4); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 1; } }
      `}</style>
    </div>
  );
}