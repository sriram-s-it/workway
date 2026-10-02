import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle, 
  X, 
  Clock, 
  Phone, 
  MapPin, 
  Star, 
  AlertCircle, 
  Play, 
  CheckCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { StatusBadge } from '../../components/StatusBadge';

export const WorkerDashboard: React.FC = () => {
  const { socket } = useSocket();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Decline Modal
  const [decliningAssignment, setDecliningAssignment] = useState<any | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);

  // Countdown timer state
  const [remainingSeconds, setRemainingSeconds] = useState<Record<number, number>>({});

  const fetchWorkerDashboard = async () => {
    try {
      const res = await api.get('/worker/dashboard');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load worker dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkerDashboard();
  }, []);

  // Real-time socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('new_assignment', fetchWorkerDashboard);
    socket.on('notification', fetchWorkerDashboard);

    return () => {
      socket.off('new_assignment', fetchWorkerDashboard);
      socket.off('notification', fetchWorkerDashboard);
    };
  }, [socket]);

  // Live 10-minute countdown for pending assignments
  useEffect(() => {
    if (!data?.pendingAssignments) return;

    const timer = setInterval(() => {
      const updated: Record<number, number> = {};
      data.pendingAssignments.forEach((a: any) => {
        const timeoutMs = new Date(a.timeout_at).getTime();
        const diffSec = Math.max(0, Math.floor((timeoutMs - Date.now()) / 1000));
        updated[a.assignment_id] = diffSec;
      });
      setRemainingSeconds(updated);
    }, 1000);

    return () => clearInterval(timer);
  }, [data?.pendingAssignments]);

  // Format seconds as mm:ss
  const formatTimer = (sec: number | undefined) => {
    if (sec === undefined || sec <= 0) return '00:00 (Expired)';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Accept Assignment
  const handleAccept = async (assignmentId: number) => {
    setError(null);
    try {
      const res = await api.post(`/worker/assignments/${assignmentId}/accept`);
      if (res.data.success) {
        fetchWorkerDashboard();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to accept assignment.');
    }
  };

  // Decline Assignment (requires reason)
  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decliningAssignment || !declineReason.trim()) return;
    setDeclining(true);
    setError(null);

    try {
      const res = await api.post(`/worker/assignments/${decliningAssignment.assignment_id}/decline`, {
        reason: declineReason.trim(),
      });
      if (res.data.success) {
        setDecliningAssignment(null);
        setDeclineReason('');
        fetchWorkerDashboard();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to decline assignment.');
    } finally {
      setDeclining(false);
    }
  };

  // Start Work
  const handleStartWork = async (bookingId: string) => {
    setError(null);
    try {
      const res = await api.post(`/worker/bookings/${bookingId}/start`);
      if (res.data.success) {
        fetchWorkerDashboard();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to start work.');
    }
  };

  // Complete Work
  const handleCompleteWork = async (bookingId: string) => {
    setError(null);
    try {
      const res = await api.post(`/worker/bookings/${bookingId}/complete`);
      if (res.data.success) {
        fetchWorkerDashboard();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete work.');
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-slate-400 text-sm">Loading Worker Portal...</div>;
  }

  const { worker, pendingAssignments = [], activeBooking, paymentUpdates = [] } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-slate-800 px-3 py-1 rounded-full">
              {worker?.department_name} Technician
            </span>
            <StatusBadge status={worker?.availability || 'AVAILABLE'} size="sm" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mt-2">{worker?.full_name}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Respond to dispatches within 10 minutes. Status automatically updates to BUSY upon acceptance.
          </p>
        </div>

        {/* Worker Performance Stats */}
        <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
          <div>
            <div className="text-xs text-slate-400">Rating</div>
            <div className="text-xl font-black text-amber-400 flex items-center gap-1">
              <Star className="w-4 h-4 fill-amber-400" />
              {worker?.rating || '5.00'}
            </div>
          </div>
          <div className="w-px h-8 bg-slate-700"></div>
          <div>
            <div className="text-xs text-slate-400">Completed Jobs</div>
            <div className="text-xl font-black text-white">{worker?.completed_jobs || 0}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Pending Assignments Section (10-minute countdown) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Pending Dispatches</h2>
            <p className="text-xs text-slate-500">
              Mandatory 10-minute acceptance response window.
            </p>
          </div>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
            {pendingAssignments.length} Awaiting Response
          </span>
        </div>

        {pendingAssignments.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No pending assignments waiting for your acceptance.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingAssignments.map((a: any) => {
              const secLeft = remainingSeconds[a.assignment_id];
              const isExpired = secLeft !== undefined && secLeft <= 0;

              return (
                <div
                  key={a.assignment_id}
                  className={`p-6 rounded-2xl border transition-all ${
                    isExpired
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-amber-50/40 border-amber-200 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-600">
                          #{a.booking_number}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          10-Min Window
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-base">{a.service_name_snapshot}</h3>
                    </div>

                    {/* Live countdown timer badge */}
                    <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-amber-300 font-mono text-sm font-black text-amber-900 shadow-xs">
                      <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                      <span>Time Remaining: {formatTimer(secLeft)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 bg-white rounded-xl border border-slate-100 mb-4">
                    <div>
                      <span className="text-slate-400 block">Customer:</span>
                      <span className="font-bold text-slate-800">{a.customer_name} ({a.customer_phone})</span>
                      {a.customer_email && <span className="block text-slate-500 mt-1">{a.customer_email}</span>}
                    </div>
                    <div>
                      <span className="text-slate-400 block">Service Address:</span>
                      <span className="font-bold text-slate-800">{a.service_address}</span>
                    </div>
                    {a.description && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400 block">Notes:</span>
                        <span className="text-slate-700">{a.description}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAccept(a.assignment_id)}
                      disabled={isExpired}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Accept Assignment (Status → BUSY)
                    </button>
                    <button
                      onClick={() => setDecliningAssignment(a)}
                      disabled={isExpired}
                      className="px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Decline with Reason
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Read-only payment status for completed jobs */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Customer Payment Status</h2>
            <p className="text-xs text-slate-500">Payment is completed by the customer. Workers can view the status but cannot collect or change payment.</p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">{paymentUpdates.length} Update{paymentUpdates.length === 1 ? '' : 's'}</span>
        </div>

        {paymentUpdates.length === 0 ? (
          <div className="py-5 text-center text-slate-400 text-xs">No completed jobs are waiting for customer payment.</div>
        ) : (
          <div className="space-y-3">
            {paymentUpdates.map((payment: any) => (
              <div key={payment.id} className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-500">#{payment.booking_number}</div>
                  <div className="font-bold text-slate-900 text-sm mt-1">{payment.service_name_snapshot}</div>
                  <div className="text-xs text-slate-500 mt-1">Amount: ₹{payment.amount}</div>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-black ${payment.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {payment.payment_status === 'PAID' ? 'Payment Paid Successfully' : 'Payment Pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Service Job (In Progress) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Active Ongoing Service</h2>
            <p className="text-xs text-slate-500">
              Update status from ASSIGNED → WORK_STARTED → WORK_COMPLETED.
            </p>
          </div>
        </div>

        {!activeBooking ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No active job currently assigned or in progress.
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-slate-400">#{activeBooking.booking_number}</span>
                <h3 className="font-black text-slate-900 text-xl">{activeBooking.service_name_snapshot}</h3>
              </div>
              <StatusBadge status={activeBooking.status} size="lg" />
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-100 space-y-2 text-xs">
              <div><strong>Customer:</strong> {activeBooking.customer_name} ({activeBooking.customer_phone})</div>
              <div><strong>Customer Service Location:</strong> {activeBooking.service_address}</div>
              {activeBooking.customer_email && <div><strong>Customer Email:</strong> {activeBooking.customer_email}</div>}
              {activeBooking.description && <div><strong>Description:</strong> {activeBooking.description}</div>}
            </div>

            <div className="pt-2 flex items-center gap-3">
              {activeBooking.status === 'ASSIGNED' && (
                <button
                  onClick={() => handleStartWork(activeBooking.id)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  START WORK (Customer will be notified)
                </button>
              )}

              {activeBooking.status === 'WORK_STARTED' && (
                <button
                  onClick={() => handleCompleteWork(activeBooking.id)}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                  COMPLETE WORK (Customer confirmation required)
                </button>
              )}

              <Link
                to={`/user/bookings/${activeBooking.id}`}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                View Full Timeline <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Decline Assignment Modal */}
      {decliningAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-lg">Decline Assignment</h3>
              <button onClick={() => setDecliningAssignment(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
              <ShieldAlert className="w-4 h-4 text-rose-600 inline mr-1" />
              <strong>Mandatory Reason Required:</strong> Department Head and Admin will review the reason for record-keeping. Empty decline reasons are rejected.
            </div>

            <form onSubmit={handleDecline} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Declining *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g., Currently at distant emergency site, equipment calibration, health issue..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDecliningAssignment(null)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={declining || !declineReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {declining ? 'Declining...' : 'Submit Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
