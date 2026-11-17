/**
 * 중앙 에러 핸들러.
 * AppError는 그대로 응답하고, 그 외 예상치 못한 오류는 상세 내용을 숨긴 채 500으로 응답한다.
 * (스택 트레이스 등 내부 정보는 서버 로그에만 남긴다)
 */
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isKnown = err instanceof AppError;
  const statusCode = isKnown ? err.statusCode : 500;

  if (isKnown) {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode} ${err.code}: ${err.message}`);
  } else {
    logger.error(`${req.method} ${req.originalUrl} 처리 중 예기치 못한 오류`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: isKnown ? err.code : 'INTERNAL_ERROR',
      message: isKnown ? err.message : '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    },
  });
}
