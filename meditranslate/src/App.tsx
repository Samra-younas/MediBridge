import { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import SessionScreen from './components/SessionScreen';
import CompletedScreen from './components/CompletedScreen';
import type { Screen, SessionConfig, TranscriptEntry } from './types';

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [reportHtml, setReportHtml] = useState<string>('');

  const handleStart = (cfg: SessionConfig) => {
    setConfig(cfg);
    setTranscript([]);
    setReportHtml('');
    setScreen('session');
  };

  const handleEnd = async (t: TranscriptEntry[]) => {
    setTranscript(t);
    setScreen('completed');

    const transcriptText = t.map(e =>
      `[${e.timestamp}] ${e.speaker.toUpperCase()}: ${e.original} (→ ${e.translated})`
    ).join('\n');

    try {
      const res = await fetch('http://localhost:8000/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptText,
          doctor_language: config?.doctorLanguage.name,
          patient_language: config?.patientLanguage.name,
        }),
      });
      const data = await res.json();
      if (data.html) setReportHtml(data.html);
    } catch (e) {
      console.error('[REPORT]', e);
    }
  };

  const handleNewSession = () => {
    setConfig(null);
    setTranscript([]);
    setReportHtml('');
    setScreen('setup');
  };

  return (
    <>
      {screen === 'setup' && (
        <SetupScreen onStart={handleStart} />
      )}
      {screen === 'session' && config && (
        <SessionScreen config={config} onEnd={handleEnd} />
      )}
      {screen === 'completed' && config && (
        <CompletedScreen
          transcript={transcript}
          config={config}
          onNewSession={handleNewSession}
          reportHtml={reportHtml}
        />
      )}
    </>
  );
}