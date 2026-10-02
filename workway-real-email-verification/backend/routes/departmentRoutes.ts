import { Router } from 'express';
import { DepartmentController } from '../controllers/departmentController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', DepartmentController.listDepartments);
router.get('/:id', DepartmentController.getDepartmentById);
router.post('/', authenticateToken, requireRole('ADMIN'), DepartmentController.createDepartment);
router.put('/:id', authenticateToken, requireRole('ADMIN'), DepartmentController.updateDepartment);
router.post('/:id/assign-head', authenticateToken, requireRole('ADMIN'), DepartmentController.assignHead);
router.delete('/:id', authenticateToken, requireRole('ADMIN'), DepartmentController.deleteDepartment);

export default router;
