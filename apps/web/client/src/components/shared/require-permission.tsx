import { useAuth } from '@/hooks/use-auth';
import { hasPermission, Permission } from '@/lib/permissions';

interface Props {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * UX guard — renders children only if the current user has the required permission.
 * This is UX ONLY. Backend always enforces permissions independently.
 */
export function RequirePermissionUI({ permission, children, fallback = null }: Props) {
  const { user } = useAuth();
  if (!user) return <>{fallback}</>;
  const allowed = hasPermission(user.role, permission, !!user.is_platform_admin);
  return <>{allowed ? children : fallback}</>;
}

/**
 * Returns true if the current user has the given permission.
 * Use for conditional rendering in JSX without a wrapper component.
 */
export function useCanI(permission: Permission): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role, permission, !!user.is_platform_admin);
}
