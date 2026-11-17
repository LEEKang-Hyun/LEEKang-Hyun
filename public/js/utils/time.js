/**
 * 발행 시각을 "방금 전 / 5분 전 / 3시간 전 / 2일 전 / 날짜" 형태로 바꾼다.
 * @param {string} iso - ISO 8601 문자열
 * @returns {string}
 */
export function timeAgo(iso) {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return '방금 전';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}
