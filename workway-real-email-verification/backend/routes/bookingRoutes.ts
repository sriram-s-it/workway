import { Router } from 'express';
import { BookingController } from '../controllers/bookingController.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';

const router = Router();

// Create booking requires authenticated user with verified email
router.post('/', authenticateToken, requireVerifiedEmail, BookingController.createBooking);

// List customer bookings
router.get('/', authenticateToken, BookingController.getCustomerBookings);

// Get single booking details & timeline
router.get('/:id', authenticateToken, BookingController.getBookingDetails);

// Cancel booking (strictly validates 30-min window & prevents cancellation after work starts)
router.post('/:id/cancel', authenticateToken, BookingController.cancelBooking);

// Customer confirms completion
router.post('/:id/confirm-completion', authenticateToken, BookingController.confirmCompletion);

export default router;
