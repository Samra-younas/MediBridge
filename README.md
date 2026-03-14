# MediBridge 🩺
> Real-time AI medical interpreter for multilingual clinical consultations

## Demo

https://github.com/Samra-younas/Medibridge/raw/main/meditranslate/assests/demo.mp3

## Screenshots
![Setup Screen](meditranslate/assests/front.jpg)
![Session Screen](meditranslate/assests/2front.jpg)

## Features
- 🎙️ Auto voice detection — no button needed
- 🌍 15 languages supported
- 🔄 Real-time bidirectional translation
- 🔊 Text-to-speech playback
- 📋 Auto-generated SOAP notes
- 📄 Downloadable session transcript

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | FastAPI + Python |
| STT | OpenAI Whisper |
| Translation | Claude Haiku (Anthropic) |
| TTS | Google Text-to-Speech (gTTS) |

## Setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # add your API keys
python app.py
```

### Frontend
```bash
cd meditranslate
npm install
npm run dev
```

## Environment Variables
```
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

## ⚠️ Disclaimer
This tool is intended to assist — not replace — professional medical interpretation.

## License
MIT
