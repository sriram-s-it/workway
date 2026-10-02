import { Router } from 'express';
import { ServiceController } from '../controllers/serviceController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', ServiceController.listServices);
router.get('/:id', ServiceController.getServiceById);
router.post('/', authenticateToken, requireRole('ADMIN'), ServiceController.createService);
router.put('/:id', authenticateToken, requireRole('ADMIN'), ServiceController.updateService);
router.delete('/:id', authenticateToken, requireRole('ADMIN'), ServiceController.deleteService);

export default router;
