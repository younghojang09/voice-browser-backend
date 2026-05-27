const { handleCors } = require('../lib/cors');
const { verifyToken, checkUsageLimit, logUsage } = require('../lib/auth');
const Anthropic = require('@anthropic-ai/sdk');
const { tools } = require('../lib/tools');

const SYSTEM_PROMPT =
  '당신은 한국어 음성 명령을 해석하는 어시스턴트입니다. ' +
  '사용자의 발화를 듣고 가장 적절한 도구를 선택해서 호출하세요. ' +
  "'틀어줘'/'들려줘'/'재생해줘' 같은 표현은 play_youtube를 사용하되, " +
  "'유튜브 열어줘' 같이 검색어가 없으면 open_url을 사용하세요. " +
  '유튜브 명령은 의도에 따라 구분하세요: ' +
  "'틀어줘'/'들려줘'/'재생해줘'/'플레이'는 play_youtube (첫 영상 자동 재생). " +
  "'검색해줘'/'찾아줘'/'찾아봐'는 youtube_search (검색 결과 페이지만, 재생 안 함). " +
  "'유튜브 열어줘'(검색어 없음)는 open_url로 유튜브 메인. " +
  "사용자가 '거기서', '그 유튜브에서', '아까 연 거기서' 같이 이전에 연 탭을 가리키면 " +
  '새 탭을 열지 말고 기존 탭에서 작업하라는 의도입니다. ' +
  '이 경우 도구의 input에 use_current_tab: true를 포함하세요. ' +
  "예: '유튜브 열어줘' 다음 '거기서 프로미스나인 검색해줘' → youtube_search({query: '프로미스나인', use_current_tab: true}). " +
  "단, 새로운 대상을 여는 경우(예: '네이버도 열어줘')는 use_current_tab 없이 새 탭으로. " +
  '명확하지 않으면 unknown_command를 사용하세요. ' +
  "사용자가 '그리고', '~하고', '~한 다음', '동시에' 같은 표현으로 여러 동작을 한 번에 요청하면, " +
  '여러 도구를 순서대로 모두 호출하세요. ' +
  '사용자가 여러 동작을 요청하면 개수에 상관없이 필요한 모든 도구를 순서대로 호출하세요. ' +
  '2개든 5개든 사용자가 말한 모든 동작을 빠짐없이 도구로 변환하세요. ' +
  "예: '유튜브 열고 구글에서 파이썬 검색하고 네이버 열고 확대해줘' → open_url, search_web, open_url, zoom_in 네 개를 순서대로 호출. " +
  '도구 호출 순서는 사용자가 말한 순서를 정확히 지키세요. ' +
  '이전 대화 맥락을 참고하세요. ' +
  "'거기서', '방금 그거', '또', '다시' 같은 참조 표현은 이전 대화에서 언급된 대상을 의미합니다. " +
  "예를 들어 '유튜브 열어줘' 다음에 '거기서 BTS 검색해줘'라고 하면, " +
  "'거기'는 유튜브를 의미하므로 play_youtube({query: 'BTS'})를 사용하세요. " +
  '사용자가 현재 페이지 내용에 대해 묻거나 요약을 요청하면 summarize_page를 사용하세요. ' +
  "예: '이 페이지 요약해줘', '이거 무슨 내용이야', '여기 뭐라고 써있어' 등.";

const MAX_HISTORY_TURNS = 10;

/**
 * assistant 메시지의 tool_use 블록을 Claude API 충돌 없이 텍스트로 변환
 * tool_use가 여러 개인 경우도 모두 처리
 *
 * @param {Array} history - 클라이언트에서 받은 대화 히스토리
 * @returns {Array} Claude API에 안전하게 전달 가능한 messages 배열
 */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  // 최근 MAX_HISTORY_TURNS 턴만 사용
  const trimmed = history.slice(-MAX_HISTORY_TURNS);

  return trimmed.map((msg) => {
    // user 메시지는 그대로 사용
    if (msg.role === 'user') {
      return { role: 'user', content: String(msg.content ?? '') };
    }

    // assistant 메시지: content가 배열이면 tool_use 블록을 텍스트로 변환
    if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        const parts = msg.content.map((block) => {
          if (block.type === 'tool_use') {
            // input 객체를 "key=value" 형태로 직렬화 (tool_use가 여러 개여도 각각 처리)
            const inputStr = Object.entries(block.input ?? {})
              .map(([k, v]) => `${k}="${v}"`)
              .join(', ');
            return `[실행: ${block.name}(${inputStr})]`;
          }
          return block.text ?? '';
        });
        return { role: 'assistant', content: parts.filter(Boolean).join(' ') };
      }
      return { role: 'assistant', content: String(msg.content ?? '') };
    }

    return null;
  }).filter(Boolean);
}

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

  const { text, history } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text 필드가 필요합니다' });
  }

  // history 유효성 검사 — 잘못된 형식이면 빈 배열로 대체
  const rawHistory = Array.isArray(history) ? history : [];
  console.log('[parse-intent] 수신 | 텍스트:', text, '| history 턴 수:', rawHistory.length);

  const sanitizedHistory = sanitizeHistory(rawHistory);
  const messages = [
    ...sanitizedHistory,
    { role: 'user', content: text },
  ];

  console.log('[parse-intent] Claude에 전달할 messages 구조:',
    messages.map((m) => `${m.role}: ${String(m.content).slice(0, 60)}`));

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: 'auto' },
      messages,
    });

    // content에서 모든 tool_use 블록 추출 (멀티 명령 지원)
    const toolUses = response.content
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({ name: block.name, input: block.input }));

    console.log('[parse-intent] 추출된 도구 수:', toolUses.length);
    toolUses.forEach((t, i) => {
      console.log(`[parse-intent] 도구 ${i + 1}: ${t.name} | input:`, JSON.stringify(t.input));
    });

    // 사용 기록 저장 (실패해도 응답에 영향 없음)
    await logUsage(user.id, 'parse-intent');

    // 도구가 없으면 unknown_command를 배열에 담아 반환
    if (toolUses.length === 0) {
      return res.status(200).json({
        tools: [{ name: 'unknown_command', input: { reason: '명령을 이해하지 못했습니다' } }],
      });
    }

    return res.status(200).json({ tools: toolUses });
  } catch (err) {
    console.error('[parse-intent] 오류:', err);
    return res.status(500).json({ error: '의도 파악 중 오류가 발생했습니다', detail: err.message });
  }
};
