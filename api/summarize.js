const { handleCors } = require('../lib/cors');
const { verifyToken, checkUsageLimit, logUsage } = require('../lib/auth');
const Anthropic = require('@anthropic-ai/sdk');

const MAX_INPUT_LENGTH = 50000;
const MIN_INPUT_LENGTH = 50;

const SYSTEM_PROMPT =
  '당신은 웹페이지 내용을 간결하게 요약하는 어시스턴트입니다. ' +
  '사용자가 제공한 페이지 텍스트를 읽고 핵심 내용을 한국어로 요약하세요. ' +
  '다음 규칙을 따르세요: ' +
  '1) 3~5문장으로 핵심만 전달. ' +
  '2) 음성으로 읽힐 것이므로 자연스러운 구어체. ' +
  '3) 불릿 포인트나 특수문자 사용하지 말고 자연스러운 문장으로. ' +
  '4) 페이지가 기사면 주요 내용을, 제품 페이지면 무엇을 파는지를, 문서면 주제를 요약.';

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다' });
  }

  const { text, title } = req.body;

  if (!text || text.trim().length < MIN_INPUT_LENGTH) {
    return res.status(400).json({ error: '요약할 내용이 충분하지 않습니다' });
  }

  // Claude 입력 한도를 고려해 초과 텍스트를 잘라냄
  const trimmedText = text.length > MAX_INPUT_LENGTH ? text.slice(0, MAX_INPUT_LENGTH) : text;
  const isTrimmed = text.length > MAX_INPUT_LENGTH;

  console.log(
    '[summarize] 요청 | 제목:', title || '(없음)',
    '| 원본 길이:', text.length, '자',
    isTrimmed ? `(${MAX_INPUT_LENGTH}자로 잘라냄)` : ''
  );

  // 제목이 있으면 컨텍스트로 포함
  const userContent = title
    ? `제목: ${title}\n\n내용:\n${trimmedText}`
    : `내용:\n${trimmedText}`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const summary = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    console.log('[summarize] 완료 | 요약 길이:', summary.length, '자');

    // 사용 기록 저장 (실패해도 응답에 영향 없음)
    await logUsage(user.id, '/api/summarize');

    return res.status(200).json({ summary });
  } catch (err) {
    console.error('[summarize] 오류:', err);
    return res.status(500).json({ error: '요약 중 오류가 발생했습니다', detail: err.message });
  }
};
