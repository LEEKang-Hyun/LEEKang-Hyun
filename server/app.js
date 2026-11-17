/**
 * Express 앱 구성: 미들웨어, 라우터, 정적 파일, 에러 핸들러 등록
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import rateLimit from 'express-rate-limit';
import newsRoutes from './routes/news.routes.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Render 등 프록시 뒤에서 배포될 때 실제 사용자 IP로 요청 제한을 걸기 위해 필요하다.
  app.set('trust proxy', 1);
  app.use(express.json());

  // 공개 배포 대비 요청 제한: 전체 API는 분당 60회, 요약은 분당 8회
  const limitMessage = { success: false, error: { code: 'RATE_LIMITED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' } };
  const limiter = (max) => rateLimit({ windowMs: 60 * 1000, limit: max, standardHeaders: true, legacyHeaders: false, message: limitMessage });
  app.use('/api', limiter(60));
  app.use('/api/news/digest', limiter(8));

  // API 라우트
  app.use('/api', newsRoutes);
  app.use('/api', notFound);

  // 프론트엔드 정적 파일
  // 서비스 워커·매니페스트는 항상 최신본을 확인하도록 캐시를 막는다. (앱 업데이트가 바로 반영되게)
  const noCache = new Set(['service-worker.js', 'manifest.webmanifest']);
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    setHeaders: (res, filePath) => {
      if (noCache.has(path.basename(filePath))) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  app.use(errorHandler);
  return app;
}
