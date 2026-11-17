/**
 * 환경변수 로딩과 앱 전역 상수를 한 곳에서 관리한다.
 * 다른 모듈은 process.env를 직접 읽지 않고 이 파일의 config만 사용한다.
 */
import 'dotenv/config';

const GOOGLE_NEWS_QUERY = 'hl=ko&gl=KR&ceid=KR:ko';
const GOOGLE_NEWS_BASE = 'https://news.google.com/rss';

export const config = {
  port: Number(process.env.PORT) || 3000,
  feedTimeoutMs: Number(process.env.FEED_TIMEOUT_MS) || 8000,
  cacheTtlMs: (Number(process.env.CACHE_TTL_SEC) || 300) * 1000,
  defaultLimit: 30,
  maxLimit: 100,
  maxKeywordLength: 50,

  /** 기본 수집 대상 RSS 피드 (구글 뉴스 한국어판) */
  feeds: [
    { name: '주요 뉴스', category: '시사', url: `${GOOGLE_NEWS_BASE}?${GOOGLE_NEWS_QUERY}` },
    { name: '과학/기술', category: 'IT', url: `${GOOGLE_NEWS_BASE}/headlines/section/topic/TECHNOLOGY?${GOOGLE_NEWS_QUERY}` },
    { name: '비즈니스', category: '경제', url: `${GOOGLE_NEWS_BASE}/headlines/section/topic/BUSINESS?${GOOGLE_NEWS_QUERY}` },
    { name: '보안 이슈', category: '보안', url: `${GOOGLE_NEWS_BASE}/search?q=${encodeURIComponent('보안 OR 해킹 OR 사이버')}&${GOOGLE_NEWS_QUERY}` },
  ],

  /** 키워드 검색용 피드 주소를 만드는 템플릿 */
  searchFeedUrl: (keyword) =>
    `${GOOGLE_NEWS_BASE}/search?q=${encodeURIComponent(keyword)}&${GOOGLE_NEWS_QUERY}`,
};
