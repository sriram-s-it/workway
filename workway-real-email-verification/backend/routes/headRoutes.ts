import { Router } from 'express';
import { HeadController } from '../controllers/headController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireRole('DEPARTMENT_HEAD', 'ADMIN'));

router.get('/dashboard', HeadController.getDashboard);
router.post('/bookings/:booking_id/approve', HeadController.approveAndAssign);
router.post('/bookings/:booking_id/reject', HeadController.rejectBooking);
router.get('/workers', HeadController.listWorkers);
router.post('/workers', HeadController.createWorker);
router.get('/assignments/history', HeadController.getAssignmentHistory);

export default router;
