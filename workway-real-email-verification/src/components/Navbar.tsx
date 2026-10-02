import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  Bell, 
  LogOut, 
  Menu, 
  X, 
  LayoutDashboard, 
  CalendarDays, 
  ShieldCheck, 
  Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { NotificationModal } from './NotificationModal';
import api from '../services/api';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setUnreadCount(res.data.data.unreadCount || 0);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handleNewNotif = () => {
      setUnreadCount((prev) => prev + 1);
    };
    socket.on('notification', handleNewNotif);
    return () => {
      socket.off('notification', handleNewNotif);
    };
  }, [socket]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'ADMIN':
        return '/admin/dashboard';
      case 'DEPARTMENT_HEAD':
        return '/head/dashboard';
      case 'WORKER':
        return '/worker/dashboard';
      case 'USER':
      default:
        return '/user/dashboard';
    }
  };

  // The public catalog is for customers choosing a service. Department Heads
  // and Workers manage assigned work from their dashboards instead.
  const canViewServicesCatalog = !user || user.role === 'USER' || user.role === 'ADMIN';

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                  WORKWAY
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 -mt-1">
                  Service Platform
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              {canViewServicesCatalog && (
                <Link to="/services" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                  Services Catalog
                </Link>
              )}
              <Link to="/how-it-works" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                How It Works
              </Link>

              {user ? (
                <>
                  <Link
                    to={getDashboardPath()}
                    className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-lg transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Link>

                  {user.role === 'USER' && (
                    <Link
                      to="/user/bookings"
                      className="text-sm font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1"
                    >
                      <CalendarDays className="w-4 h-4" />
                      My Bookings
                    </Link>
                  )}

                  {/* Notification Bell */}
                  <button
                    onClick={() => {
                      setNotifOpen(true);
                      setUnreadCount(0);
                    }}
                    className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* User Profile & Role Info */}
                  <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800 line-clamp-1">{user.full_name}</div>
                      <div className="text-[10px] font-semibold text-blue-600 tracking-wide uppercase">
                        {user.role.replace('_', ' ')}
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    className="text-sm font-bold text-slate-700 hover:text-blue-600 px-3 py-2 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl shadow-xs transition-all hover:shadow-md"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Hamburger */}
            <div className="flex items-center gap-2 md:hidden">
              {user && (
                <button
                  onClick={() => {
                    setNotifOpen(true);
                    setUnreadCount(0);
                  }}
                  className="relative p-2 text-slate-600"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 rounded-lg"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
            {canViewServicesCatalog && (
              <Link
                to="/services"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-semibold text-slate-700 hover:text-blue-600"
              >
                Services Catalog
              </Link>
            )}
            <Link
              to="/how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-slate-700 hover:text-blue-600"
            >
              How It Works
            </Link>

            {user ? (
              <>
                <Link
                  to={getDashboardPath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-sm font-bold text-blue-600"
                >
                  Dashboard ({user.role})
                </Link>
                {user.role === 'USER' && (
                  <Link
                    to="/user/bookings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-sm font-semibold text-slate-700"
                  >
                    My Bookings
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left py-2 text-sm font-semibold text-rose-600 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out ({user.full_name})
                </button>
              </>
            ) : (
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-bold text-slate-800 border border-slate-200 rounded-xl"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-bold text-white bg-blue-600 rounded-xl"
                >
                  Register Customer
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Notifications Popover */}
      <NotificationModal isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
};
