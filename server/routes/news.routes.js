/**
 * 뉴스 관련 라우트: 경로와 컨트롤러만 연결한다.
 */
import { Router } from 'express';
import { getNews } from '../controllers/news.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/news', asyncHandler(getNews));

export default router;
