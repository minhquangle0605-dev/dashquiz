import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    const bufferMs = 30_000;
    return Date.now() >= payload.exp * 1000 - bufferMs;
  } catch {
    return true;
  }
}

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  const isAuthenticated =
    user !== null &&
    accessToken !== null &&
    accessToken.length > 0 &&
    !isTokenExpired(accessToken);

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Force a first-login / admin-reset password change before anything else.
  if (user.mustChangePassword && location.pathname !== ROUTES.CHANGE_PASSWORD) {
    return <Navigate to={ROUTES.CHANGE_PASSWORD} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />;
  }

  return <Outlet />;
}
