import { Router } from 'express';
import { WorkerController } from '../controllers/workerController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireRole('WORKER', 'ADMIN'));

router.get('/dashboard', WorkerController.getWorkerDashboard);
router.post('/assignments/:assignment_id/accept', WorkerController.acceptAssignment);
router.post('/assignments/:assignment_id/decline', WorkerController.declineAssignment);
router.post('/bookings/:booking_id/start', WorkerController.startWork);
router.post('/bookings/:booking_id/complete', WorkerController.completeWork);
router.get('/history', WorkerController.getWorkerHistory);

export default router;
