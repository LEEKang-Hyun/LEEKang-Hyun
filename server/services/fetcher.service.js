/**
 * 뉴스 수집 서비스 (네이버 검색 API 또는 RSS).
 * 여러 소스를 병렬로 가져와 내부 공통 포맷(Article)으로 변환하고,
 * 중복 제거·키워드 필터링·최신순 정렬까지 수행한다.
 * req/res를 알지 못하며 순수하게 데이터만 다룬다.
 */
import Parser from 'rss-parser';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { summarize } from './summarizer.service.js';
import { fetchNaverNews } from './naver.service.js';

/**
 * @typedef {Object} Article
 * @property {string} title       - 기사 제목
 * @property {string} summary     - 요약문
 * @property {string} url         - 원문 링크
 * @property {string} source      - 언론사
 * @property {string} category    - 수집 분류(시사/IT/경제/보안/검색)
 * @property {string} publishedAt - 발행 시각(ISO 8601)
 */

const parser = new Parser({
  timeout: config.feedTimeoutMs,
  headers: { 'User-Agent': 'news-curator/0.1 (+RSS reader)' },
});

/** 피드 URL별 결과 캐시: url -> { expires, articles } */
const cache = new Map();

/**
 * 구글 뉴스 제목("기사 제목 - 언론사")에서 제목과 언론사를 분리한다.
 * @param {string} rawTitle
 * @param {string} [fallbackSource]
 * @returns {{title: string, source: string}}
 */
function splitTitleAndSource(rawTitle = '', fallbackSource = '') {
  const idx = rawTitle.lastIndexOf(' - ');
  if (idx > 0) {
    return { title: rawTitle.slice(0, idx).trim(), source: rawTitle.slice(idx + 3).trim() };
  }
  return { title: rawTitle.trim(), source: fallbackSource };
}

/**
 * RSS item 하나를 Article로 변환한다.
 * @returns {Article|null} 필수 값(제목/링크)이 없으면 null
 */
function toArticle(item, feed) {  // feed: RSS 소스 설정
  if (!item.title || !item.link) return null;
  const { title, source } = splitTitleAndSource(item.title, feed.name);
  const date = new Date(item.isoDate || item.pubDate || Date.now());

  return {
    title,
    summary: summarize(item.content || item.contentSnippet || item.description, title, source),
    url: item.link,
    source,
    category: feed.category,
    publishedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
  };
}

/** 소스별 캐시 키 */
const sourceKey = (src) => `${src.type}:${src.url ?? src.query}`;

/** 소스 종류(rss/naver)에 맞는 방법으로 기사를 가져온다. */
async function loadSource(src) {
  if (src.type === 'naver') return fetchNaverNews(src);
  const parsed = await parser.parseURL(src.url);
  return parsed.items.map((item) => toArticle(item, src)).filter(Boolean);
}

/**
 * 소스 하나를 가져온다. 실패해도 다른 소스에 영향이 없도록 오류는 던지지 않고 null을 반환한다.
 * @returns {Promise<Article[]|null>}
 */
async function fetchSource(src) {
  const key = sourceKey(src);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.articles;

  try {
    const articles = await loadSource(src);
    cache.set(key, { expires: Date.now() + config.cacheTtlMs, articles });
    return articles;
  } catch (err) {
    logger.warn(`수집 실패 [${src.name}] ${err.message}`);
    // 만료됐더라도 이전 캐시가 있으면 그것이라도 보여준다.
    return hit ? hit.articles : null;
  }
}

/**
 * 기사가 키워드를 포함하는지 확인한다. (대소문자 무시, 제목+요약+출처 대상)
 */
function matchesKeyword(article, keyword) {
  const needle = keyword.toLowerCase();
  return `${article.title} ${article.summary} ${article.source}`.toLowerCase().includes(needle);
}

/**
 * 최신 뉴스를 수집한다.
 * 키워드가 있으면 기본 피드를 키워드로 필터링하고, 추가로 해당 키워드의 검색 피드도 가져와 합친다.
 * @param {Object} options
 * @param {string} [options.keyword] - 검색/필터링할 키워드
 * @param {number} [options.limit] - 최대 기사 수
 * @returns {Promise<Article[]>} 최신순으로 정렬된 기사 목록
 * @throws {AppError} 모든 피드 수집에 실패한 경우(502)
 */
export async function fetchNews({ keyword = '', limit = config.defaultLimit } = {}) {
  const sources = [...config.sources];
  if (keyword) sources.push(config.searchSource(keyword));

  const results = await Promise.all(sources.map(fetchSource));
  if (results.every((r) => r === null)) {
    throw new AppError(502, 'FEED_UNAVAILABLE', '뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  const seen = new Set();
  const merged = [];

  sources.forEach((src, i) => {
    for (const article of results[i] || []) {
      if (seen.has(article.url)) continue;
      // 검색 소스 결과는 이미 키워드 기반이므로 필터링하지 않는다.
      if (keyword && !src.isSearch && !matchesKeyword(article, keyword)) continue;
      seen.add(article.url);
      merged.push(article);
    }
  });

  return merged
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
}
