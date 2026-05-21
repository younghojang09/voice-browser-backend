// 공통 CORS 헤더 설정 (추후 chrome-extension:// 오리진으로 좁힐 예정)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 응답에 CORS 헤더를 추가하는 헬퍼
function setCorsHeaders(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

// OPTIONS preflight 요청 처리. preflight면 true 반환 (핸들러가 조기 종료해야 함)
function handleCors(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { handleCors, setCorsHeaders };
