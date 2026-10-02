import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Wrench, 
  CalendarDays, 
  DollarSign, 
  ShieldCheck, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  X,
  FileText,
  UserCheck
} from 'lucide-react';
import api from '../../services/api';
import { StatusBadge } from '../../components/StatusBadge';

export const AdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<'METRICS' | 'DEPARTMENTS' | 'SERVICES' | 'USERS' | 'BOOKINGS' | 'PAYMENTS' | 'AUDIT'>('METRICS');
  const [stats, setStats] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Department Modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ id: 0, name: '', description: '', icon: 'Wrench', head_user_id: '' });

  // Service Modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({ id: 0, name: '', description: '', department_id: '', fixed_price: 399, estimated_duration_minutes: 60 });

  // Create Head Modal
  const [showHeadModal, setShowHeadModal] = useState(false);
  const [headForm, setHeadForm] = useState({ full_name: '', email: '', phone: '', password: '', address: '', department_id: '' });

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load admin stats.');
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    try {
      if (tab === 'METRICS') await fetchStats();
      if (tab === 'DEPARTMENTS') {
        const res = await api.get('/departments');
        if (res.data.success) setDepartments(res.data.data);
      }
      if (tab === 'SERVICES') {
        const [servRes, deptRes] = await Promise.all([api.get('/services'), api.get('/departments')]);
        if (servRes.data.success) setServices(servRes.data.data);
        if (deptRes.data.success) setDepartments(deptRes.data.data);
      }
      if (tab === 'USERS') {
        const [uRes, deptRes] = await Promise.all([api.get('/admin/users'), api.get('/departments')]);
        if (uRes.data.success) setUsers(uRes.data.data);
        if (deptRes.data.success) setDepartments(deptRes.data.data);
      }
      if (tab === 'BOOKINGS') {
        const res = await api.get('/admin/bookings');
        if (res.data.success) setBookings(res.data.data);
      }
      if (tab === 'PAYMENTS') {
        const res = await api.get('/admin/payments');
        if (res.data.success) setPayments(res.data.data);
      }
      if (tab === 'AUDIT') {
        const res = await api.get('/admin/audit-logs');
        if (res.data.success) setAuditLogs(res.data.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabData();
  }, [tab]);

  // Create or Update Department
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (deptForm.id) {
        await api.put(`/departments/${deptForm.id}`, deptForm);
      } else {
        await api.post('/departments', {
          ...deptForm,
          head_user_id: deptForm.head_user_id ? Number(deptForm.head_user_id) : undefined,
        });
      }
      setShowDeptModal(false);
      fetchTabData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Department operation failed.');
    }
  };

  // Create or Update Service
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (serviceForm.id) {
        await api.put(`/services/${serviceForm.id}`, serviceForm);
      } else {
        await api.post('/services', {
          ...serviceForm,
          department_id: Number(serviceForm.department_id),
          fixed_price: Number(serviceForm.fixed_price),
        });
      }
      setShowServiceModal(false);
      fetchTabData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Service operation failed.');
    }
  };

  // Create Department Head
  const handleCreateHead = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/admin/users/create-head', {
        ...headForm,
        department_id: headForm.department_id ? Number(headForm.department_id) : undefined,
      });
      setShowHeadModal(false);
      setHeadForm({ full_name: '', email: '', phone: '', password: '', address: '', department_id: '' });
      fetchTabData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create department head.');
    }
  };

  // Toggle user activation
  const handleToggleUser = async (userId: number, currentActive: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-status`, { is_active: !currentActive });
      fetchTabData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  // Safe delete customer
  const handleSafeDeleteCustomer = async (userId: number) => {
    if (!window.confirm('Safe customer deletion will anonymize personal records while preserving foreign keys for past transactions, bookings, and audit integrity. Proceed?')) {
      return;
    }
    try {
      await api.delete(`/admin/users/${userId}/delete-customer`);
      fetchTabData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Customer deletion failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-slate-800 px-3 py-1 rounded-full">
            Central Platform Administration
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2">WORKWAY Command Center</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Supervise department heads, enforce fixed pricing, audit live transactions, and maintain relational integrity.
          </p>
        </div>

        {/* Action Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-800 p-1.5 rounded-2xl">
          {[
            { id: 'METRICS', label: 'Metrics' },
            { id: 'DEPARTMENTS', label: 'Departments' },
            { id: 'SERVICES', label: 'Services' },
            { id: 'USERS', label: 'Users & Heads' },
            { id: 'BOOKINGS', label: 'Bookings' },
            { id: 'PAYMENTS', label: 'Payments' },
            { id: 'AUDIT', label: 'Audit Logs' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                tab === t.id ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: METRICS */}
      {tab === 'METRICS' && stats && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">₹{stats.metrics.totalRevenue}</div>
              <span className="text-[11px] text-emerald-600 font-semibold block mt-0.5">Verified Cashfree</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Bookings</span>
              <div className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">{stats.metrics.activeBookings}</div>
              <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">In dispatch/execution</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed Jobs</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">{stats.metrics.completedBookings}</div>
              <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">Paid and verified</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available Workers</span>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 mt-2">
                {stats.metrics.availableWorkers} / {stats.metrics.totalWorkers}
              </div>
              <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">Ready for assignment</span>
            </div>
          </div>

          {/* Recent Bookings table */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
            <h3 className="font-extrabold text-slate-900 text-lg mb-4">Live Platform Activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Booking #</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Service</th>
                    <th className="pb-3">Department</th>
                    <th className="pb-3">Fixed Price</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentBookings.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 font-mono font-bold text-slate-800">#{b.booking_number}</td>
                      <td className="py-3 font-medium text-slate-900">{b.customer_name}</td>
                      <td className="py-3 text-slate-700">{b.service_name_snapshot}</td>
                      <td className="py-3 text-slate-500">{b.department_name}</td>
                      <td className="py-3 font-bold text-slate-900">₹{b.service_price}</td>
                      <td className="py-3"><StatusBadge status={b.status} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENTS */}
      {tab === 'DEPARTMENTS' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">Operational Departments</h2>
              <p className="text-xs text-slate-500">
                Enforcing business rule: <strong>ONE Department Head per department</strong>.
              </p>
            </div>
            <button
              onClick={() => {
                setDeptForm({ id: 0, name: '', description: '', icon: 'Wrench', head_user_id: '' });
                setShowDeptModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Department
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((d: any) => (
              <div key={d.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-base">{d.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {d.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{d.description}</p>
                <div className="p-3 bg-white rounded-xl border border-slate-100 text-xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Department Head:</span>
                  <span className="font-bold text-slate-900">
                    {d.head_name ? `${d.head_name} (${d.head_email})` : 'No Head Assigned'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200">
                  <span>{d.services_count || 0} Services &bull; {d.total_workers || 0} Workers</span>
                  <button
                    onClick={() => {
                      setDeptForm({
                        id: d.id,
                        name: d.name,
                        description: d.description || '',
                        icon: d.icon || 'Wrench',
                        head_user_id: d.head_user_id ? String(d.head_user_id) : '',
                      });
                      setShowDeptModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SERVICES */}
      {tab === 'SERVICES' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">Fixed-Price Service Catalog</h2>
              <p className="text-xs text-slate-500">
                Admin sets fixed prices. Customer cannot modify price. Historical bookings preserve price snapshot.
              </p>
            </div>
            <button
              onClick={() => {
                setServiceForm({ id: 0, name: '', description: '', department_id: departments[0]?.id ? String(departments[0].id) : '', fixed_price: 499, estimated_duration_minutes: 60 });
                setShowServiceModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Service Name</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Fixed Price</th>
                  <th className="pb-3">Duration</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 font-bold text-slate-900">{s.name}</td>
                    <td className="py-3 text-slate-600">{s.department_name}</td>
                    <td className="py-3 font-black text-slate-900 text-sm">₹{s.fixed_price}</td>
                    <td className="py-3 text-slate-500">{s.estimated_duration_minutes} min</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {s.is_active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => {
                          setServiceForm({
                            id: s.id,
                            name: s.name,
                            description: s.description,
                            department_id: String(s.department_id),
                            fixed_price: s.fixed_price,
                            estimated_duration_minutes: s.estimated_duration_minutes,
                          });
                          setShowServiceModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-bold mr-3 cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: USERS & HEADS */}
      {tab === 'USERS' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900">User Management & Role Control</h2>
              <p className="text-xs text-slate-500">
                Create Department Heads, activate/deactivate accounts, and safely anonymize customer deletions.
              </p>
            </div>
            <button
              onClick={() => setShowHeadModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              Create Department Head
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Email</th>
                  <th className="pb-3">Phone</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Verified</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 font-bold text-slate-900">{u.full_name}</td>
                    <td className="py-3 text-slate-600">{u.email}</td>
                    <td className="py-3 text-slate-600">{u.phone}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3">
                      {u.email_verified ? (
                        <span className="text-emerald-600 font-bold">Yes</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-2">
                      {u.role !== 'ADMIN' && (
                        <>
                          <button
                            onClick={() => handleToggleUser(u.id, Boolean(u.is_active))}
                            className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          {u.role === 'USER' && (
                            <button
                              onClick={() => handleSafeDeleteCustomer(u.id)}
                              className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                              title="Safe Anonymize"
                            >
                              Safe Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: BOOKINGS */}
      {tab === 'BOOKINGS' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-lg font-black text-slate-900">All System Bookings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Booking #</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Service</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Technician</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 font-mono font-bold text-slate-800">#{b.booking_number}</td>
                    <td className="py-3 font-bold text-slate-900">{b.customer_name}</td>
                    <td className="py-3 text-slate-700">{b.service_name_snapshot}</td>
                    <td className="py-3 text-slate-500">{b.department_name}</td>
                    <td className="py-3 text-slate-700">{b.worker_name || 'Unassigned'}</td>
                    <td className="py-3 font-bold text-slate-900">₹{b.service_price}</td>
                    <td className="py-3"><StatusBadge status={b.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: PAYMENTS */}
      {tab === 'PAYMENTS' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-lg font-black text-slate-900">Verified Cashfree Payment Records</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Payment Ref</th>
                  <th className="pb-3">Booking #</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Method</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 font-mono font-bold text-slate-700">{p.payment_reference}</td>
                    <td className="py-3 font-mono text-slate-600">#{p.booking_number}</td>
                    <td className="py-3 text-slate-800">{p.customer_name}</td>
                    <td className="py-3 text-slate-600">{p.payment_type}</td>
                    <td className="py-3 font-bold text-slate-900">₹{p.amount}</td>
                    <td className="py-3 uppercase text-[10px] font-bold text-slate-500">{p.payment_method || 'UPI'}</td>
                    <td className="py-3"><StatusBadge status={p.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: AUDIT LOGS */}
      {tab === 'AUDIT' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-lg font-black text-slate-900">Administrative Audit Trail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Admin</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Entity</th>
                  <th className="pb-3">Entity ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 text-slate-400 font-mono text-[11px]">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="py-3 font-bold text-slate-800">{log.admin_name}</td>
                    <td className="py-3 font-semibold text-blue-600">{log.action}</td>
                    <td className="py-3 text-slate-600">{log.entity}</td>
                    <td className="py-3 font-mono text-slate-500">{log.entity_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                {deptForm.id ? 'Edit Department' : 'Create Department'}
              </h3>
              <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical & Power Systems"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign Department Head</label>
                <select
                  value={deptForm.head_user_id}
                  onChange={(e) => setDeptForm({ ...deptForm, head_user_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="">None (Unassigned)</option>
                  {users.filter((u: any) => u.role === 'DEPARTMENT_HEAD').map((h: any) => (
                    <option key={h.id} value={h.id}>{h.full_name} ({h.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">
                {serviceForm.id ? 'Edit Service' : 'Add Fixed-Price Service'}
              </h3>
              <button onClick={() => setShowServiceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department *</label>
                <select
                  required
                  value={serviceForm.department_id}
                  onChange={(e) => setServiceForm({ ...serviceForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="">Select department</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Task Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ceiling Fan Repair"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fixed Price (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={serviceForm.fixed_price}
                  onChange={(e) => setServiceForm({ ...serviceForm, fixed_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Duration (mins)</label>
                <input
                  type="number"
                  min={15}
                  value={serviceForm.estimated_duration_minutes}
                  onChange={(e) => setServiceForm({ ...serviceForm, estimated_duration_minutes: parseInt(e.target.value, 10) || 60 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowServiceModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Head Modal */}
      {showHeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Create Department Head Account</h3>
              <button onClick={() => setShowHeadModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHead} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={headForm.full_name}
                  onChange={(e) => setHeadForm({ ...headForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={headForm.email}
                  onChange={(e) => setHeadForm({ ...headForm, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  required
                  value={headForm.phone}
                  onChange={(e) => setHeadForm({ ...headForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={headForm.password}
                  onChange={(e) => setHeadForm({ ...headForm, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Office / HQ Address *</label>
                <input
                  type="text"
                  required
                  value={headForm.address}
                  onChange={(e) => setHeadForm({ ...headForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assign to Department</label>
                <select
                  value={headForm.department_id}
                  onChange={(e) => setHeadForm({ ...headForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="">Assign Later</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowHeadModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Create Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
