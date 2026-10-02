import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Wrench, ArrowRight, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../services/api';
import { Booking } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings');
      if (res.data.success) {
        setBookings(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load customer bookings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchBookings();
    };
    socket.on('notification', handleUpdate);
    return () => {
      socket.off('notification', handleUpdate);
    };
  }, [socket]);

  const activeBookings = bookings.filter((b) =>
    !['COMPLETED', 'CANCELLED', 'CANCELLED_WITH_FEE', 'REJECTED'].includes(b.status)
  );

  const completedCount = bookings.filter((b) => b.status === 'COMPLETED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-linear-to-r from-blue-700 to-indigo-800 rounded-3xl p-6 sm:p-10 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200 bg-blue-900/50 px-3 py-1 rounded-full">
            Customer Dashboard
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2">Welcome back, {user?.full_name}!</h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-xl">
            Track your active service repairs, view assigned technician status, and make verified payments.
          </p>
        </div>

        <Link
          to="/user/book"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-blue-700 font-extrabold text-sm shadow-md transition-all shrink-0"
        >
          <Wrench className="w-4 h-4" />
          Book New Service
        </Link>
      </div>

      {/* Unverified Email Warning if applicable */}
      {user && !user.email_verified && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 font-medium">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Your email address is unverified. You must verify your email before placing new bookings.</span>
          </div>
          <Link
            to={`/verify-email?email=${encodeURIComponent(user.email)}`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shrink-0 text-center"
          >
            Verify Now
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Bookings</span>
          <div className="text-3xl font-black text-slate-900 mt-2">{activeBookings.length}</div>
          <span className="text-xs text-blue-600 font-semibold mt-1 block">Live in dispatch & execution</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Services</span>
          <div className="text-3xl font-black text-slate-900 mt-2">{completedCount}</div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">Verified & completed</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
          <div className="text-3xl font-black text-slate-900 mt-2">{bookings.length}</div>
          <span className="text-xs text-slate-500 font-semibold mt-1 block">Historical requests</span>
        </div>
      </div>

      {/* Active Service Requests */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Active Service Requests</h2>
          <Link to="/user/bookings" className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            All Bookings <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading active requests...</div>
        ) : activeBookings.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center max-w-lg mx-auto">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base">No active bookings right now</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">
              Need repairs, installations, or maintenance? Choose from our fixed-price catalog.
            </p>
            <Link
              to="/user/book"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
            >
              Book Service Now
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      #{booking.booking_number}
                    </span>
                    <StatusBadge status={booking.status} />
                  </div>

                  <h3 className="text-lg font-black text-slate-900 mb-1">
                    {booking.service_name_snapshot}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">{booking.department_name}</p>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Service Address:</span>
                      <span className="font-semibold text-slate-800 text-right truncate max-w-[200px]">
                        {booking.service_address}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Technician:</span>
                      <span className="font-bold text-slate-900">
                        {booking.worker_name || 'Pending assignment by Head'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fixed Cost:</span>
                      <span className="font-black text-slate-900">₹{booking.service_price}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Booked {new Date(booking.created_at).toLocaleDateString()}
                  </span>
                  <Link
                    to={`/user/bookings/${booking.id}`}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    View Status & Timeline <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
