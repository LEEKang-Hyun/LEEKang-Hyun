/**
 * Express 앱 구성: 미들웨어, 라우터, 정적 파일, 에러 핸들러 등록
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import newsRoutes from './routes/news.routes.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());

  // API 라우트
  app.use('/api', newsRoutes);
  app.use('/api', notFound);

  // 프론트엔드 정적 파일
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(errorHandler);
  return app;
}
