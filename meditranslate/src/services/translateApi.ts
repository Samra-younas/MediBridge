type TranslateParams = {
  audioBase64: string;
  sourceLangCode: string;
  sourceLangName: string;
  targetLangCode: string;
  targetLangName: string;
  roomId: string;
  speaker: string;
};

type TranslateResponse = {
  transcript: string;
  translation: string;
  audio_base64: string;
};

function playBase64Audio(audioBase64: string): void {
  try {
    const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
    void audio.play();
  } catch (e) {
    console.error('Failed to play audio', e);
  }
}

export default async function sendAudioForTranslation(params: TranslateParams): Promise<TranslateResponse> {
  try {
    const res = await fetch('http://localhost:8000/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_base64: params.audioBase64,
        source_lang_code: params.sourceLangCode,
        source_lang_name: params.sourceLangName,
        target_lang_code: params.targetLangCode,
        target_lang_name: params.targetLangName,
        room_id: params.roomId,
        speaker: params.speaker,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Translate request failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as TranslateResponse;
    if (data.audio_base64) playBase64Audio(data.audio_base64);
    return data;
  } catch (e) {
    console.error('sendAudioForTranslation failed', e);
    throw e;
  }
}

