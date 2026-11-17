/**
 * 예상 가능한 오류를 표현하는 커스텀 에러.
 * 중앙 에러 핸들러가 statusCode/code를 읽어 일관된 JSON으로 응답한다.
 */
export class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP 상태 코드
   * @param {string} code - 클라이언트가 구분할 수 있는 오류 코드
   * @param {string} message - 사용자에게 보여줄 한국어 메시지
   */
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
