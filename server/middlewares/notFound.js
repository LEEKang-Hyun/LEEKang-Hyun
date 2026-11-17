/**
 * 등록되지 않은 /api 경로를 404 에러로 변환한다.
 */
import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', '요청한 경로를 찾을 수 없습니다.'));
}
