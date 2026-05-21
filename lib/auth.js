const { supabaseAdmin } = require('./supabase');

/**
 * Authorization 헤더의 Bearer 토큰을 검증
 * @returns {{ user }} 성공 | {{ error, status }} 실패
 */
async function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth] Authorization 헤더 없음');
    return { error: '인증 토큰이 필요합니다', status: 401 };
  }

  const token = authHeader.slice(7); // 'Bearer ' 이후

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    console.log('[Auth] 토큰 검증 실패:', error?.message);
    return { error: '유효하지 않은 인증 토큰입니다', status: 401 };
  }

  console.log('[Auth] 토큰 검증 성공 | userId:', user.id);
  return { user };
}

/**
 * 오늘(UTC 00:00 기준) 사용 횟수와 daily_limit 비교
 * @returns {{ allowed: boolean, used: number, limit: number }}
 */
async function checkUsageLimit(userId) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  // 오늘 usage_logs 카운트
  const { count, error: countError } = await supabaseAdmin
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());

  if (countError) {
    // 조회 실패 시 차단하지 않고 허용 (서비스 중단 방지)
    console.error('[Auth] 사용량 조회 실패:', countError.message);
    return { allowed: true, used: 0, limit: 50 };
  }

  // profiles에서 daily_limit 조회
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('daily_limit')
    .eq('id', userId)
    .single();

  const limit = profile?.daily_limit ?? 50;
  const used = count ?? 0;
  const allowed = used < limit;

  console.log(`[Auth] 사용량 확인 | userId: ${userId} | ${used}/${limit} | allowed: ${allowed}`);
  return { allowed, used, limit };
}

/**
 * usage_logs에 사용 기록 INSERT
 * 실패해도 console.error만 — 사용자 응답에 영향 없음
 */
async function logUsage(userId, endpoint) {
  const { error } = await supabaseAdmin
    .from('usage_logs')
    .insert({ user_id: userId, endpoint });

  if (error) {
    console.error('[Auth] 사용 기록 저장 실패:', error.message);
  } else {
    console.log(`[Auth] 사용 기록 저장 완료 | userId: ${userId} | endpoint: ${endpoint}`);
  }
}

module.exports = { verifyToken, checkUsageLimit, logUsage };
