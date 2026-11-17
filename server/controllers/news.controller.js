/**
 * 뉴스 API 컨트롤러: 쿼리 검증 → 서비스 호출 → 표준 응답 생성
 */
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { fetchNews } from '../services/fetcher.service.js';

/**
 * GET /api/news?keyword=AI&limit=30
 */
export async function getNews(req, res) {
  const keyword = String(req.query.keyword ?? '').trim();
  if (keyword.length > config.maxKeywordLength) {
    throw new AppError(400, 'INVALID_KEYWORD', `키워드는 ${config.maxKeywordLength}자 이하여야 합니다.`);
  }

  const rawLimit = req.query.limit === undefined ? config.defaultLimit : Number(req.query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    throw new AppError(400, 'INVALID_LIMIT', 'limit은 1 이상의 정수여야 합니다.');
  }
  const limit = Math.min(rawLimit, config.maxLimit);

  const articles = await fetchNews({ keyword, limit });
  res.json({
    success: true,
    data: { keyword, count: articles.length, articles },
  });
}
