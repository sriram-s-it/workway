import React from 'react';
import { CheckCircle2, Clock, AlertCircle, DollarSign, Wrench, Ban, UserCheck } from 'lucide-react';
import { TimelineEvent } from '../types';

interface TimelineProps {
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm">
        No timeline events recorded yet.
      </div>
    );
  }

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'BOOKING_CREATED':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'HEAD_APPROVED_AND_ASSIGNED':
      case 'WORKER_ACCEPTED':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      case 'WORK_STARTED':
      case 'WORK_COMPLETED':
        return <Wrench className="w-4 h-4 text-purple-600" />;
      case 'CUSTOMER_CONFIRMED_COMPLETION':
      case 'PAYMENT_SUCCESS':
      case 'BOOKING_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'PAYMENT_CREATED':
      case 'CANCELLATION_FEE_PAID':
        return <DollarSign className="w-4 h-4 text-amber-600" />;
      case 'WORKER_DECLINED':
      case 'ASSIGNMENT_EXPIRED':
      case 'CANCELLATION_FREE':
      case 'CANCELLATION_WITH_FEE':
      case 'HEAD_REJECTED':
        return <Ban className="w-4 h-4 text-rose-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-600" />;
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {events.map((item, idx) => (
        <div key={item.id || idx} className="relative group">
          <div className="absolute -left-6 top-1 flex items-center justify-center w-5 h-5 rounded-full bg-white border-2 border-slate-300 group-hover:border-blue-500 shadow-xs">
            {getEventIcon(item.event)}
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 hover:bg-white hover:border-slate-300 transition-all">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-slate-800 tracking-tight">
                {item.event.replace(/_/g, ' ')}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {formatTimestamp(item.created_at)}
              </span>
            </div>
            {item.reason && (
              <p className="text-xs text-slate-600 font-normal leading-relaxed">
                {item.reason}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-500">{item.actor_role}</span>
              {item.actor_name && <span>&bull; {item.actor_name}</span>}
              {item.new_status && (
                <span className="ml-auto font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                  {item.new_status}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
