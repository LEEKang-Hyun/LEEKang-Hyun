/**
 * 네이버 검색 API(뉴스) 수집 서비스.
 * 질의어로 최신 기사를 가져와 내부 공통 포맷(Article)으로 변환한다.
 * 링크는 가능하면 네이버 뉴스(n.news.naver.com) 주소를 사용해 접속이 안정적이다.
 */
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';
import { stripHtml, summarize } from './summarizer.service.js';

/** 자주 보이는 언론사 도메인 → 이름 (네이버 API는 언론사명을 주지 않아 도메인으로 추정한다) */
const PUBLISHERS = {
  'yna.co.kr': '연합뉴스', 'yonhapnews.co.kr': '연합뉴스', 'chosun.com': '조선일보', 'donga.com': '동아일보',
  'joongang.co.kr': '중앙일보', 'hani.co.kr': '한겨레', 'khan.co.kr': '경향신문', 'hankookilbo.com': '한국일보',
  'mk.co.kr': '매일경제', 'hankyung.com': '한국경제', 'sedaily.com': '서울경제', 'edaily.co.kr': '이데일리',
  'mt.co.kr': '머니투데이', 'fnnews.com': '파이낸셜뉴스', 'asiae.co.kr': '아시아경제', 'heraldcorp.com': '헤럴드경제',
  'kbs.co.kr': 'KBS', 'imbc.com': 'MBC', 'sbs.co.kr': 'SBS', 'ytn.co.kr': 'YTN', 'jtbc.co.kr': 'JTBC',
  'news1.kr': '뉴스1', 'newsis.com': '뉴시스', 'zdnet.co.kr': 'ZDNet Korea', 'etnews.com': '전자신문',
  'boannews.com': '보안뉴스', 'dt.co.kr': '디지털타임스', 'bloter.net': '블로터', 'itworld.co.kr': 'ITWorld',
  'ddaily.co.kr': '디지털데일리', 'inews24.com': '아이뉴스24', 'seoul.co.kr': '서울신문', 'segye.com': '세계일보',
  'munhwa.com': '문화일보', 'nocutnews.co.kr': '노컷뉴스', 'ohmynews.com': '오마이뉴스', 'pressian.com': '프레시안',
};

/** 기사 원문 주소에서 언론사 이름을 추정한다. 모르면 도메인을 그대로 보여준다. */
export function guessPublisher(url = '') {
  try {
    const host = new URL(url).hostname.replace(/^(www|news|m)\./, '');
    const hit = Object.keys(PUBLISHERS).find((d) => host === d || host.endsWith(`.${d}`));
    return hit ? PUBLISHERS[hit] : host;
  } catch {
    return '네이버 뉴스';
  }
}

/**
 * 네이버 뉴스 검색 결과를 가져온다.
 * @param {{query: string, category: string}} source - 질의어와 분류
 * @returns {Promise<import('./fetcher.service.js').Article[]>}
 * @throws {Error} 호출 실패(키 오류, 한도 초과, 네트워크 오류 등)
 */
export async function fetchNaverNews(source) {
  const params = new URLSearchParams({ query: source.query, display: String(config.naverDisplay), sort: 'date' });
  const res = await fetch(`${config.naverApiUrl}?${params}`, {
    headers: { 'X-Naver-Client-Id': config.naverClientId, 'X-Naver-Client-Secret': config.naverClientSecret },
    signal: AbortSignal.timeout(config.feedTimeoutMs),
  });
  if (!res.ok) {
    throw new AppError(502, 'NAVER_API_ERROR', `네이버 API 오류 (HTTP ${res.status})`);
  }

  const body = await res.json();
  return (body.items || [])
    .map((item) => {
      const title = stripHtml(item.title);
      const url = item.link || item.originallink;
      if (!title || !url) return null;
      const source_ = guessPublisher(item.originallink || item.link);
      const date = new Date(item.pubDate);
      return {
        title,
        summary: summarize(item.description, title, source_),
        url,
        source: source_,
        category: source.category,
        publishedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      };
    })
    .filter(Boolean);
}
