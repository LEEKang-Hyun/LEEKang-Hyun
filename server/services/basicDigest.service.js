/**
 * 규칙 기반 요약 서비스 (API 키·비용 없이 동작).
 * 제목에서 자주 나오는 단어를 찾아 비슷한 기사를 주제별로 묶고, 전체 개요 문장을 만든다.
 * 문장형 요약은 아니지만 "오늘 뭐가 이슈인지" 한눈에 보이도록 정리하는 것이 목표다.
 */

const MAX_TOPICS = 6;
const MIN_GROUP_SIZE = 2;

/** 주제어로 쓰기엔 의미가 약한 단어들 */
const STOPWORDS = new Set([
  '관련', '이번', '오늘', '내일', '올해', '지난', '최근', '통해', '위해', '대한', '대해', '이후', '이상', '이하',
  '있다', '했다', '한다', '된다', '있는', '하는', '됐다', '밝혔다', '발표', '공개', '출시', '전망', '논란',
  '속보', '단독', '종합', '포토', '영상', '기자', '뉴스', '명', '억', '만', '개', '원', '등',
]);

/** 단어 끝의 흔한 조사를 떼어 같은 단어끼리 묶이게 한다. (길이 3 이상일 때만) */
const PARTICLE = /(으로|에서|에게|까지|부터|은|는|이|가|을|를|의|에|도|로|과|와)$/;

/**
 * 제목을 주제어 후보 단어 목록으로 쪼갠다.
 * @param {string} title
 * @returns {string[]} 중복 제거된 단어들
 */
export function tokenize(title) {
  const words = title
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/)
    .map((w) => (w.length >= 3 ? w.replace(PARTICLE, '') : w))
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !STOPWORDS.has(w));
  return [...new Set(words)];
}

/**
 * 기사 목록을 규칙 기반으로 요약·정리한다.
 * @param {import('./fetcher.service.js').Article[]} articles - 최신순 기사 목록
 * @param {string} [keyword] - 현재 관심 키워드 (주제어에서는 제외)
 * @returns {{overview: string, topics: {title: string, summary: string, articleNumbers: number[]}[]}}
 */
export function createBasicDigest(articles, keyword = '') {
  const skip = new Set(tokenize(keyword));

  // 1) 단어별로 어떤 기사(번호)에 등장하는지 모은다.
  const wordToArticles = new Map();
  articles.forEach((article, i) => {
    for (const word of tokenize(article.title)) {
      if (skip.has(word)) continue;
      if (!wordToArticles.has(word)) wordToArticles.set(word, []);
      wordToArticles.get(word).push(i + 1);
    }
  });

  // 2) 여러 기사에 나오는 단어를 많이 나온 순으로 정렬한다.
  const ranked = [...wordToArticles.entries()]
    .filter(([, nums]) => nums.length >= MIN_GROUP_SIZE)
    .sort((a, b) => b[1].length - a[1].length || b[0].length - a[0].length);

  // 3) 각 기사는 가장 큰 주제 하나에만 넣는다.
  const used = new Set();
  const topics = [];
  for (const [word, nums] of ranked) {
    const fresh = nums.filter((n) => !used.has(n));
    if (fresh.length < MIN_GROUP_SIZE) continue;
    fresh.forEach((n) => used.add(n));
    const lead = articles[fresh[0] - 1]; // 목록이 최신순이므로 첫 기사가 가장 최근 기사
    topics.push({
      title: `#${word} (${fresh.length}건)`,
      summary: `최근 보도: ${lead.title} — ${lead.source}`,
      articleNumbers: fresh.slice(0, 5),
    });
    if (topics.length >= MAX_TOPICS) break;
  }

  // 4) 묶이지 않은 기사는 분류(시사/IT/경제/보안)별 대표 헤드라인으로 정리한다.
  const byCategory = new Map();
  articles.forEach((a, i) => {
    if (used.has(i + 1)) return;
    if (!byCategory.has(a.category)) byCategory.set(a.category, []);
    byCategory.get(a.category).push(i + 1);
  });
  for (const [category, nums] of byCategory) {
    if (topics.length >= MAX_TOPICS + 2) break;
    topics.push({
      title: `${category} 주요 헤드라인`,
      summary: `최근 보도: ${articles[nums[0] - 1].title}`,
      articleNumbers: nums.slice(0, 3),
    });
  }

  // 5) 전체 개요 문장
  const hot = ranked.slice(0, 4).map(([word, nums]) => `${word}(${nums.length}건)`);
  const sources = new Set(articles.map((a) => a.source)).size;
  const head = keyword ? `'${keyword}' 관련 기사 ${articles.length}건` : `최신 기사 ${articles.length}건`;
  const overview =
    `${head}을 ${sources}개 언론사에서 모았습니다.` +
    (hot.length ? ` 가장 자주 언급된 단어는 ${hot.join(', ')}입니다.` : '') +
    ` 가장 최근 기사는 "${articles[0].title}"입니다.`;

  return { overview, topics };
}
