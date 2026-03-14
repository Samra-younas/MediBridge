import { useCallback, useRef, useState } from 'react';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read audio blob'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result'));
        return;
      }
      // result is a data URL: "data:audio/webm;base64,...."
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

type ChunkHandler = (audioBase64: string) => void;

export function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastActiveAtRef = useRef<number>(0);

  const onChunkRef = useRef<ChunkHandler | null>(null);
  const stopResolverRef = useRef<((b64: string | null) => void) | null>(null);
  const stoppingRef = useRef(false);

  const cleanupSilenceMonitor = useCallback(() => {
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const finalizeAndResolve = useCallback(async () => {
    const parts = chunksRef.current;
    chunksRef.current = [];
    if (parts.length === 0) return null;
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(parts, { type: mimeType });
    const b64 = await blobToBase64(blob);
    return b64;
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (!isRecording) return null;
    if (stoppingRef.current) {
      return new Promise(resolve => {
        const prev = stopResolverRef.current;
        stopResolverRef.current = value => {
          prev?.(value);
          resolve(value);
        };
      });
    }

    stoppingRef.current = true;

    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      stoppingRef.current = false;
      setIsRecording(false);
      cleanupSilenceMonitor();
      cleanupStream();
      return null;
    }

    const stopped = new Promise<string | null>(resolve => {
      stopResolverRef.current = resolve;
    });

    try {
      recorder.stop();
    } catch (e) {
      console.error('Failed to stop MediaRecorder', e);
      stopResolverRef.current?.(null);
    }

    const result = await stopped;
    stoppingRef.current = false;
    return result;
  }, [cleanupSilenceMonitor, cleanupStream, isRecording]);

  const startRecording = useCallback(
    async (opts?: { onChunk?: ChunkHandler }) => {
      if (isRecording) return;
      onChunkRef.current = opts?.onChunk ?? null;
      chunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = e => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          try {
            const b64 = await finalizeAndResolve();
            setIsRecording(false);
            cleanupSilenceMonitor();
            cleanupStream();
            mediaRecorderRef.current = null;

            if (b64) onChunkRef.current?.(b64);
            stopResolverRef.current?.(b64);
          } catch (e) {
            console.error('Failed to finalize recording', e);
            setIsRecording(false);
            cleanupSilenceMonitor();
            cleanupStream();
            mediaRecorderRef.current = null;
            stopResolverRef.current?.(null);
          } finally {
            stopResolverRef.current = null;
          }
        };

        // Setup silence detection
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        source.connect(analyser);

        lastActiveAtRef.current = performance.now();
        const buffer = new Uint8Array(analyser.fftSize);
        const silenceMs = 1500;
        const threshold = 0.02; // RMS threshold, tuned for speech vs silence

        const tick = () => {
          const a = analyserRef.current;
          if (!a || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

          a.getByteTimeDomainData(buffer);
          let sumSq = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buffer.length);
          const now = performance.now();
          if (rms > threshold) lastActiveAtRef.current = now;

          if (now - lastActiveAtRef.current >= silenceMs) {
            void stopRecording();
            return;
          }

          rafIdRef.current = requestAnimationFrame(tick);
        };

        setIsRecording(true);
        recorder.start();
        rafIdRef.current = requestAnimationFrame(tick);
      } catch (e) {
        console.error('Failed to start recording', e);
        setIsRecording(false);
        cleanupSilenceMonitor();
        cleanupStream();
        mediaRecorderRef.current = null;
      }
    },
    [cleanupSilenceMonitor, cleanupStream, finalizeAndResolve, isRecording, stopRecording],
  );

  return { startRecording, stopRecording, isRecording };
}

