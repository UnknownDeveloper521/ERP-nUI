import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/store";
import { useHasPermission } from "@/hooks/usePermissions";

type ProtectedRouteProps = {
  children: ReactNode;
  moduleName?: string;
};

export default function ProtectedRoute({ children, moduleName }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthLoading } = useAuth();
  const { hasPermission } = useHasPermission();

  useEffect(() => {
    if (!isAuthLoading && !user) {
      setLocation("/login");
    } else if (!isAuthLoading && user && moduleName && !hasPermission(moduleName, 'view')) {
      setLocation("/unauthorized");
    }
  }, [user, isAuthLoading, moduleName, hasPermission, setLocation]);

  if (isAuthLoading) return null;

  if (!user) return null;

  if (moduleName && !hasPermission(moduleName, 'view')) return null;

  return <>{children}</>;
}
