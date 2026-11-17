/**
 * 프론트엔드 진입점: 초기화와 이벤트 바인딩
 */
import { fetchDigest, fetchNews } from './api.js';
import { state } from './state.js';
import { renderArticles, renderDigest, renderTags, setDigestState, setStatus, showError, showView } from './ui/render.js';

/** 빠르게 눌러볼 수 있는 추천 키워드 */
const SUGGESTED_TAGS = ['AI', '보안', '경제', '반도체', '클라우드', '해킹', '스타트업', '정치'];

const form = document.getElementById('search-form');
const input = document.getElementById('keyword-input');

/** 현재 키워드로 뉴스를 불러와 화면을 갱신한다. */
async function loadNews() {
  const { keyword } = state;
  showView('loading');
  setStatus('');
  setDigestState('closed'); // 키워드가 바뀌면 이전 브리핑은 닫는다
  renderTags(buildTags(keyword), keyword, selectKeyword);

  try {
    const data = await fetchNews(keyword);
    renderArticles(data.articles);
    setStatus(keyword ? `'${keyword}' 관련 기사 ${data.count}건` : `최신 기사 ${data.count}건`);
  } catch (err) {
    showError(err.message);
    setStatus('');
  }
}

/** 직접 입력한 키워드도 태그 목록에 보이도록 합친다. */
function buildTags(keyword) {
  return keyword && !SUGGESTED_TAGS.includes(keyword) ? [keyword, ...SUGGESTED_TAGS] : SUGGESTED_TAGS;
}

function selectKeyword(keyword) {
  state.keyword = keyword.trim();
  input.value = state.keyword;
  loadNews();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  selectKeyword(input.value);
});
document.getElementById('retry-btn').addEventListener('click', loadNews);

/* AI 요약: 비용이 드는 작업이라 버튼을 눌렀을 때만 실행한다. 중복 클릭은 막는다. */
const digestBtn = document.getElementById('digest-btn');
digestBtn.addEventListener('click', async () => {
  digestBtn.disabled = true;
  setDigestState('loading');
  try {
    renderDigest(await fetchDigest(state.keyword));
  } catch (err) {
    setDigestState('error', err.message);
  } finally {
    digestBtn.disabled = false;
  }
});
document.getElementById('digest-close').addEventListener('click', () => setDigestState('closed'));

/* 테마 전환: 선택값을 localStorage에 저장 (접근 불가 환경에서도 앱이 동작하도록 예외 무시) */
const root = document.documentElement;
try {
  const saved = localStorage.getItem('theme');
  if (saved) root.dataset.theme = saved;
} catch { /* 저장소 접근 불가 시 OS 설정을 따른다 */ }

document.getElementById('theme-toggle').addEventListener('click', () => {
  const isDark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = isDark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch { /* 무시 */ }
});

loadNews();
