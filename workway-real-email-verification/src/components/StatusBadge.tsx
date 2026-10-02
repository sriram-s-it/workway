import React from 'react';
import { BookingStatus, WorkerAvailability } from '../types';

interface StatusBadgeProps {
  status: BookingStatus | WorkerAvailability | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-semibold',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  };

  const getStatusConfig = () => {
    switch (status) {
      // Booking Statuses
      case 'PENDING_HEAD_APPROVAL':
        return { label: 'Pending Head Approval', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'APPROVED':
        return { label: 'Head Approved (Assigning)', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'ASSIGNED':
        return { label: 'Worker Assigned', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'WORK_STARTED':
        return { label: 'Work In Progress', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
      case 'WORK_COMPLETED':
        return { label: 'Work Completed', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'CUSTOMER_CONFIRMED':
        return { label: 'Customer Confirmed', bg: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'PAYMENT_PENDING':
        return { label: 'Payment Pending', bg: 'bg-orange-50 text-orange-800 border-orange-200' };
      case 'PAID':
      case 'COMPLETED':
        return { label: 'Payment Paid Successfully', bg: 'bg-green-50 text-green-800 border-green-200' };
      case 'CANCELLED':
        return { label: 'Cancelled (Free)', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'CANCELLED_WITH_FEE':
        return { label: 'Cancelled (₹100 Fee)', bg: 'bg-rose-100 text-rose-900 border-rose-300' };
      case 'REJECTED':
        return { label: 'Request Rejected', bg: 'bg-zinc-100 text-zinc-800 border-zinc-300' };

      // Worker Availability
      case 'AVAILABLE':
        return { label: 'Available', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300' };
      case 'BUSY':
        return { label: 'Busy (On Job)', bg: 'bg-rose-50 text-rose-700 border-rose-300' };

      // Payment Status
      case 'SUCCESS':
        return { label: 'Paid', bg: 'bg-emerald-50 text-emerald-700 border-emerald-300' };
      case 'FAILED':
        return { label: 'Failed', bg: 'bg-red-50 text-red-700 border-red-300' };
      case 'PENDING':
        return { label: 'Pending', bg: 'bg-yellow-50 text-yellow-800 border-yellow-300' };

      default:
        return { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`inline-flex items-center rounded-full border ${config.bg} ${sizeClasses[size]}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {config.label}
    </span>
  );
};
