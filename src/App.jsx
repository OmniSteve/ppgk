/**
 * Application entry point.
 *
 * Authentication is handled entirely by src/contexts/AuthContext.jsx using
 * the custom apiClient (/api/* routes).
 *
 * The Base44PreviewProvider import below satisfies the Base44 editor
 * environment and does nothing for application auth. Remove it on Cloudflare
 * deployment and replace with a React.Fragment.
 */
import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from '@/lib/PageNotFound';

// Base44 preview compatibility only — not used for auth logic.
import { AuthProvider as Base44PreviewProvider } from '@/lib/AuthContext';

// Real application auth
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import ScrollToTop from '@/components/ScrollToTop';
import AppProtectedRoute from '@/components/AppProtectedRoute';

// Public pages
import LandingPage from '@/pages/public/LandingPage';
import SignIn from '@/pages/public/SignIn';
import Register from '@/pages/public/Register';
import ForgotPassword from '@/pages/public/ForgotPassword';
import ResetPassword from '@/pages/public/ResetPassword';
import TermsPage from '@/pages/public/TermsPage';
import VerifyEmail from '@/pages/public/VerifyEmail';
import PrivacyPage from '@/pages/public/PrivacyPage';

// Client pages
import ClientDashboard from '@/pages/client/ClientDashboard';
import SessionCatalogue from '@/pages/client/SessionCatalogue';
import SessionDetails from '@/pages/client/SessionDetails';
import Checkout from '@/pages/client/Checkout';
import UpcomingBookings from '@/pages/client/UpcomingBookings';
import BookingDetails from '@/pages/client/BookingDetails';
import RescheduleBooking from '@/pages/client/RescheduleBooking';
import CancelBooking from '@/pages/client/CancelBooking';
import PaymentResult from '@/pages/client/PaymentResult';
import PlayerList from '@/pages/client/PlayerList';
import CreatePlayer from '@/pages/client/CreatePlayer';
import EditPlayer from '@/pages/client/EditPlayer';
import Packages from '@/pages/client/Packages';
import CreditBalance from '@/pages/client/CreditBalance';
import PurchaseHistory from '@/pages/client/PurchaseHistory';
import ClientNotifications from '@/pages/client/ClientNotifications';
import AccountDetails from '@/pages/client/AccountDetails';

// Coach pages
import CoachDashboard from '@/pages/coach/CoachDashboard';
import CoachSessions from '@/pages/coach/CoachSessions';
import SessionAttendees from '@/pages/coach/SessionAttendees';
import AttendanceRecording from '@/pages/coach/AttendanceRecording';

// Layouts
import ClientLayout from '@/components/layouts/ClientLayout';
import CoachLayout from '@/components/layouts/CoachLayout';
import AdminLayout from '@/components/layouts/AdminLayout';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ClientManagement from '@/pages/admin/ClientManagement';
import PlayerManagement from '@/pages/admin/PlayerManagement';
import CoachManagement from '@/pages/admin/CoachManagement';
import SessionManagement from '@/pages/admin/SessionManagement';
import CreateSession from '@/pages/admin/CreateSession';
import EditSession from '@/pages/admin/EditSession';
import LocationManagement from '@/pages/admin/LocationManagement';
import SessionTypeManagement from '@/pages/admin/SessionTypeManagement';
import BookingManagement from '@/pages/admin/BookingManagement';
import AttendanceManagement from '@/pages/admin/AttendanceManagement';
import PackageManagement from '@/pages/admin/PackageManagement';
import PaymentManagement from '@/pages/admin/PaymentManagement';
import CreditManagement from '@/pages/admin/CreditManagement';
import NotificationManagement from '@/pages/admin/NotificationManagement';
import Reports from '@/pages/admin/Reports';
import AuditLog from '@/pages/admin/AuditLog';
import AppSettings from '@/pages/admin/AppSettings';

const AppRoutes = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0F172A]">
        <div className="w-8 h-8 border-4 border-white/10 border-t-[#2563EB] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route element={<AppProtectedRoute allowedRoles={['client', 'coach', 'head_coach', 'admin']} />}>
        <Route element={<ClientLayout><Outlet /></ClientLayout>}>
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/sessions" element={<SessionCatalogue />} />
          <Route path="/sessions/:id" element={<SessionDetails />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/bookings" element={<UpcomingBookings />} />
          <Route path="/bookings/:id" element={<BookingDetails />} />
          <Route path="/bookings/:id/reschedule" element={<RescheduleBooking />} />
          <Route path="/bookings/:id/cancel" element={<CancelBooking />} />
          <Route path="/payment/result" element={<PaymentResult />} />
          <Route path="/players" element={<PlayerList />} />
          <Route path="/players/new" element={<CreatePlayer />} />
          <Route path="/players/:id/edit" element={<EditPlayer />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/credits" element={<CreditBalance />} />
          <Route path="/purchases" element={<PurchaseHistory />} />
          <Route path="/notifications" element={<ClientNotifications />} />
          <Route path="/account" element={<AccountDetails />} />
        </Route>
      </Route>

      <Route element={<AppProtectedRoute allowedRoles={['coach', 'head_coach', 'admin']} />}>
        <Route element={<CoachLayout><Outlet /></CoachLayout>}>
          <Route path="/coach" element={<CoachDashboard />} />
          <Route path="/coach/sessions" element={<CoachSessions />} />
          <Route path="/coach/sessions/:id/attendees" element={<SessionAttendees />} />
          <Route path="/coach/sessions/:id/attendance" element={<AttendanceRecording />} />
        </Route>
      </Route>

      <Route element={<AppProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AdminLayout><Outlet /></AdminLayout>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/clients" element={<ClientManagement />} />
          <Route path="/admin/players" element={<PlayerManagement />} />
          <Route path="/admin/coaches" element={<CoachManagement />} />
          <Route path="/admin/sessions" element={<SessionManagement />} />
          <Route path="/admin/sessions/new" element={<CreateSession />} />
          <Route path="/admin/sessions/:id/edit" element={<EditSession />} />
          <Route path="/admin/locations" element={<LocationManagement />} />
          <Route path="/admin/session-types" element={<SessionTypeManagement />} />
          <Route path="/admin/bookings" element={<BookingManagement />} />
          <Route path="/admin/attendance" element={<AttendanceManagement />} />
          <Route path="/admin/packages" element={<PackageManagement />} />
          <Route path="/admin/payments" element={<PaymentManagement />} />
          <Route path="/admin/credits" element={<CreditManagement />} />
          <Route path="/admin/notifications" element={<NotificationManagement />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/admin/settings" element={<AppSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <Base44PreviewProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AppRoutes />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </Base44PreviewProvider>
  );
}

export default App;