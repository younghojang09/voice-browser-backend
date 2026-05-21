# Voice Browser Backend

크롬 확장 **Voice Browser**의 백엔드 서버입니다.  
사용자 대신 OpenAI Whisper, Anthropic Claude, YouTube Data API를 호출하며, API 키는 서버 환경변수에 안전하게 보관됩니다.

## 기술 스택

- Vercel Serverless Functions (Node.js 20.x)
- `@anthropic-ai/sdk` — Claude Tool Use로 음성 명령 의도 파악
- `openai` — Whisper 음성 인식
- YouTube Data API v3 — 영상 검색

## 환경변수 설정

`.env.example`을 복사하여 `.env` 파일을 만들고 각 키를 입력합니다.

```bash
cp .env.example .env
```

| 변수명 | 설명 |
|---|---|
| `OPENAI_API_KEY` | OpenAI API 키 (Whisper 사용) |
| `ANTHROPIC_API_KEY` | Anthropic API 키 (Claude 사용) |
| `YOUTUBE_API_KEY` | Google Cloud YouTube Data API v3 키 |

## 로컬 테스트

```bash
# Vercel CLI 설치 (최초 1회)
npm i -g vercel

# 로컬 개발 서버 시작 (.env 자동 로드)
vercel dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

### 엔드포인트 테스트 예시

```bash
# 음성 인식
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{"audio": "<base64-encoded-audio>"}'

# 의도 파악
curl -X POST http://localhost:3000/api/parse-intent \
  -H "Content-Type: application/json" \
  -d '{"text": "아이유 좋은날 틀어줘"}'

# YouTube 검색
curl -X POST http://localhost:3000/api/youtube-search \
  -H "Content-Type: application/json" \
  -d '{"query": "아이유 좋은날"}'
```

## Vercel 배포

```bash
# 최초 배포 (프로젝트 연결)
vercel

# 프로덕션 배포
vercel --prod
```

Vercel 대시보드 → Settings → Environment Variables에서 환경변수를 설정하세요.

## API 엔드포인트

### `POST /api/transcribe`
base64 인코딩된 오디오를 받아 한국어 텍스트로 변환합니다.

**요청**
```json
{ "audio": "<base64 문자열>" }
```
**응답**
```json
{ "text": "인식된 텍스트" }
```

---

### `POST /api/parse-intent`
텍스트를 받아 Claude가 적절한 브라우저 명령 도구를 선택합니다.

**요청**
```json
{ "text": "아이유 좋은날 틀어줘" }
```
**응답**
```json
{ "tool": "play_youtube", "input": { "query": "아이유 좋은날" } }
```

지원 도구: `open_url`, `search_web`, `close_current_tab`, `open_new_tab`, `scroll_page`, `navigate_back`, `navigate_forward`, `refresh_page`, `next_tab`, `previous_tab`, `zoom_in`, `zoom_out`, `zoom_reset`, `bookmark_current`, `mute_tab`, `capture_screenshot`, `play_youtube`, `unknown_command`

---

### `POST /api/youtube-search`
검색어로 YouTube 영상을 찾아 videoId와 자동재생 URL을 반환합니다.

**요청**
```json
{ "query": "아이유 좋은날" }
```
**응답**
```json
{
  "videoId": "...",
  "title": "IU 아이유 - 좋은날",
  "url": "https://www.youtube.com/watch?v=...&autoplay=1"
}
```
