import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Shield, CheckCircle, Clock } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">WORKWAY</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Professional department-driven service marketplace connecting verified technicians with homeowners and businesses.
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-400" /> Verified Workers</span>
              <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Fixed Pricing</span>
            </div>
          </div>

          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Core Departments</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link to="/services?dept=1" className="hover:text-blue-400 transition-colors">Electrical & Power Systems</Link></li>
              <li><Link to="/services?dept=2" className="hover:text-blue-400 transition-colors">Plumbing & Pipe Fitting</Link></li>
              <li><Link to="/services?dept=3" className="hover:text-blue-400 transition-colors">HVAC & Air Conditioning</Link></li>
              <li><Link to="/services?dept=4" className="hover:text-blue-400 transition-colors">Home Appliances Repair</Link></li>
              <li><Link to="/services?dept=5" className="hover:text-blue-400 transition-colors">Carpentry & Woodwork</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Platform Rules</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><span className="text-slate-200 font-medium">Head Approval:</span> Certified worker dispatch</li>
              <li><span className="text-slate-200 font-medium">10-Minute Timeout:</span> Prompt worker response</li>
              <li><span className="text-slate-200 font-medium">30-Min Free Cancel:</span> Before fee applies</li>
              <li><span className="text-slate-200 font-medium">Cashfree UPI:</span> Secure verified payments</li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Enterprise Compliance</h4>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              WORKWAY enforces server-validated pricing, audit trails, and role-based access control across all operations.
            </p>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 text-xs">
              <span className="text-emerald-400 font-semibold block mb-0.5">● Database Connected</span>
              <span className="text-slate-400 text-[11px]">Real relational transactions & verification</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>&copy; {new Date().getFullYear()} WORKWAY Platform Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Admin, Head, Worker & Customer Portals</span>
            <span>Security Audited</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
