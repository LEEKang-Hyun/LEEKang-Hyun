/**
 * 레벨별 간단한 로거. console 직접 호출 대신 이 모듈을 사용한다.
 */
const stamp = () => new Date().toISOString();

export const logger = {
  info: (msg, ...args) => console.log(`[${stamp()}] [INFO] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[${stamp()}] [WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[${stamp()}] [ERROR] ${msg}`, ...args),
};
