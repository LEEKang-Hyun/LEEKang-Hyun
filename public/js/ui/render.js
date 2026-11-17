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
