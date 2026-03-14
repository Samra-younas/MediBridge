from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from anthropic import Anthropic
from gtts import gTTS
from openai import OpenAI
from dotenv import load_dotenv
from typing import Dict, List
import os, tempfile, base64

load_dotenv()

# ── API Clients ──────────────────────────────────────────
_anthropic_key = os.getenv("ANTHROPIC_API_KEY")
_openai_key    = os.getenv("OPENAI_API_KEY")

anthropic_client = Anthropic(api_key=_anthropic_key) if _anthropic_key else None
openai_client    = OpenAI(api_key=_openai_key)        if _openai_key    else None

if not _anthropic_key: print("[WARN] ❌ ANTHROPIC_API_KEY missing in .env!")
else:                  print("[INFO] ✅ Anthropic client ready")
if not _openai_key:    print("[WARN] ❌ OPENAI_API_KEY missing in .env!")
else:                  print("[INFO] ✅ OpenAI client ready")

# ── App Setup ────────────────────────────────────────────
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

rooms: Dict[str, List[WebSocket]] = {}

class TranslateRequest(BaseModel):
    audio_base64: str
    source_lang_code: str
    source_lang_name: str
    target_lang_code: str
    target_lang_name: str
    room_id: str
    speaker: str = "Doctor"

# ── Functions ────────────────────────────────────────────
def transcribe_with_lang(file_path, language):
    """Transcribe audio forcing a specific language. Returns (text, avg_logprob)."""
    if not openai_client:
        return None, -999
    try:
        with open(file_path, "rb") as f:
            result = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language=language,
                response_format="verbose_json"
            )
        text = result.text.strip()
        # avg_logprob from first segment — closer to 0 = more confident
        segments = getattr(result, 'segments', [])
        logprob = segments[0].avg_logprob if segments else -1.0
        print(f"[STT] lang={language} | logprob={logprob:.3f} | text='{text}'")
        return (text if text else None), logprob
    except Exception as e:
        print(f"[STT] ❌ lang={language} error: {e}")
        return None, -999

def transcribe_audio(file_path, doctor_lang, patient_lang):
    """
    Smart hybrid:
    - Urdu/Hindi involved → double call (language detection unreliable)
    - All other pairs → single auto-detect call (faster, cheaper)
    Returns (transcript, detected_speaker)
    """
    # Languages that need double call due to similarity
    NEEDS_DOUBLE = {'ur', 'hi'}

    doc = doctor_lang.lower()
    pat = patient_lang.lower()
    use_double = doc in NEEDS_DOUBLE or pat in NEEDS_DOUBLE

    if use_double:
        print(f"[STT] Double call: doctor={doc} vs patient={pat}")
        doc_text, doc_score = transcribe_with_lang(file_path, doc)
        pat_text, pat_score = transcribe_with_lang(file_path, pat)
        print(f"[STT] Doctor  score={doc_score:.3f} text='{doc_text}'")
        print(f"[STT] Patient score={pat_score:.3f} text='{pat_text}'")
        if doc_score >= pat_score:
            print(f"[STT] → Doctor wins")
            return doc_text, "Doctor"
        else:
            print(f"[STT] → Patient wins")
            return pat_text, "Patient"
    else:
        print(f"[STT] Single auto-detect: doctor={doc} patient={pat}")
        try:
            with open(file_path, "rb") as f:
                result = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    response_format="verbose_json"
                )
            text     = result.text.strip()
            detected = (getattr(result, 'language', '') or '').lower()
            print(f"[STT] ✅ detected={detected} text='{text}'")

            # Map Whisper full name to ISO
            LANG_MAP = {
                "english":"en","urdu":"ur","arabic":"ar","french":"fr",
                "german":"de","spanish":"es","chinese":"zh","korean":"ko",
                "japanese":"ja","hindi":"hi","turkish":"tr","russian":"ru",
                "portuguese":"pt","italian":"it","dutch":"nl",
            }
            detected_iso = LANG_MAP.get(detected, detected)
            speaker = "Patient" if detected_iso == pat else "Doctor"
            print(f"[STT] → {speaker} ({detected_iso})")
            return (text if text else None), speaker
        except Exception as e:
            print(f"[STT] ❌ Error: {e}")
            return None, "Doctor"

def translate_text(text, source_lang, target_lang):
    if not anthropic_client:
        print("[TRANSLATE] ❌ Anthropic client not initialized — check ANTHROPIC_API_KEY")
        return None
    print(f"[TRANSLATE] {source_lang} → {target_lang}: '{text}'")
    try:
        message = anthropic_client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=500,
            messages=[{"role": "user", "content": f"You are a medical interpreter. Translate from {source_lang} to {target_lang}. Return ONLY the translated text.\nText: {text}"}]
        )
        translation = message.content[0].text.strip()
        print(f"[TRANSLATE] ✅ Result: '{translation}'")
        return translation
    except Exception as e:
        print(f"[TRANSLATE] ❌ Error: {e}")
        return None

def text_to_speech(text, language):
    print(f"[TTS] lang={language} | text='{text}'")
    try:
        tts = gTTS(text=text, lang=language, slow=False)
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        tmp.close()
        tts.save(tmp.name)
        with open(tmp.name, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode("utf-8")
        try: os.unlink(tmp.name)
        except: pass
        print(f"[TTS] ✅ Done: {len(audio_b64)} chars")
        return audio_b64
    except Exception as e:
        print(f"[TTS] ❌ Error: {e}")
        return None

# ── Routes ───────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "MediTranslate Running", "openai": bool(_openai_key), "anthropic": bool(_anthropic_key)}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    rooms.setdefault(room_id, []).append(websocket)
    print(f"[WS] ✅ Connected: room={room_id} | listeners={len(rooms[room_id])}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        rooms[room_id].remove(websocket)
        print(f"[WS] Disconnected: room={room_id}")

@app.post("/translate")
async def translate(req: TranslateRequest):
    print(f"\n{'='*50}")
    print(f"[REQUEST] {req.speaker} | {req.source_lang_name}({req.source_lang_code}) → {req.target_lang_name}({req.target_lang_code}) | room={req.room_id}")

    try:
        audio_data = base64.b64decode(req.audio_base64)
        print(f"[REQUEST] Audio size: {len(audio_data)} bytes")
    except Exception as e:
        print(f"[REQUEST] ❌ Audio decode failed: {e}")
        return {"error": "Invalid audio data"}

    tmp = tempfile.NamedTemporaryFile(suffix=".webm", delete=False)
    tmp.write(audio_data)
    tmp.close()

    transcript, speaker = transcribe_audio(
        tmp.name,
        doctor_lang=req.source_lang_code,
        patient_lang=req.target_lang_code
    )
    os.unlink(tmp.name)
    if not transcript:
        print("[REQUEST] ❌ No transcript")
        return {"error": "No speech detected"}

    # Direction based on who won the Whisper contest
    if speaker == "Patient":
        source_name = req.target_lang_name
        target_name = req.source_lang_name
        target_code = req.source_lang_code
        print(f"[DIRECTION] Patient → {target_name}")
    else:
        source_name = req.source_lang_name
        target_name = req.target_lang_name
        target_code = req.target_lang_code
        print(f"[DIRECTION] Doctor → {target_name}")

    translation = translate_text(transcript, source_name, target_name)
    if not translation:
        print("[REQUEST] ❌ Translation failed")
        return {"error": "Translation failed"}

    audio_b64 = text_to_speech(translation, target_code)
    if not audio_b64:
        print("[REQUEST] ❌ TTS failed")
        return {"error": "Audio generation failed"}

    print(f"{'='*50}\n")
    return {"transcript": transcript, "translation": translation, "audio_base64": audio_b64, "detected_speaker": speaker}

from datetime import date as dt_date

SOAP_NOTE_PROMPT = """
You are an expert medical scribe. Generate a professional SOAP Note from the provided doctor-patient conversation transcript.

## RULES
1. Extract ONLY information explicitly stated in the conversation — no assumptions, no inference
2. Return clean HTML only — no markdown, no preamble, no explanation
3. Use standard clinical abbreviations (c/o, h/o, Hx, Rx, Dx, etc.)
4. Use NARRATIVE PARAGRAPH format — not bullet points
5. If a section has no information from the transcript, write: <p><em>Not documented.</em></p>
6. Do not invent vital signs, lab values, or diagnoses not mentioned
7. Date = today's date unless stated otherwise in transcript

## OUTPUT FORMAT

<h2>SOAP Note</h2>
<p><strong>Date:</strong> {date}<br>
<strong>Chief Complaint:</strong> [Primary reason for visit in patient's words or paraphrased]</p>

<h3>Subjective</h3>
<p>[Patient history in narrative: who the patient is, chief complaint, onset, duration, character, severity, location, associated symptoms, aggravating/relieving factors, prior episodes, treatments tried. Include past medical history, surgical history, medications, allergies, family/social history if mentioned.]</p>

<h3>Objective</h3>
<p>[Physical exam findings in narrative. Include general appearance, vital signs, system-specific findings if mentioned by doctor.]</p>
<p><strong>Investigations:</strong> [Labs, imaging, or tests and results. If none: Not performed.]</p>

<h3>Assessment</h3>
<p>[Primary diagnosis or working diagnosis. Differential diagnoses if mentioned. Severity or staging if mentioned.]</p>

<h3>Plan</h3>
<p><strong>Medications:</strong> [Medications prescribed — name, dose, frequency, duration, route if mentioned]</p>
<p><strong>Investigations Ordered:</strong> [Tests, labs, or imaging ordered]</p>
<p><strong>Referrals:</strong> [Specialist referrals if mentioned]</p>
<p><strong>Lifestyle & Instructions:</strong> [Diet, activity, wound care, rest, patient instructions]</p>
<p><strong>Follow-up:</strong> [When to return, warning signs, specific instructions]</p>
<p><strong>Education:</strong> Diagnosis, treatment plan, and return precautions explained to patient. Questions addressed.</p>
<p><strong>Disposition:</strong> [Discharged home / admitted / referred / other — as stated]</p>

---

Transcript:
{transcript_text}
"""

class ReportRequest(BaseModel):
    transcript: str          # full conversation text
    doctor_language: str
    patient_language: str

@app.post("/generate-report")
async def generate_report(req: ReportRequest):
    print(f"\n[REPORT] Generating SOAP note...")
    if not anthropic_client:
        return {"error": "Anthropic API not configured"}

    if not req.transcript.strip():
        return {"error": "Empty transcript"}

    today = dt_date.today().strftime("%B %d, %Y")
    prompt = SOAP_NOTE_PROMPT.replace("{date}", today).replace("{transcript_text}", req.transcript)

    try:
        message = anthropic_client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )
        html = message.content[0].text.strip()
        print(f"[REPORT] ✅ Generated ({len(html)} chars)")
        return {"html": html}
    except Exception as e:
        print(f"[REPORT] ❌ Error: {e}")
        return {"error": str(e)}
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)