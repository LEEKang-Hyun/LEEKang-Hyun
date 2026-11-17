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

/** 자동 갱신 주기(5분). 서버 캐시(기본 5분)와 맞춰 불필요한 요청을 줄인다. */
const AUTO_REFRESH_MS = 5 * 60 * 1000;

let requestSeq = 0;      // 오래된 응답이 최신 화면을 덮어쓰지 않도록 요청 번호를 매긴다.
let lastUpdatedAt = 0;   // 마지막으로 기사를 성공적으로 불러온 시각(ms)
let hasArticles = false; // 화면에 이미 기사 목록이 있는지

/** 현재 키워드로 뉴스를 불러와 화면을 갱신한다. */
async function loadNews() {
  const { keyword } = state;
  const seq = ++requestSeq;
  showView('loading');
  setStatus('');
  setDigestState('closed'); // 키워드가 바뀌면 이전 브리핑은 닫는다
  renderTags(buildTags(keyword), keyword, selectKeyword);

  try {
    const data = await fetchNews(keyword);
    if (seq !== requestSeq) return;
    renderArticles(data.articles);
    hasArticles = data.articles.length > 0;
    markUpdated(data.count);
  } catch (err) {
    if (seq !== requestSeq) return;
    hasArticles = false;
    showError(err.message);
    setStatus('');
  }
}

/**
 * 화면을 깜빡이지 않고 조용히 새 기사로 갱신한다. (자동 갱신용)
 * 실패해도 기존 목록과 열려 있는 AI 브리핑은 그대로 둔다.
 */
async function refreshQuietly() {
  if (!hasArticles) return loadNews(); // 아직 보이는 목록이 없으면 일반 로딩으로 처리
  const seq = ++requestSeq;
  try {
    const data = await fetchNews(state.keyword);
    if (seq !== requestSeq) return;
    renderArticles(data.articles);
    hasArticles = data.articles.length > 0;
    markUpdated(data.count);
  } catch {
    if (seq === requestSeq) setStatus('자동 갱신에 실패했어요. 다음 주기에 다시 시도합니다.');
  }
}

/** 상태 줄에 건수와 마지막 갱신 시각을 표시한다. */
function markUpdated(count) {
  lastUpdatedAt = Date.now();
  const time = new Date(lastUpdatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const label = state.keyword ? `'${state.keyword}' 관련 기사 ${count}건` : `최신 기사 ${count}건`;
  setStatus(`${label} · ${time} 갱신`);
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

/* 자동 갱신: 켜져 있고 탭이 보일 때만 주기적으로 새 기사를 가져온다. 설정은 기억해 둔다. */
const autoToggle = document.getElementById('auto-refresh');
try {
  autoToggle.checked = localStorage.getItem('autoRefresh') !== 'off';
} catch { /* 저장소 접근 불가 시 기본값(켜짐) */ }

autoToggle.addEventListener('change', () => {
  try { localStorage.setItem('autoRefresh', autoToggle.checked ? 'on' : 'off'); } catch { /* 무시 */ }
  if (autoToggle.checked) refreshQuietly();
});

setInterval(() => {
  if (autoToggle.checked && !document.hidden) refreshQuietly();
}, AUTO_REFRESH_MS);

// 다른 탭에 있다가 돌아왔을 때 오래된 화면이면 바로 갱신한다.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && autoToggle.checked && Date.now() - lastUpdatedAt > AUTO_REFRESH_MS) refreshQuietly();
});

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
