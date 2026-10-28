import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { LoginForm } from '@/components/features/auth/LoginForm';
import { RegisterForm } from '@/components/features/auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/features/auth/ForgotPasswordForm';
import { ResetPasswordForm } from '@/components/features/auth/ResetPasswordForm';
import { HomePage } from '@/pages/HomePage';
import { CommunicationsPage } from '@/pages/CommunicationsPage';
import { ComponentsPage } from '@/pages/ComponentsPage';
import { NewAppPage } from '@/pages/NewAppPage';
import { AppPage } from '@/pages/AppPage';
import { CatalogPage } from '@/pages/CatalogPage';
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage';
import { LegacyAppRedirect, LegacyFolderRedirect } from '@/pages/LegacyAppRedirect';
import { NewOrgPage } from '@/pages/NewOrgPage';
import { OrgsPage } from '@/pages/OrgsPage';
import { OrgMembersPage } from '@/pages/OrgMembersPage';
import { AcceptInvitePage } from '@/pages/AcceptInvitePage';
import { OrgProvider } from '@/contexts/OrgContext';

function BootScreen() {
  return <div style={{ minHeight: '100dvh', background: 'var(--bg-base)' }} />;
}

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <OrgProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </OrgProvider>
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
      { path: '/comunicacoes', element: <CommunicationsPage /> },
      { path: '/catalog', element: <CatalogPage mode="remote" /> },
      { path: '/catalog/files', element: <CatalogPage mode="files" /> },
      { path: '/settings', element: <Navigate to="/settings/profile" replace /> },
      { path: '/settings/profile', element: <ProfileSettingsPage /> },
      { path: '/settings/github', element: <Navigate to="/settings/profile" replace /> },
      { path: '/settings/appearance', element: <Navigate to="/settings/profile" replace /> },
      { path: '/settings/launch', element: <Navigate to="/settings/profile" replace /> },
      { path: '/apps/new', element: <NewAppPage /> },
      { path: '/app/:folder', element: <AppPage /> },
      { path: '/app/:folder/:section', element: <AppPage /> },
      { path: '/apps/f/:folder', element: <LegacyFolderRedirect /> },
      { path: '/apps/f/:folder/:section', element: <LegacyFolderRedirect /> },
      { path: '/apps/:owner/:repo', element: <LegacyAppRedirect /> },
      { path: '/apps/:owner/:repo/:section', element: <LegacyAppRedirect /> },
      { path: '/orgs', element: <OrgsPage /> },
      { path: '/orgs/new', element: <NewOrgPage /> },
      { path: '/orgs/invite', element: <AcceptInvitePage /> },
      { path: '/orgs/:orgId/members', element: <OrgMembersPage /> },
      { path: '/components', element: <ComponentsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
