import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Clock, ArrowRight, Wrench } from 'lucide-react';
import api from '../../services/api';
import { Service, Department } from '../../types';

export const ServicesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDept = searchParams.get('dept') || 'all';

  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const [deptRes, servRes] = await Promise.all([
          api.get('/departments'),
          api.get(`/services${selectedDept !== 'all' ? `?department_id=${selectedDept}` : ''}`),
        ]);
        if (deptRes.data.success) setDepartments(deptRes.data.data);
        if (servRes.data.success) setServices(servRes.data.data);
      } catch (err) {
        console.error('Failed to load services', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [selectedDept]);

  const filteredServices = services.filter((s) => {
    return (
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Title & Search */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Fixed-Price Service Catalog</h1>
        <p className="text-slate-600 text-sm mt-1">
          Select a verified service with locked pricing. All work is supervised by certified Department Heads.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services, repairs, installations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Department Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            <button
              onClick={() => setSearchParams({})}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                selectedDept === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Departments
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => setSearchParams({ dept: String(d.id) })}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                  selectedDept === String(d.id)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-sm">Loading available services...</div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-base">No services found</h3>
          <p className="text-xs text-slate-500 mt-1">Try changing your search keywords or department filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-lg transition-all"
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
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  Book Service <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
