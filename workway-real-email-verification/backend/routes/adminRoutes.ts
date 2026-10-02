import { Router } from 'express';
import { AdminController } from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken, requireRole('ADMIN'));

router.get('/dashboard', AdminController.getDashboardStats);
router.get('/users', AdminController.listUsers);
router.post('/users/create-head', AdminController.createDepartmentHead);
router.patch('/users/:id/toggle-status', AdminController.toggleUserStatus);
router.delete('/users/:id/delete-customer', AdminController.deleteCustomerAccount);
router.get('/bookings', AdminController.listAllBookings);
router.get('/payments', AdminController.listPayments);
router.get('/audit-logs', AdminController.listAuditLogs);

export default router;
