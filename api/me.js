const { handleCors } = require('../lib/cors');
const { verifyToken, checkUsageLimit } = require('../lib/auth');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 허용됩니다' });
  }

  // 토큰 검증
  const authResult = await verifyToken(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  const { user } = authResult;
  const { used, limit } = await checkUsageLimit(user.id);

  return res.status(200).json({
    userId: user.id,
    used_today: used,
    daily_limit: limit,
  });
};
