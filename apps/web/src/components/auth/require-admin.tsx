import { Navigate } from 'react-router-dom';
import { getSession } from '../../lib/auth';
import { canAdmin } from '../../lib/utils';

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const session = getSession();
  if (!session || !canAdmin(session.roles)) {
    return <Navigate to="/products" replace />;
  }
  return <>{children}</>;
}
