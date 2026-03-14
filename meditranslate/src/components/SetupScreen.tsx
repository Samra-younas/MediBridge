import { useState } from 'react';
import { ArrowLeftRight, ChevronDown, Mic } from 'lucide-react';
import { LANGUAGES } from '../types';
import type { Language, SessionConfig } from '../types';

interface SetupScreenProps {
  onStart: (config: SessionConfig) => void;
}

export default function SetupScreen({ onStart }: SetupScreenProps) {
  const [doctorLang, setDoctorLang] = useState<Language | null>(null);
  const [patientLang, setPatientLang] = useState<Language | null>(null);

  const handleSwap = () => {
    const temp = doctorLang;
    setDoctorLang(patientLang);
    setPatientLang(temp);
  };

  const canStart = doctorLang && patientLang && doctorLang.code !== patientLang.code;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f0f4f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Sora, sans-serif',
      padding: '16px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: '#dbeafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>
            MediTranslate
          </h1>
          <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>Start Consultation</p>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}>

          {/* Doctor language */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: '#374151', marginBottom: '8px',
            }}>
              Doctor speaks
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={doctorLang?.code ?? ''}
                onChange={e => setDoctorLang(LANGUAGES.find(l => l.code === e.target.value) ?? null)}
                style={{
                  width: '100%', padding: '12px 40px 12px 14px',
                  borderRadius: '10px', border: '1.5px solid #e5e7eb',
                  backgroundColor: '#fff', fontSize: '14px', color: doctorLang ? '#111827' : '#9ca3af',
                  appearance: 'none', cursor: 'pointer', outline: 'none',
                  fontFamily: 'Sora, sans-serif', fontWeight: '500',
                }}
              >
                <option value="" disabled>Select languag</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code} disabled={lang.code === patientLang?.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <ChevronDown style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)', width: '18px', height: '18px',
                color: '#9ca3af', pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* Swap button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0 20px' }}>
            <button
              onClick={handleSwap}
              style={{
                width: '40px', height: '40px', borderRadius: '50%',
                border: '1.5px solid #e5e7eb', backgroundColor: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
            >
              <ArrowLeftRight style={{ width: '16px', height: '16px', color: '#6b7280' }} />
            </button>
          </div>

          {/* Patient language */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: '600',
              color: '#374151', marginBottom: '8px',
            }}>
              Patient speaks
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={patientLang?.code ?? ''}
                onChange={e => setPatientLang(LANGUAGES.find(l => l.code === e.target.value) ?? null)}
                style={{
                  width: '100%', padding: '12px 40px 12px 14px',
                  borderRadius: '10px', border: '1.5px solid #e5e7eb',
                  backgroundColor: '#fff', fontSize: '14px', color: patientLang ? '#111827' : '#9ca3af',
                  appearance: 'none', cursor: 'pointer', outline: 'none',
                  fontFamily: 'Sora, sans-serif', fontWeight: '500',
                }}
              >
                <option value="" disabled>Select languag</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code} disabled={lang.code === doctorLang?.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <ChevronDown style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)', width: '18px', height: '18px',
                color: '#9ca3af', pointerEvents: 'none',
              }} />
            </div>
          </div>

          {/* Warning */}
          {doctorLang && patientLang && doctorLang.code === patientLang.code && (
            <p style={{ color: '#f59e0b', fontSize: '13px', marginBottom: '16px' }}>
              ⚠️ Please select different languages.
            </p>
          )}

          {/* Start button */}
          <button
            onClick={() => canStart && onStart({ doctorLanguage: doctorLang!, patientLanguage: patientLang! })}
            disabled={!canStart}
            style={{
              width: '100%', padding: '14px',
              borderRadius: '12px', border: 'none',
              backgroundColor: canStart ? '#2563eb' : '#d1d5db',
              color: canStart ? '#fff' : '#9ca3af',
              fontSize: '15px', fontWeight: '600',
              cursor: canStart ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              fontFamily: 'Sora, sans-serif',
              transition: 'background-color 0.2s',
            }}
          >
            <Mic style={{ width: '16px', height: '16px' }} />
            Start Session
          </button>
        </div>
      </div>
    </div>
  );
}
