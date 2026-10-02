import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Clock, 
  ShieldCheck, 
  User, 
  Star, 
  AlertCircle, 
  CheckCircle2, 
  Ban, 
  CreditCard,
  X
} from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { Booking } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Timeline } from '../../components/Timeline';

export const BookingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { socket, joinBookingRoom, leaveBookingRoom } = useSocket();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  const fetchDetails = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/bookings/${id}`);
      if (res.data.success) {
        setBooking(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    if (id) {
      joinBookingRoom(id);
    }
    return () => {
      if (id) leaveBookingRoom(id);
    };
  }, [id]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket || !id) return;

    const handleBookingUpdate = (data: any) => {
      if (data.bookingId === id || data.id === id) {
        fetchDetails();
      }
    };

    socket.on(`booking_update:${id}`, handleBookingUpdate);
    socket.on('notification', fetchDetails);

    return () => {
      socket.off(`booking_update:${id}`, handleBookingUpdate);
      socket.off('notification', fetchDetails);
    };
  }, [socket, id]);

  // Calculate minutes since assignment for 30-min cancellation window
  const getMinutesSinceAssignment = () => {
    if (!booking?.assigned_at) return 0;
    const assignedTime = new Date(booking.assigned_at).getTime();
    return Math.floor((Date.now() - assignedTime) / (60 * 1000));
  };

  const minutesPassed = getMinutesSinceAssignment();
  const isPost30MinFee = booking?.assigned_at ? minutesPassed > 30 : false;
  const canCancel = booking && !['WORK_STARTED', 'WORK_COMPLETED', 'CUSTOMER_CONFIRMED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED', 'CANCELLED', 'CANCELLED_WITH_FEE', 'REJECTED'].includes(booking.status);

  // Handle Cancel
  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    setError(null);

    try {
      const res = await api.post(`/bookings/${id}/cancel`, {
        reason: cancelReason.trim(),
      });
      if (res.data.success) {
        setShowCancelModal(false);
        fetchDetails();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  // Handle Confirm Completion
  const handleConfirmCompletion = async () => {
    setError(null);
    try {
      const res = await api.post(`/bookings/${id}/confirm-completion`);
      if (res.data.success) {
        fetchDetails();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Confirmation failed.');
    }
  };

  // Handle Cashfree Payment
  const handleInitiatePayment = async () => {
    if (!booking) return;
    setPaymentProcessing(true);
    setError(null);

    try {
      const res = await api.post('/payments/create', {
        booking_id: booking.id,
        payment_type: 'SERVICE_CHARGE',
      });

      if (res.data.success) {
        const { orderId, paymentUrl } = res.data.data;

        // Verify or simulate Cashfree checkout redirect
        if (paymentUrl && !paymentUrl.includes('simulated')) {
          window.location.href = paymentUrl;
        } else {
          // Verify directly
          const verifyRes = await api.get(`/payments/verify/${orderId}`);
          if (verifyRes.data.success) {
            setPaymentSuccessMsg('Payment verified successfully via Cashfree!');
            fetchDetails();
          }
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Payment initiation failed.');
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Handle Feedback
  const handleSubmitFeedback = async () => {
    if (!booking) return;
    setSubmittingFeedback(true);
    try {
      const res = await api.post('/feedback', {
        booking_id: booking.id,
        rating: feedbackRating,
        comment: feedbackComment.trim(),
      });
      if (res.data.success) {
        setShowFeedbackModal(false);
        fetchDetails();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-slate-400 text-sm">Loading booking details...</div>;
  }

  if (!booking) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="text-xl font-bold text-slate-800">Booking not found</h2>
        <Link to="/user/bookings" className="text-blue-600 text-sm mt-3 inline-block font-semibold">
          Return to My Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Back button & Header */}
      <div>
        <Link to="/user/bookings" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Bookings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {booking.service_name_snapshot}
              </h1>
              <StatusBadge status={booking.status} size="lg" />
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="font-mono font-bold text-slate-700">#{booking.booking_number}</span>
              <span>&bull;</span>
              <span>{booking.department_name}</span>
              <span>&bull;</span>
              <span>Booked {new Date(booking.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* Action: Cancel Button (if permitted) */}
          {canCancel && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Ban className="w-3.5 h-3.5" />
              Cancel Booking
            </button>
          )}
        </div>
      </div>

      {paymentSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{paymentSuccessMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Booking Info & Dynamic Actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Action Card: Confirm Completion */}
          {booking.status === 'WORK_COMPLETED' && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 text-emerald-950 space-y-3">
              <div className="flex items-center gap-2 font-black text-base text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                Service Completed on Site!
              </div>
              <p className="text-xs leading-relaxed text-emerald-800">
                The technician has finished the work. Please inspect the service, verify quality, and click below to confirm and unlock final payment.
              </p>
              <button
                onClick={handleConfirmCompletion}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md transition-colors cursor-pointer"
              >
                Confirm Service Completion
              </button>
            </div>
          )}

          {/* Payment Status: Pending */}
          {booking.status === 'PAYMENT_PENDING' && (
            <div className="bg-orange-50 border-2 border-orange-300 rounded-3xl p-6 text-orange-950 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-base text-orange-900">
                  <CreditCard className="w-6 h-6 text-orange-600" />
                  Payment Pending
                </div>
                <span className="text-2xl font-black text-orange-950">₹{booking.service_price}</span>
              </div>
              <p className="text-xs leading-relaxed text-orange-800">
                Your service is complete. Payment is pending until the customer completes Cashfree checkout.
              </p>
              <button
                onClick={handleInitiatePayment}
                disabled={paymentProcessing}
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CreditCard className="w-4 h-4" />
                {paymentProcessing ? 'Processing Cashfree Gateway...' : `Pay ₹${booking.service_price} with Cashfree UPI`}
              </button>
            </div>
          )}

          {/* Payment Status: Success */}
          {booking.status === 'COMPLETED' && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 text-emerald-950 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
                <div>
                  <div className="font-black text-base text-emerald-900">Payment Paid Successfully</div>
                  <p className="text-xs text-emerald-800 mt-1">The customer payment has been verified.</p>
                </div>
              </div>
              <span className="text-xl font-black text-emerald-950">₹{booking.service_price}</span>
            </div>
          )}

          {/* Action Card: Feedback if Completed */}
          {booking.status === 'COMPLETED' && !booking.feedback && (
            <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-900 text-sm">How was your technician's service?</div>
                <div className="flex text-amber-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Leave a verified review to help our Department Heads maintain top technician performance standards.
              </p>
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
              >
                Submit Feedback
              </button>
            </div>
          )}

          {/* Assigned Worker Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4">
              Assigned Service Worker
            </h3>

            {booking.worker_name ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                  {booking.worker_photo ? (
                    <img src={booking.worker_photo} alt={booking.worker_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    {booking.worker_name}
                    <span className="inline-flex items-center text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-amber-400 mr-1" />
                      {booking.worker_rating || '5.00'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {booking.worker_phone || 'Contact provided upon arrival'}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified by {booking.department_name} Department Head
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <p className="text-xs text-slate-600 font-medium">
                  {booking.status === 'PENDING_HEAD_APPROVAL'
                    ? 'Awaiting Department Head approval and technician assignment.'
                    : 'Technician assignment in progress.'}
                </p>
              </div>
            )}
          </div>

          {/* Service Details Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Service Order Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Service Task</span>
                <span className="font-bold text-slate-900">{booking.service_name_snapshot}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Department</span>
                <span className="font-semibold text-slate-800">{booking.department_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Fixed Cost</span>
                <span className="font-black text-slate-900 text-sm">₹{booking.service_price}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Customer Phone</span>
                <span className="font-semibold text-slate-800">{booking.customer_phone}</span>
              </div>
              <div className="py-2 border-b border-slate-100">
                <span className="text-slate-500 block mb-1">Service Address</span>
                <span className="font-medium text-slate-800 leading-relaxed block">
                  {booking.service_address}
                </span>
              </div>
              {booking.description && (
                <div className="py-2 border-b border-slate-100">
                  <span className="text-slate-500 block mb-1">Customer Description</span>
                  <p className="text-slate-700 leading-relaxed">{booking.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline & Policy Overview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <span>Audit Timeline</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </h3>
            <Timeline events={booking.timeline || []} />
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">Cancel Service Booking</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {isPost30MinFee ? (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <strong className="block text-amber-800 font-bold">₹100 Cancellation Fee Notice</strong>
                More than 30 minutes have elapsed since technician assignment. Under WORKWAY platform policy, a ₹100 dispatch compensation fee applies.
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                Cancellation within 30 minutes of assignment is <strong>100% Free</strong>.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mandatory Cancellation Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Please state why you are cancelling..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancelBooking}
                disabled={cancelling || !cancelReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : isPost30MinFee ? 'Cancel & Pay ₹100 Fee' : 'Confirm Free Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">Rate Your Service</h3>
              <button onClick={() => setShowFeedbackModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Star Rating (1 to 5)
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50 cursor-pointer"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= feedbackRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Review Comments (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Quality of repair, punctuality, professional demeanor..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmitFeedback}
              disabled={submittingFeedback}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
            >
              {submittingFeedback ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
