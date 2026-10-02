import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Create payment session (order) with Cashfree
router.post('/create', authenticateToken, PaymentController.createPaymentSession);

// Cashfree webhook receiver (unauthenticated, signature-verified)
router.post('/webhook', PaymentController.handleWebhook);

// Verify payment status
router.get('/verify/:order_id', authenticateToken, PaymentController.verifyPayment);

export default router;
