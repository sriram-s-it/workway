import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';

// Public pages
import { HomePage } from './pages/public/HomePage';
import { ServicesPage } from './pages/public/ServicesPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { VerifyEmailPage } from './pages/public/VerifyEmailPage';

// Customer pages
import { CustomerDashboard } from './pages/customer/CustomerDashboard';
import { CreateBookingPage } from './pages/customer/CreateBookingPage';
import { MyBookingsPage } from './pages/customer/MyBookingsPage';
import { BookingDetailPage } from './pages/customer/BookingDetailPage';

// Head pages
import { HeadDashboard } from './pages/head/HeadDashboard';

// Worker pages
import { WorkerDashboard } from './pages/worker/WorkerDashboard';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white">
            <Navbar />
            <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                {/* Customer Routes (USER) */}
                <Route
                  path="/user/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['USER', 'ADMIN']}>
                      <CustomerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user/book"
                  element={
                    <ProtectedRoute allowedRoles={['USER', 'ADMIN']} requireVerifiedEmail={true}>
                      <CreateBookingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user/bookings"
                  element={
                    <ProtectedRoute allowedRoles={['USER', 'ADMIN']}>
                      <MyBookingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/user/bookings/:id"
                  element={
                    <ProtectedRoute allowedRoles={['USER', 'DEPARTMENT_HEAD', 'WORKER', 'ADMIN']}>
                      <BookingDetailPage />
                    </ProtectedRoute>
                  }
                />

                {/* Department Head Routes */}
                <Route
                  path="/head/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['DEPARTMENT_HEAD', 'ADMIN']}>
                      <HeadDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Worker Routes */}
                <Route
                  path="/worker/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER', 'ADMIN']}>
                      <WorkerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
