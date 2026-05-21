const { handleCors } = require('../lib/cors');
const { verifyToken, checkUsageLimit, logUsage } = require('../lib/auth');
const Anthropic = require('@anthropic-ai/sdk');
const { tools } = require('../lib/tools');

const SYSTEM_PROMPT =
  '당신은 한국어 음성 명령을 해석하는 어시스턴트입니다. ' +
  '사용자의 발화를 듣고 가장 적절한 도구를 선택해서 호출하세요. ' +
  "'틀어줘'/'들려줘'/'재생해줘' 같은 표현은 play_youtube를 사용하되, " +
  "'유튜브 열어줘' 같이 검색어가 없으면 open_url을 사용하세요. " +
  '명확하지 않으면 unknown_command를 사용하세요.';

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

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text 필드가 필요합니다' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: text }],
    });

    // tool_use 블록 추출
    const toolUseBlock = response.content.find((block) => block.type === 'tool_use');

    // 사용 기록 저장 (실패해도 응답에 영향 없음)
    await logUsage(user.id, 'parse-intent');

    if (!toolUseBlock) {
      return res.status(200).json({ tool: 'unknown_command', input: { reason: '도구를 선택하지 않았습니다' } });
    }

    return res.status(200).json({ tool: toolUseBlock.name, input: toolUseBlock.input });
  } catch (err) {
    console.error('[parse-intent] 오류:', err);
    return res.status(500).json({ error: '의도 파악 중 오류가 발생했습니다', detail: err.message });
  }
};
