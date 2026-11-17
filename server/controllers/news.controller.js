/**
 * 뉴스 API 컨트롤러: 쿼리 검증 → 서비스 호출 → 표준 응답 생성
 */
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { fetchNews } from '../services/fetcher.service.js';
import { createDigest } from '../services/digest.service.js';

/** 쿼리 파라미터(keyword, limit)를 검증하고 정규화한다. */
function parseQuery(req) {
  const keyword = String(req.query.keyword ?? '').trim();
  if (keyword.length > config.maxKeywordLength) {
    throw new AppError(400, 'INVALID_KEYWORD', `키워드는 ${config.maxKeywordLength}자 이하여야 합니다.`);
  }

  const rawLimit = req.query.limit === undefined ? config.defaultLimit : Number(req.query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    throw new AppError(400, 'INVALID_LIMIT', 'limit은 1 이상의 정수여야 합니다.');
  }
  const limit = Math.min(rawLimit, config.maxLimit);
  return { keyword, limit };
}

/**
 * GET /api/news?keyword=AI&limit=30
 */
export async function getNews(req, res) {
  const { keyword, limit } = parseQuery(req);
  const articles = await fetchNews({ keyword, limit });
  res.json({
    success: true,
    data: { keyword, count: articles.length, articles },
  });
}

/**
 * GET /api/news/digest?keyword=AI
 * 수집된 기사들을 AI로 요약·주제별 정리해 돌려준다.
 */
export async function getDigest(req, res) {
  const { keyword } = parseQuery(req);
  const articles = await fetchNews({ keyword, limit: config.digestMaxArticles });
  const digest = await createDigest(articles, keyword);

  // 프론트에서 주제별로 원문 링크를 보여줄 수 있도록 기사 번호를 실제 기사로 풀어준다.
  const topics = digest.topics.map((t) => ({
    title: t.title,
    summary: t.summary,
    articles: t.articleNumbers.map((n) => {
      const { title, url, source } = articles[n - 1];
      return { title, url, source };
    }),
  }));
  res.json({
    success: true,
    data: { keyword, overview: digest.overview, topics, articleCount: digest.articleCount, cached: digest.cached },
  });
}
