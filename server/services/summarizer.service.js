/**
 * 기사 요약문 생성 서비스.
 * RSS의 description은 HTML이 섞여 있고 제목을 반복하는 경우가 많아 정리 과정이 필요하다.
 */

const MAX_SUMMARY_LENGTH = 160;

const HTML_ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * HTML 태그와 엔티티를 제거하고 공백을 정리한다.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html = '') {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => HTML_ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 기사 원문 설명에서 요약문을 만든다.
 * 제목·출처와 중복되는 내용은 제거하고, 너무 길면 문장 단위로 자른다.
 * @param {string} rawDescription - RSS description 또는 contentSnippet
 * @param {string} title - 기사 제목 (중복 제거용)
 * @param {string} source - 언론사 (중복 제거용)
 * @returns {string} 요약문 (제공할 내용이 없으면 빈 문자열)
 */
export function summarize(rawDescription, title, source) {
  let text = stripHtml(rawDescription);

  // 구글 뉴스처럼 "제목 + 언론사"만 반복하는 설명은 요약으로서 가치가 없으므로 걷어낸다.
  const fullTitle = source ? `${title} - ${source}` : title;
  for (const dup of [fullTitle, title, source]) {
    if (dup) text = text.split(dup).join(' ');
  }
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length < 15) return '';
  if (text.length <= MAX_SUMMARY_LENGTH) return text;

  // 문장 경계(마침표 등)에서 자르고, 없으면 글자 수로 자른다.
  const cut = text.slice(0, MAX_SUMMARY_LENGTH);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다.'));
  return (lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.trimEnd()) + (lastStop > 60 ? '' : '…');
}
