const SARVAM_TTS_ENDPOINT = "https://api.sarvam.ai/text-to-speech";

function cleanLine(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function synthesizeLuiSpeech(text, apiKey, fetchImpl = fetch) {
  const line = cleanLine(text);
  if (!apiKey || !line) return null;

  const response = await fetchImpl(SARVAM_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify({
      text: line,
      language_code: "en-IN",
      model: "bulbul:v3",
      speaker: "priya",
      pace: 1.05,
      output_audio_codec: "mp3",
      speech_sample_rate: 24000,
    }),
  });

  if (!response.ok) throw new Error(`Sarvam speech returned ${response.status}`);
  const payload = await response.json();
  const audio = Array.isArray(payload.audios) ? payload.audios[0] : "";
  if (typeof audio !== "string" || !audio.trim()) return null;
  return `data:audio/mpeg;base64,${audio}`;
}

module.exports = { cleanLine, synthesizeLuiSpeech };
