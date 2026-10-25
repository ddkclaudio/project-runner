import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { RegisterForm } from '@/components/features/auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm';
import { HomePage } from '@/pages/HomePage';
import { ComponentsPage } from '@/pages/ComponentsPage';

function BootScreen() {
  return <div style={{ minHeight: '100dvh', background: 'var(--bg-base)' }} />;
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export const routes = [
  {
    element: <GuestOnly />,
    children: [
      { path: '/login', element: <LoginForm /> },
      { path: '/register', element: <RegisterForm /> },
      { path: '/forgot-password', element: <ForgotPasswordForm /> },
      { path: '/reset-password', element: <ResetPasswordForm /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/components', element: <ComponentsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
