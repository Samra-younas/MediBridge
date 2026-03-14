export type Screen = 'setup' | 'session' | 'completed';

export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface TranscriptEntry {
  id: string;
  speaker: 'doctor' | 'patient';
  original: string;
  translated: string;
  timestamp: string;
  isNew?: boolean;
}

export interface SessionConfig {
  doctorLanguage: Language;
  patientLanguage: Language;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English',    nativeName: 'English',    flag: '🇺🇸' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',    flag: '🇪🇸' },
  { code: 'fr', name: 'French',     nativeName: 'Français',   flag: '🇫🇷' },
  { code: 'de', name: 'German',     nativeName: 'Deutsch',    flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese',    nativeName: '中文',        flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',    flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',      flag: '🇮🇳' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',  flag: '🇧🇷' },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',    flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese',   nativeName: '日本語',      flag: '🇯🇵' },
  { code: 'ko', name: 'Korean',     nativeName: '한국어',      flag: '🇰🇷' },
  { code: 'tr', name: 'Turkish',    nativeName: 'Türkçe',     flag: '🇹🇷' },
  { code: 'ur', name: 'Urdu',       nativeName: 'اردو',       flag: '🇵🇰' },
  { code: 'it', name: 'Italian',    nativeName: 'Italiano',   flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch',      nativeName: 'Nederlands', flag: '🇳🇱' },
];
