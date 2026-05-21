const { handleCors } = require('../lib/cors');
const OpenAI = require('openai');
const { toFile } = require('openai');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다' });
  }

  const { audio } = req.body;
  if (!audio) {
    return res.status(400).json({ error: 'audio 필드가 필요합니다 (base64 인코딩된 오디오)' });
  }

  try {
    const audioBuffer = Buffer.from(audio, 'base64');

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Buffer를 File 객체로 변환하여 multipart/form-data로 전송
    const audioFile = await toFile(audioBuffer, 'audio.webm', { type: 'audio/webm' });

    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'ko',
      response_format: 'json',
    });

    return res.status(200).json({ text: transcription.text });
  } catch (err) {
    console.error('[transcribe] 오류:', err);
    return res.status(500).json({ error: '음성 인식 중 오류가 발생했습니다', detail: err.message });
  }
};
