// Claude Tool Use 도구 정의 — 크롬 브라우저 제어 명령 18종
const tools = [
  {
    name: 'open_url',
    description: '지정한 URL을 새 탭에서 엽니다.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '열 URL (예: https://www.youtube.com)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'search_web',
    description: '구글에서 검색어를 검색합니다.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색할 키워드 또는 문장' },
      },
      required: ['query'],
    },
  },
  {
    name: 'close_current_tab',
    description: '현재 열려 있는 탭을 닫습니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'open_new_tab',
    description: '빈 새 탭을 엽니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'scroll_page',
    description: '현재 페이지를 스크롤합니다.',
    input_schema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['up', 'down', 'top', 'bottom'],
          description: '스크롤 방향: up(위), down(아래), top(맨 위), bottom(맨 아래)',
        },
      },
      required: ['direction'],
    },
  },
  {
    name: 'navigate_back',
    description: '브라우저 뒤로가기를 실행합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'navigate_forward',
    description: '브라우저 앞으로가기를 실행합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'refresh_page',
    description: '현재 페이지를 새로고침합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'next_tab',
    description: '다음 탭으로 이동합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'previous_tab',
    description: '이전 탭으로 이동합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'zoom_in',
    description: '페이지를 확대합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'zoom_out',
    description: '페이지를 축소합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'zoom_reset',
    description: '페이지 줌을 100%로 초기화합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'bookmark_current',
    description: '현재 페이지를 북마크에 추가합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'mute_tab',
    description: '현재 탭의 음소거를 토글합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'capture_screenshot',
    description: '현재 화면을 스크린샷으로 캡처합니다.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'play_youtube',
    description: '유튜브에서 검색어로 영상을 찾아 자동 재생합니다. "틀어줘", "들려줘", "재생해줘" 같은 표현에 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '유튜브에서 검색할 영상 키워드 (예: 아이유 좋은날)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'unknown_command',
    description: '사용자의 발화를 어떤 도구로도 처리할 수 없을 때 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '처리할 수 없는 이유' },
      },
      required: ['reason'],
    },
  },
];

module.exports = { tools };
