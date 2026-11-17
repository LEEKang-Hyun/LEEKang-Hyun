/**
 * 비동기 라우트 핸들러의 예외를 Express 에러 핸들러로 넘기는 래퍼.
 * 컨트롤러마다 try/catch를 반복하지 않기 위해 사용한다.
 * @param {Function} fn - async (req, res, next) 핸들러
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
