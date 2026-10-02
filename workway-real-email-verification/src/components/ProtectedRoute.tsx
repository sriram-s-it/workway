import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireVerifiedEmail?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireVerifiedEmail = false,
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their assigned dashboard
    const roleRoutes: Record<string, string> = {
      ADMIN: '/admin/dashboard',
      DEPARTMENT_HEAD: '/head/dashboard',
      WORKER: '/worker/dashboard',
      USER: '/user/dashboard',
    };
    return <Navigate to={roleRoutes[user.role] || '/'} replace />;
  }

  if (requireVerifiedEmail && user.role === 'USER' && !user.email_verified) {
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email)}`} replace />;
  }

  return <>{children}</>;
};
