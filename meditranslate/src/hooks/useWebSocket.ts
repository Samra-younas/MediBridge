import { useCallback, useRef, useState } from 'react';

type TranslationMessage = {
  type: 'translation';
  transcript: string;
  translation: string;
  audio_base64?: string;
  speaker?: string;
};

type ServerMessage = TranslationMessage | { type: string; [k: string]: unknown };

function playBase64Audio(audioBase64: string): void {
  try {
    const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
    void audio.play();
  } catch (e) {
    console.error('Failed to play audio', e);
  }
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<TranslationMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      try {
        ws.close();
      } catch (e) {
        console.error('Failed to close WebSocket', e);
      }
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback((roomId: string) => {
    disconnect();
    const url = `ws://localhost:8000/ws/${encodeURIComponent(roomId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = e => {
      console.error('WebSocket error', e);
      setIsConnected(false);
    };

    ws.onmessage = evt => {
      try {
        const parsed: unknown = JSON.parse(typeof evt.data === 'string' ? evt.data : '');
        const msg = parsed as ServerMessage;
        if (msg && typeof msg === 'object' && (msg as { type?: unknown }).type === 'translation') {
          const t = msg as TranslationMessage;
          if (t.audio_base64) playBase64Audio(t.audio_base64);
          setLastMessage(t);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };
  }, [disconnect]);

  return { connect, disconnect, lastMessage, isConnected };
}

