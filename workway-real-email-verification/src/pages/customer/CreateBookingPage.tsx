import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  MapPin, 
  Phone, 
  FileText, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  X,
  Upload
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Service, Department } from '../../types';

export const CreateBookingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const preselectedServiceId = searchParams.get('service_id');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(preselectedServiceId || '');

  const [serviceAddress, setServiceAddress] = useState(user?.address || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [noWorkerAvailable, setNoWorkerAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const [deptRes, servRes] = await Promise.all([
          api.get('/departments'),
          api.get('/services'),
        ]);
        if (deptRes.data.success) {
          setDepartments(deptRes.data.data);
        }
        if (servRes.data.success) {
          setServices(servRes.data.data);

          if (preselectedServiceId) {
            const found = servRes.data.data.find((s: Service) => String(s.id) === String(preselectedServiceId));
            if (found) {
              setSelectedDeptId(String(found.department_id));
              setSelectedServiceId(String(found.id));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load catalog', err);
      }
    };
    fetchCatalog();
  }, [preselectedServiceId]);

  const filteredServices = selectedDeptId
    ? services.filter((s) => String(s.department_id) === String(selectedDeptId))
    : services;

  const currentService = services.find((s) => String(s.id) === String(selectedServiceId));

  const handleAddImage = () => {
    if (!imageInput.trim()) return;
    if (images.length >= 5) {
      setError('Maximum 5 service images allowed.');
      return;
    }
    setImages([...images, imageInput.trim()]);
    setImageInput('');
    setError(null);
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 5) {
      setError('Maximum 5 service images allowed.');
      return;
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImages((prev) => (prev.length < 5 ? [...prev, reader.result as string] : prev));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNoWorkerAvailable(false);

    if (!selectedServiceId) {
      setError('Please select a service.');
      return;
    }
    if (!serviceAddress.trim()) {
      setError('Service address is required.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Phone number is required.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/bookings', {
        service_id: Number(selectedServiceId),
        service_address: serviceAddress.trim(),
        customer_phone: customerPhone.trim(),
        description: description.trim() || undefined,
        images,
      });

      if (res.data.success) {
        navigate(`/user/bookings/${res.data.data.bookingId}`);
      }
    } catch (err: any) {
      const errorCode = err.response?.data?.code;
      if (errorCode === 'NO_WORKER_AVAILABLE') {
        setNoWorkerAvailable(true);
      } else {
        setError(err.response?.data?.message || 'Booking submission failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Book a Service</h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Immediate booking dispatch with locked, transparent fixed prices.
        </p>
      </div>

      {noWorkerAvailable && (
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-base text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            No worker available
          </div>
          <p className="text-xs sm:text-sm leading-relaxed">
            All certified technicians in this department are currently busy or off-duty. To ensure the highest standard of service, we do not create mock or unassigned bookings. Please try again shortly.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Inputs */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          {/* Step 1: Department & Service */}
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              Select Service
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Filter by Department</label>
                <select
                  value={selectedDeptId}
                  onChange={(e) => {
                    setSelectedDeptId(e.target.value);
                    setSelectedServiceId('');
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Task *</label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a fixed-price service</option>
                  {filteredServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — ₹{s.fixed_price} ({s.estimated_duration_minutes} min)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Address & Phone */}
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Location & Contact
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Address *</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <textarea
                    required
                    rows={2}
                    placeholder="House/Apartment, Street, Landmark, Area, City"
                    value={serviceAddress}
                    onChange={(e) => setServiceAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Contact Phone *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Optional Details & Photos (Max 5) */}
          <div className="pt-6 border-t border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
              Job Description & Photos (Optional)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes for the Technician</label>
                <textarea
                  rows={2}
                  placeholder="Describe problem details, brand model, or special instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Upload Photos ({images.length}/5 max)
                </label>
                <div className="flex gap-2">
                  <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Browse Photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={images.length >= 5}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="or paste image URL"
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    disabled={images.length >= 5}
                  />
                  <button
                    type="button"
                    onClick={handleAddImage}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
                    disabled={images.length >= 5 || !imageInput.trim()}
                  >
                    Add
                  </button>
                </div>

                {/* Previews */}
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                        <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 p-0.5 rounded-full bg-rose-600 text-white text-xs opacity-90 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Price Summary Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl sticky top-24">
            <h3 className="text-base font-extrabold tracking-tight mb-4 pb-4 border-b border-slate-800">
              Booking Summary
            </h3>

            {currentService ? (
              <div className="space-y-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-blue-400 font-bold block">
                    {currentService.department_name}
                  </span>
                  <h4 className="text-lg font-bold text-white mt-0.5">{currentService.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{currentService.description}</p>
                </div>

                <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Fixed Service Price:</span>
                    <span className="font-bold text-white text-sm">₹{currentService.fixed_price}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Estimated Duration:</span>
                    <span className="text-white">{currentService.estimated_duration_minutes} minutes</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Booking Fee:</span>
                    <span className="text-emerald-400 font-bold">₹0 (Free Dispatch)</span>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-baseline border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-400">Total Payable:</span>
                  <span className="text-3xl font-black text-white">₹{currentService.fixed_price}</span>
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                  <span className="text-emerald-400 font-semibold block mb-0.5">● Pay After Job Completion</span>
                  Amount is collected through Cashfree UPI only after technician finishes and you confirm satisfaction.
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Validating Availability...' : 'BOOK SERVICE'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                Select a service from the left to view pricing and availability.
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
