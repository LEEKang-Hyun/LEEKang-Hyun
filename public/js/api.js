/**
 * 서버 통신 전담 모듈. 모든 fetch는 이 파일을 거친다.
 */

/**
 * 뉴스 목록을 서버에서 가져온다.
 * @param {string} [keyword] - 검색 키워드
 * @returns {Promise<{keyword: string, count: number, articles: Array}>}
 * @throws {Error} 네트워크 오류 또는 서버가 success:false를 반환한 경우(사용자용 한국어 메시지 포함)
 */
export async function fetchNews(keyword = '') {
  return requestApi('/api/news', keyword);
}

/**
 * 현재 키워드의 기사들을 AI로 요약·정리한 브리핑을 가져온다.
 * @param {string} [keyword]
 * @returns {Promise<{overview: string, topics: Array, articleCount: number, cached: boolean}>}
 */
export async function fetchDigest(keyword = '') {
  return requestApi('/api/news/digest', keyword);
}

/** 공통 GET 요청: 표준 응답 형식을 해석하고 실패 시 한국어 메시지의 Error를 던진다. */
async function requestApi(path, keyword) {
  const params = new URLSearchParams();
  if (keyword) params.set('keyword', keyword);

  let res;
  try {
    res = await fetch(`${path}?${params}`);
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.');
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error('서버 응답을 해석하지 못했습니다.');
  }

  if (!res.ok || !body.success) {
    throw new Error(body?.error?.message || '뉴스를 불러오지 못했습니다.');
  }
  return body.data;
}
