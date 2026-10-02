import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Clock, 
  Wrench, 
  ArrowRight, 
  CheckCircle, 
  Users, 
  Star, 
  CreditCard,
  Zap,
  Wind,
  Cpu,
  Hammer
} from 'lucide-react';
import api from '../../services/api';
import { Department, Service } from '../../types';

export const HomePage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [popularServices, setPopularServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, servRes] = await Promise.all([
          api.get('/departments'),
          api.get('/services'),
        ]);
        if (deptRes.data.success) setDepartments(deptRes.data.data);
        if (servRes.data.success) setPopularServices(servRes.data.data.slice(0, 6));
      } catch (err) {
        console.error('Failed to load home data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getDeptIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap className="w-6 h-6 text-amber-500" />;
      case 'Wrench':
        return <Wrench className="w-6 h-6 text-blue-500" />;
      case 'Wind':
        return <Wind className="w-6 h-6 text-cyan-500" />;
      case 'Cpu':
        return <Cpu className="w-6 h-6 text-indigo-500" />;
      case 'Hammer':
        return <Hammer className="w-6 h-6 text-orange-500" />;
      default:
        return <Wrench className="w-6 h-6 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 bg-linear-to-b from-blue-50/60 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Department Head Verified Dispatch
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Verified Expert Services. <br />
                <span className="text-blue-600">Fixed Transparent Pricing.</span>
              </h1>

              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                WORKWAY connects customers directly with vetted technicians through authorized Department Heads. No price haggling, immediate booking, and real-time live dispatch.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link
                  to="/services"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-500/25 transition-all hover:scale-102"
                >
                  Book a Service
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-base transition-colors"
                >
                  How Dispatch Works
                </Link>
              </div>

              {/* Guarantees */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-200">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">100%</div>
                  <div className="text-xs text-slate-500 font-medium">Fixed Prices</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">10 Min</div>
                  <div className="text-xs text-slate-500 font-medium">Worker Response</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900">30 Min</div>
                  <div className="text-xs text-slate-500 font-medium">Free Cancellation</div>
                </div>
              </div>
            </div>

            {/* Hero Visual Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg">Instant Service Request</h3>
                    <p className="text-xs text-slate-500">Live booking engine with immediate dispatch</p>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                </div>

                <div className="space-y-4 my-6">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Step 1: Pick Fixed-Price Service</div>
                      <div className="text-xs text-slate-500">Admin-locked pricing protects against surge costs.</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Step 2: Head Approves & Dispatches</div>
                      <div className="text-xs text-slate-500">Only Available certified workers receive your job.</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <CheckCircle className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Step 3: Pay After Work Verified</div>
                      <div className="text-xs text-slate-500">Confirm completion before Cashfree UPI checkout.</div>
                    </div>
                  </div>
                </div>

                <Link
                  to="/services"
                  className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  Explore Catalog
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Departments Directory */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Operational Departments</h2>
            <p className="text-slate-600 text-sm mt-1">Each department is supervised by a dedicated Department Head.</p>
          </div>
          <Link to="/services" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-4 md:mt-0">
            View All Services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => (
            <Link
              key={dept.id}
              to={`/services?dept=${dept.id}`}
              className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-xl transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {getDeptIcon(dept.icon)}
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-blue-600 transition-colors">
                {dept.name}
              </h3>
              <p className="text-slate-600 text-xs mt-2 line-clamp-2 leading-relaxed">
                {dept.description}
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{dept.services_count || 0} Fixed-price services</span>
                <span className="text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                  Book now <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular Fixed Price Services */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Popular Guaranteed Services</h2>
          <p className="text-slate-600 text-sm mt-2">
            No hidden charges or surprise invoices. The price you see is the exact amount verified upon job completion.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {popularServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                    {service.department_name}
                  </span>
                  <span className="flex items-center text-xs text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    {service.estimated_duration_minutes} mins
                  </span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg mb-2">{service.name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">{service.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Fixed Price</span>
                  <span className="text-2xl font-black text-slate-900">₹{service.fixed_price}</span>
                </div>
                <Link
                  to={`/user/book?service_id=${service.id}`}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                >
                  Book Service
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Policy Breakdown */}
      <section className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2">10-Minute Assignment SLA</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                When a Department Head dispatches a worker, the worker has strictly 10 minutes to accept or provide a mandatory decline reason. If expired, Head reassigns immediately.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2">30-Minute Free Cancellation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cancel free of charge before head approval and within 30 minutes of worker assignment. After 30 minutes, a standard ₹100 dispatch compensation applies.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg mb-2">Pay After Customer Approval</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You never pay in advance. The worker marks completion, you inspect the result and confirm, then checkout securely via Cashfree UPI.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
