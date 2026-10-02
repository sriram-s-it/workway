import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { Booking } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

export const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get('/bookings');
        if (res.data.success) {
          setBookings(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load bookings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'ACTIVE') {
      return !['COMPLETED', 'CANCELLED', 'CANCELLED_WITH_FEE', 'REJECTED'].includes(b.status);
    }
    if (filter === 'COMPLETED') {
      return b.status === 'COMPLETED';
    }
    if (filter === 'CANCELLED') {
      return ['CANCELLED', 'CANCELLED_WITH_FEE', 'REJECTED'].includes(b.status);
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">My Bookings</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track status, audit timelines, review completion, and pay verified charges
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
          {(['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading your bookings...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center max-w-md mx-auto">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">You don't have any bookings yet.</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            Browse our fixed-price service departments to book your first verified repair.
          </p>
          <Link
            to="/user/book"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
          >
            Book a Service
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 hover:border-blue-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    #{booking.booking_number}
                  </span>
                  <StatusBadge status={booking.status} />
                  <span className="text-xs text-slate-400">
                    &bull; {new Date(booking.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900">{booking.service_name_snapshot}</h3>
                <p className="text-xs text-slate-500">{booking.department_name} &bull; {booking.service_address}</p>

                <div className="flex items-center gap-4 text-xs pt-1">
                  <span className="text-slate-600">
                    Technician:{' '}
                    <strong className="text-slate-900">{booking.worker_name || 'Awaiting assignment'}</strong>
                  </span>
                  <span className="text-slate-600">
                    Fixed Cost: <strong className="text-slate-900">₹{booking.service_price}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/user/bookings/${booking.id}`}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  Manage & Details
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
