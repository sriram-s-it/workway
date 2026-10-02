import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, CheckCircle2, AlertTriangle, ArrowRight, Wrench, CreditCard } from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold mb-3">
          <Wrench className="w-3.5 h-3.5" />
          The WORKWAY Dispatch Standard
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">How WORKWAY Operates</h1>
        <p className="text-slate-600 text-sm mt-2">
          An enterprise-grade, four-role hierarchical service marketplace designed to eliminate fake contractors, rogue pricing, and delayed dispatches.
        </p>
      </div>

      {/* 4 Steps */}
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shrink-0">
            1
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-extrabold text-slate-900">Fixed-Price Catalog & Immediate Booking</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Customers choose from fixed-price repair and maintenance tasks configured exclusively by Central Administration. Customers cannot alter the price and technicians cannot charge arbitrary fees. Customers attach address details and up to 5 optional service condition photos.
            </p>
            <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg inline-block">
              Rule: Immediate availability check ensures booking is only accepted if Available workers exist.
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shrink-0">
            2
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-extrabold text-slate-900">Department Head Approval & Worker Dispatch</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every booking is routed directly to the dedicated Department Head responsible for that trade (e.g. Electrical, Plumbing, HVAC). The Head evaluates the job and manually assigns an AVAILABLE certified technician. Automated blind assignment is disallowed to ensure quality.
            </p>
            <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg inline-block">
              Rule: Exactly ONE Department Head per department; only AVAILABLE workers can be selected.
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shrink-0">
            3
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-extrabold text-slate-900">10-Minute Acceptance SLA & 30-Minute Cancellation</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              The assigned worker has exactly 10 minutes to respond. If declined, a mandatory reason must be provided. If 10 minutes elapse without response, the assignment automatically expires and the Head is prompted to reassign. Customers enjoy a 30-minute free cancellation window post-assignment.
            </p>
            <div className="text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg inline-block">
              Rule: Cancellation after 30 min window (before work starts) incurs a ₹100 dispatch fee via Cashfree.
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 items-start">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shrink-0">
            4
          </div>
          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-extrabold text-slate-900">Execution, Customer Confirmation & Cashfree UPI Payment</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Worker starts the job (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">WORK_STARTED</code>) and finishes it (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">WORK_COMPLETED</code>). The customer verifies the completed repair on site and clicks "Confirm Completion". Payment is then executed securely through Cashfree PG (UPI / Cards) and the technician is released back to Available status.
            </p>
            <div className="text-xs font-semibold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg inline-block">
              Rule: Real payment webhook verification server-side; zero fake payment success.
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pt-6">
        <Link
          to="/services"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/25 transition-all"
        >
          Book Your Service Now <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
};
