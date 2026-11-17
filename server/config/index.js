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

  /** AI 요약(다이제스트) 설정 */
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  digestMaxArticles: 40,          // 요약에 사용할 최대 기사 수 (토큰·비용 제한)
  digestCacheTtlMs: 10 * 60 * 1000, // 같은 기사 묶음은 10분간 재사용
  digestTimeoutMs: 90 * 1000,
  aiDailyLimit: Number(process.env.AI_DAILY_LIMIT) || 100, // 하루 최대 AI 호출 수

  /** 네이버 검색 API 설정 (https://developers.naver.com 에서 발급, 하루 25,000회 무료) */
  naverClientId: process.env.NAVER_CLIENT_ID || '',
  naverClientSecret: process.env.NAVER_CLIENT_SECRET || '',
  naverApiUrl: 'https://openapi.naver.com/v1/search/news.json',
  naverDisplay: 30, // 질의 한 번에 가져올 기사 수

  /** 네이버 키가 설정되어 있는지 */
  get naverEnabled() {
    return Boolean(this.naverClientId && this.naverClientSecret);
  },

  /**
   * 기본 수집 소스 목록.
   * 네이버 키가 있으면 네이버 뉴스 검색을, 없으면 구글 뉴스 RSS를 사용한다.
   * 소스 형식: { type: 'naver'|'rss', name, category, query|url }
   */
  get sources() {
    if (this.naverEnabled) {
      return [
        { type: 'naver', name: '시사', category: '시사', query: '정치' },
        { type: 'naver', name: 'IT', category: 'IT', query: 'IT' },
        { type: 'naver', name: '경제', category: '경제', query: '경제' },
        { type: 'naver', name: '보안', category: '보안', query: '해킹' },
        { type: 'naver', name: '보안', category: '보안', query: '사이버 보안' },
      ];
    }
    return [
      { type: 'rss', name: '주요 뉴스', category: '시사', url: `${GOOGLE_NEWS_BASE}?${GOOGLE_NEWS_QUERY}` },
      { type: 'rss', name: '과학/기술', category: 'IT', url: `${GOOGLE_NEWS_BASE}/headlines/section/topic/TECHNOLOGY?${GOOGLE_NEWS_QUERY}` },
      { type: 'rss', name: '비즈니스', category: '경제', url: `${GOOGLE_NEWS_BASE}/headlines/section/topic/BUSINESS?${GOOGLE_NEWS_QUERY}` },
      { type: 'rss', name: '보안 이슈', category: '보안', url: `${GOOGLE_NEWS_BASE}/search?q=${encodeURIComponent('보안 OR 해킹 OR 사이버')}&${GOOGLE_NEWS_QUERY}` },
    ];
  },

  /** 키워드 검색용 소스를 만든다. */
  searchSource(keyword) {
    const name = `'${keyword}' 검색`;
    if (this.naverEnabled) return { type: 'naver', name, category: '검색', query: keyword, isSearch: true };
    return {
      type: 'rss', name, category: '검색', isSearch: true,
      url: `${GOOGLE_NEWS_BASE}/search?q=${encodeURIComponent(keyword)}&${GOOGLE_NEWS_QUERY}`,
    };
  },
};
