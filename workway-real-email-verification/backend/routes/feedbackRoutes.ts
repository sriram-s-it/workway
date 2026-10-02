import { Router } from 'express';
import { FeedbackController } from '../controllers/feedbackController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticateToken, FeedbackController.submitFeedback);
router.get('/worker/:worker_id', authenticateToken, FeedbackController.getWorkerFeedback);

export default router;
