import { useState } from 'react';
import { CheckCircle, Download, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import type { TranscriptEntry, SessionConfig } from '../types';

interface CompletedScreenProps {
  transcript: TranscriptEntry[];
  config: SessionConfig;
  onNewSession: () => void;
  reportHtml: string;
}

function downloadSoapNote(transcript: TranscriptEntry[], config: SessionConfig, reportHtml: string) {
  let content = '';

  if (reportHtml) {
    const div = document.createElement('div');
    div.innerHTML = reportHtml;
    content = div.innerText;
  } else {
    const lines = [
      'MEDITRANSLATE SESSION TRANSCRIPT',
      '=================================',
      `Date: ${new Date().toLocaleDateString()}`,
      `Doctor Language: ${config.doctorLanguage.name}`,
      `Patient Language: ${config.patientLanguage.name}`,
      `Total Exchanges: ${transcript.length}`,
      '',
      'CONVERSATION',
      '------------',
      '',
      ...transcript.flatMap(e => [
        `[${e.timestamp}] ${e.speaker === 'doctor' ? 'DOCTOR' : 'PATIENT'}`,
        `Original: ${e.original}`,
        `Translated: ${e.translated}`,
        '',
      ]),
    ];
    content = lines.join('\n');
  }

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `MediTranslate-SOAP-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// Strip ```html ... ``` markdown fences if backend returns them
function cleanHtml(html: string): string {
  return html.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim();
}

export default function CompletedScreen({ transcript, config, onNewSession, reportHtml }: CompletedScreenProps) {
  const [downloaded, setDownloaded] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const cleanedHtml = cleanHtml(reportHtml);

  const handleDownload = () => {
    if (!cleanedHtml) {
      alert('SOAP note is still generating, please wait a moment...');
      return;
    }
    downloadSoapNote(transcript, config, cleanedHtml);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#f0f4f8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Sora, sans-serif', padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '480px' }}>

        {/* Main card */}
        <div style={{
          backgroundColor: '#fff', borderRadius: '20px', padding: '36px 28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center',
          marginBottom: '12px',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            border: '2px solid #22c55e', backgroundColor: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle style={{ width: '36px', height: '36px', color: '#22c55e' }} />
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 8px' }}>
            Session Completed
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: '0 0 28px' }}>
            Your consultation recording and transcript have been saved successfully.
          </p>

          {/* Download button */}
          <button
            onClick={handleDownload}
            style={{
              width: '100%', padding: '14px',
              borderRadius: '12px', border: 'none',
              backgroundColor: downloaded ? '#16a34a' : cleanedHtml ? '#22c55e' : '#86efac',
              color: '#fff', fontSize: '15px', fontWeight: '600',
              cursor: cleanedHtml ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
              fontFamily: 'Sora, sans-serif', marginBottom: '10px',
              transition: 'background-color 0.2s',
            }}
          >
            {downloaded
              ? <><CheckCircle style={{ width: '16px', height: '16px' }} /> Downloaded!</>
              : cleanedHtml
                ? <><Download style={{ width: '16px', height: '16px' }} /> Download SOAP Note</>
                : <>⏳ Generating SOAP Note...</>
            }
          </button>

          {/* New session button */}
          <button
            onClick={onNewSession}
            style={{
              width: '100%', padding: '13px',
              borderRadius: '12px', border: '1.5px solid #e5e7eb',
              backgroundColor: '#fff', color: '#374151',
              fontSize: '14px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontFamily: 'Sora, sans-serif', transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
            Start New Session
          </button>
        </div>

        {/* SOAP Note Report */}
        {cleanedHtml ? (
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
            marginBottom: '12px',
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                📋 SOAP Note
              </span>
            </div>
            <div style={{ padding: '16px 20px', maxHeight: '400px', overflowY: 'auto' }}>
              <style>{`
                .soap h2 { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 12px; }
                .soap h3 { font-size: 13px; font-weight: 700; color: #2563eb; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.06em; }
                .soap p  { font-size: 13px; color: #374151; line-height: 1.7; margin: 0 0 8px; }
                .soap strong { color: #111827; font-weight: 600; }
                .soap hr { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
                .soap em { color: #9ca3af; font-style: italic; }
              `}</style>
              <div className="soap" dangerouslySetInnerHTML={{ __html: cleanedHtml }} />
            </div>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '14px 20px', marginBottom: '12px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>⏳ Generating SOAP note...</span>
          </div>
        )}

        {/* Transcript preview toggle */}
        {transcript.length > 0 && (
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
          }}>
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              style={{
                width: '100%', padding: '14px 20px',
                border: 'none', backgroundColor: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', fontFamily: 'Sora, sans-serif',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                View Transcript ({transcript.length} exchanges)
              </span>
              {showTranscript
                ? <ChevronUp style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
                : <ChevronDown style={{ width: '16px', height: '16px', color: '#9ca3af' }} />
              }
            </button>

            {showTranscript && (
              <div style={{
                borderTop: '1px solid #e5e7eb', padding: '16px 20px',
                maxHeight: '280px', overflowY: 'auto',
              }}>
                {transcript.map(entry => (
                  <div key={entry.id} style={{ marginBottom: '14px' }}>
                    <p style={{
                      fontSize: '11px', fontWeight: '700', margin: '0 0 4px',
                      color: entry.speaker === 'doctor' ? '#2563eb' : '#059669',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {entry.speaker} · {entry.timestamp}
                    </p>
                    <p style={{ margin: '0 0 3px', fontSize: '12px', color: '#1f2937' }}>{entry.original}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                      → {entry.translated}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}