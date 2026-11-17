/**
 * DOM 렌더링 함수 모음.
 * 외부 데이터는 textContent로만 삽입해 XSS를 방지한다.
 */
import { timeAgo } from '../utils/time.js';

const $ = (id) => document.getElementById(id);

/** 로딩/빈/오류/목록 중 하나만 보이도록 전환한다. */
export function showView(view) {
  $('loading').hidden = view !== 'loading';
  $('empty').hidden = view !== 'empty';
  $('error').hidden = view !== 'error';
  $('news-list').hidden = view !== 'list';
}

export function showError(message) {
  $('error-message').textContent = message;
  showView('error');
}

export function setStatus(text) {
  $('status-line').textContent = text;
}

/** 요소 생성 헬퍼 */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 기사 한 건을 카드 요소로 만든다. */
function createCard(article) {
  const card = el('article', 'news-card');

  const meta = el('div', 'news-card__meta');
  meta.append(
    el('span', 'news-card__category', article.category),
    el('span', 'news-card__source', article.source),
  );
  const time = el('time', '', timeAgo(article.publishedAt));
  time.dateTime = article.publishedAt;
  time.title = new Date(article.publishedAt).toLocaleString('ko-KR');
  meta.append(time);

  const title = el('h2', 'news-card__title', article.title);
  card.append(meta, title);

  if (article.summary) card.append(el('p', 'news-card__summary', article.summary));

  const link = el('a', 'news-card__link', '원문 보기 →');
  link.href = article.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  card.append(link);

  return card;
}

/** 기사 목록을 그린다. */
export function renderArticles(articles) {
  const list = $('news-list');
  list.replaceChildren(...articles.map(createCard));
  showView(articles.length ? 'list' : 'empty');
}

/**
 * 키워드 태그 버튼을 그린다.
 * @param {string[]} tags - 태그 목록
 * @param {string} active - 현재 선택된 키워드
 * @param {(keyword: string) => void} onClick - 태그 클릭 콜백
 */
export function renderTags(tags, active, onClick) {
  const nav = $('tag-list');
  const buttons = tags.map((tag) => {
    const btn = el('button', 'tag' + (tag === active ? ' tag--active' : ''), `#${tag}`);
    btn.type = 'button';
    btn.addEventListener('click', () => onClick(tag === active ? '' : tag)); // 다시 누르면 해제
    return btn;
  });
  nav.replaceChildren(...buttons);
}

/* ---------- AI 다이제스트 패널 ---------- */

/** 패널 상태 전환: 'loading' | 'error' | 'done' | 'closed' */
export function setDigestState(view, message = '') {
  $('digest').hidden = view === 'closed';
  $('digest-loading').hidden = view !== 'loading';
  $('digest-error').hidden = view !== 'error';
  $('digest-body').hidden = view !== 'done';
  if (view === 'error') $('digest-error').textContent = message;
}

/** 다이제스트(전체 개요 + 주제별 정리)를 그린다. */
export function renderDigest(digest) {
  $('digest-overview').textContent = digest.overview;

  const topics = digest.topics.map((topic) => {
    const box = el('div', 'digest-topic');
    box.append(el('h3', 'digest-topic__title', topic.title), el('p', 'digest-topic__summary', topic.summary));

    const list = el('ul', 'digest-topic__links');
    for (const a of topic.articles) {
      const li = document.createElement('li');
      const link = el('a', '', `${a.title} (${a.source})`);
      link.href = a.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.append(link);
      list.append(li);
    }
    box.append(list);
    return box;
  });
  $('digest-topics').replaceChildren(...topics);
  $('digest-meta').textContent = `기사 ${digest.articleCount}건 기준 · AI가 만든 요약이라 부정확할 수 있어요. 중요한 내용은 원문을 확인하세요.`;
  setDigestState('done');
}
