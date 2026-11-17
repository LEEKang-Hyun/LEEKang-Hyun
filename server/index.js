/**
 * 서버 진입점: 서버 기동과 프로세스 레벨 오류 처리만 담당한다.
 */
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

const server = createApp().listen(config.port, () => {
  logger.info(`news-curator 서버 시작: http://localhost:${config.port}`);
});

// 처리되지 않은 오류는 기록 후 안전하게 종료한다.
function shutdown(reason, err) {
  logger.error(`${reason}로 서버를 종료합니다.`, err);
  server.close(() => process.exit(1));
}
process.on('unhandledRejection', (err) => shutdown('unhandledRejection', err));
process.on('uncaughtException', (err) => shutdown('uncaughtException', err));
