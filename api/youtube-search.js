const { handleCors } = require('../lib/cors');
const https = require('https');

// YouTube Data API v3 search를 Promise로 래핑
function youtubeSearch(query, apiKey) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: '1',
      key: apiKey,
    });
    const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('YouTube API 응답 파싱 실패'));
        }
      });
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 요청만 허용됩니다' });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY가 설정되지 않았습니다' });
  }

  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'query 필드가 필요합니다' });
  }

  try {
    const data = await youtubeSearch(query, process.env.YOUTUBE_API_KEY);

    if (!data.items || data.items.length === 0) {
      return res.status(404).json({ error: '검색 결과를 찾을 수 없습니다' });
    }

    const item = data.items[0];
    const videoId = item.id.videoId;
    const title = item.snippet.title;

    return res.status(200).json({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}&autoplay=1`,
    });
  } catch (err) {
    console.error('[youtube-search] 오류:', err);
    return res.status(500).json({ error: 'YouTube 검색 중 오류가 발생했습니다', detail: err.message });
  }
};
