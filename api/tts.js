const { handleCors } = require('../lib/cors');
const { verifyToken, checkUsageLimit, logUsage } = require('../lib/auth');
const OpenAI = require('openai');

const MAX_TEXT_LENGTH = 4096;

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' });
  }

  // 토큰 검증
  const authResult = await verifyToken(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  // 사용량 한도 확인
  const { user } = authResult;
  const { allowed, used, limit } = await checkUsageLimit(user.id);
  if (!allowed) {
    return res.status(429).json({ error: `오늘 사용량을 초과했습니다 (${used}/${limit})` });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY가 설정되지 않았습니다' });
  }

  const { text } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: '텍스트가 필요합니다' });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `텍스트가 너무 깁니다 (최대 ${MAX_TEXT_LENGTH}자)` });
  }

  try {
    console.log('[TTS] OpenAI TTS 호출 시작 | 텍스트 길이:', text.length, '자');

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
      response_format: 'mp3',
      speed: 1.0,
    });

    // Response에서 ArrayBuffer를 받아 Buffer로 변환 후 base64 인코딩
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');

    console.log('[TTS] 변환 완료 | MP3 크기:', buffer.length, 'bytes | base64 길이:', audioBase64.length);

    // 사용 기록 저장 (실패해도 응답에 영향 없음)
    await logUsage(user.id, '/api/tts');

    return res.status(200).json({ audio: audioBase64 });
  } catch (err) {
    console.error('[TTS] 오류:', err);
    return res.status(500).json({ error: '음성 합성 중 오류가 발생했습니다', detail: err.message });
  }
};
