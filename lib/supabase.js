const { createClient } = require('@supabase/supabase-js');

// 서버 측 전용 관리자 클라이언트 — SERVICE_KEY 사용
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

module.exports = { supabaseAdmin };
