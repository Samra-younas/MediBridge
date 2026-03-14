# MediBridge 🩺
> Real-time AI medical interpreter for multilingual clinical consultations

## Demo
[▶ Watch Demo](https://github.com/user-attachments/assets/5f4c9435-9ab2-4cc7-aa07-2fa495697bc9)
## Screenshots
![Setup Screen](https://github.com/user-attachments/assets/4d7593af-7443-4388-939c-b71d77a1a48f)
![Session Screen](https://github.com/user-attachments/assets/9de35844-2ef0-4e9b-b8c8-7adc77ef5317)


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
