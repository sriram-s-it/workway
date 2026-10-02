import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  UserPlus, 
  ShieldCheck, 
  X, 
  Star,
  Check,
  Ban,
  ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { StatusBadge } from '../../components/StatusBadge';

export const HeadDashboard: React.FC = () => {
  const { socket } = useSocket();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assign Worker Modal
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Reject Booking Modal
  const [rejectingBooking, setRejectingBooking] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Add Worker Modal
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [workerForm, setWorkerForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    profile_photo: '',
    experience_years: 1,
    bio: '',
  });
  const [creatingWorker, setCreatingWorker] = useState(false);

  const fetchHeadDashboard = async () => {
    try {
      const res = await api.get('/head/dashboard');
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load department dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeadDashboard();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('head_alert', fetchHeadDashboard);
    socket.on('notification', fetchHeadDashboard);
    return () => {
      socket.off('head_alert', fetchHeadDashboard);
      socket.off('notification', fetchHeadDashboard);
    };
  }, [socket]);

  // Handle Approve & Assign
  const handleApproveAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !selectedWorkerId) return;
    setAssigning(true);
    setError(null);

    try {
      const res = await api.post(`/head/bookings/${selectedBooking.id}/approve`, {
        worker_id: Number(selectedWorkerId),
      });
      if (res.data.success) {
        setSelectedBooking(null);
        setSelectedWorkerId('');
        fetchHeadDashboard();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign worker.');
    } finally {
      setAssigning(false);
    }
  };

  // Handle Reject
  const handleRejectBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingBooking || !rejectReason.trim()) return;
    setRejecting(true);

    try {
      const res = await api.post(`/head/bookings/${rejectingBooking.id}/reject`, {
        reason: rejectReason.trim(),
      });
      if (res.data.success) {
        setRejectingBooking(null);
        setRejectReason('');
        fetchHeadDashboard();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject booking.');
    } finally {
      setRejecting(false);
    }
  };

  // Handle Create Worker
  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingWorker(true);
    setError(null);

    try {
      const res = await api.post('/head/workers', workerForm);
      if (res.data.success) {
        setShowAddWorkerModal(false);
        setWorkerForm({
          full_name: '',
          email: '',
          phone: '',
          password: '',
          address: '',
          profile_photo: '',
          experience_years: 1,
          bio: '',
        });
        fetchHeadDashboard();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create worker.');
    } finally {
      setCreatingWorker(false);
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-slate-400 text-sm">Loading Department Head Portal...</div>;
  }

  if (!data?.department) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="text-xl font-bold text-slate-800">No Department Assigned</h2>
        <p className="text-xs text-slate-500 mt-2">
          Your account has role DEPARTMENT_HEAD but has not been assigned a specific department by the Admin yet.
        </p>
      </div>
    );
  }

  const { department, stats, pendingBookings, activeBookings, workers } = data;

  // Available workers list
  const availableWorkers = workers.filter((w: any) => w.availability === 'AVAILABLE');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-slate-800 px-3 py-1 rounded-full">
            Department Head Console
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2">{department.name}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Responsible for reviewing incoming requests, verifying technician dispatches, and maintaining SLA standards.
          </p>
        </div>

        <button
          onClick={() => setShowAddWorkerModal(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md transition-all shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Add New Worker
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Approval</span>
          <div className="text-3xl font-black text-amber-600 mt-2">{stats.pendingCount}</div>
          <span className="text-xs text-slate-500 mt-0.5 block">Requires head action</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available Workers</span>
          <div className="text-3xl font-black text-emerald-600 mt-2">{stats.availableWorkers}</div>
          <span className="text-xs text-slate-500 mt-0.5 block">Ready for dispatch</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Busy Workers</span>
          <div className="text-3xl font-black text-indigo-600 mt-2">{stats.busyWorkers}</div>
          <span className="text-xs text-slate-500 mt-0.5 block">Currently on service jobs</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Jobs</span>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.activeCount}</div>
          <span className="text-xs text-slate-500 mt-0.5 block">In progress</span>
        </div>
      </div>

      {/* Incoming Booking Requests */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Pending Service Requests</h2>
            <p className="text-xs text-slate-500">
              Select an AVAILABLE worker to dispatch. Automated blind selection is disabled.
            </p>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            {pendingBookings.length} Awaiting Head Action
          </span>
        </div>

        {pendingBookings.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No pending booking requests at this moment.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingBookings.map((b: any) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl border border-slate-200 hover:border-blue-400 transition-all bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700">#{b.booking_number}</span>
                    <StatusBadge status={b.status} size="sm" />
                    <span className="text-xs text-slate-400">&bull; {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-base">{b.service_name_snapshot}</h3>
                  <div className="text-xs text-slate-600">
                    Customer: <strong className="text-slate-800">{b.customer_name}</strong> ({b.customer_phone})
                  </div>
                  {b.customer_email && <div className="text-xs text-slate-500">Email: {b.customer_email}</div>}
                  <div className="text-xs text-slate-500 leading-relaxed max-w-xl">
                    Customer Service Location: {b.service_address}
                  </div>
                  {b.description && (
                    <div className="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 max-w-xl">
                      <strong>Customer note:</strong> {b.description}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedBooking(b);
                      setSelectedWorkerId(availableWorkers[0]?.id ? String(availableWorkers[0].id) : '');
                    }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                  >
                    Approve & Select Worker
                  </button>
                  <button
                    onClick={() => setRejectingBooking(b)}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accepted Worker / Active Job Status */}
      <div className="bg-emerald-50/60 rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-emerald-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Accepted & Active Assignments</h2>
            <p className="text-xs text-slate-600">
              When a worker accepts a dispatch, it appears here immediately and is locked to that worker.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
            {activeBookings.length} Active
          </span>
        </div>

        {activeBookings.length === 0 ? (
          <div className="py-5 text-center text-slate-500 text-xs">
            No worker has accepted a job yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeBookings.map((booking: any) => (
              <div key={booking.id} className="p-4 bg-white rounded-2xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-bold text-slate-700">#{booking.booking_number}</span>
                  <StatusBadge status={booking.status} size="sm" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">{booking.service_name_snapshot}</h3>
                <p className="text-xs text-emerald-800 font-bold">
                  ✓ Accepted by: {booking.worker_name || `Worker #${booking.assigned_worker_id}`}
                </p>
                <p className="text-xs text-slate-600">Customer: {booking.customer_name || 'Customer'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Department Worker Roster */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Department Technicians</h2>
            <p className="text-xs text-slate-500">
              Only AVAILABLE workers can receive new assignments.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Total Roster: {workers.length}
          </span>
        </div>

        {workers.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No technicians registered in this department yet. Click "Add New Worker" to add technicians.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((w: any) => (
              <div
                key={w.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:shadow-xs transition-shadow flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                  {w.profile_photo ? (
                    <img src={w.profile_photo} alt={w.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{w.full_name}</h4>
                    <StatusBadge status={w.availability} size="sm" />
                  </div>
                  <div className="text-xs text-slate-500 truncate">{w.email}</div>
                  <div className="text-xs text-slate-600 font-medium">{w.phone}</div>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 mt-2">
                    <span className="flex items-center text-amber-600 font-bold">
                      <Star className="w-3 h-3 fill-amber-400 mr-1" />
                      {w.rating} ({w.total_ratings_count || 0})
                    </span>
                    <span>{w.completed_jobs} Jobs Completed</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approve & Assign Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Assign Certified Technician</h3>
                <p className="text-xs text-slate-500">Booking #{selectedBooking.booking_number}</p>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900">
              <strong>10-Minute SLA:</strong> The selected worker will have strictly 10 minutes to respond. If declined or timed out, the request returns to you for reassignment.
            </div>

            <form onSubmit={handleApproveAndAssign} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select AVAILABLE Technician *
                </label>

                {availableWorkers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                    No technicians in this department are currently AVAILABLE. Please wait for an active job to complete or register a new worker.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {availableWorkers.map((w: any) => (
                      <label
                        key={w.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          String(selectedWorkerId) === String(w.id)
                            ? 'bg-blue-50 border-blue-500 text-blue-900'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="selectedWorker"
                            value={w.id}
                            checked={String(selectedWorkerId) === String(w.id)}
                            onChange={(e) => setSelectedWorkerId(e.target.value)}
                            className="text-blue-600"
                          />
                          <div>
                            <div className="text-xs font-bold">{w.full_name}</div>
                            <div className="text-[11px] text-slate-500">{w.phone} &bull; {w.experience_years || 1} yr(s) exp</div>
                          </div>
                        </div>

                        <div className="flex items-center text-xs font-bold text-amber-600">
                          <Star className="w-3 h-3 fill-amber-400 mr-1" />
                          {w.rating}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedWorkerId || availableWorkers.length === 0}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {assigning ? 'Dispatching...' : 'Approve & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Booking Modal */}
      {rejectingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Reject Service Request</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason *</label>
              <textarea
                required
                rows={3}
                placeholder="Reason customer cannot be serviced..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejectingBooking(null)}
                className="flex-1 py-2 rounded-xl border text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectBooking}
                disabled={rejecting || !rejectReason.trim()}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {rejecting ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      {showAddWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-lg">Add New Technician</h3>
              <button onClick={() => setShowAddWorkerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorker} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Arun Kumar"
                  value={workerForm.full_name}
                  onChange={(e) => setWorkerForm({ ...workerForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="arun@workway.com"
                  value={workerForm.email}
                  onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 00000"
                  value={workerForm.phone}
                  onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={workerForm.password}
                  onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Base Address *</label>
                <input
                  type="text"
                  required
                  placeholder="Area, Station location"
                  value={workerForm.address}
                  onChange={(e) => setWorkerForm({ ...workerForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Profile Photo URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={workerForm.profile_photo}
                  onChange={(e) => setWorkerForm({ ...workerForm, profile_photo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Years of Experience</label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={workerForm.experience_years}
                  onChange={(e) => setWorkerForm({ ...workerForm, experience_years: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddWorkerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWorker}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {creatingWorker ? 'Adding...' : 'Create Worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
