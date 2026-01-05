import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/store";

type ProtectedRouteProps = {
  children: ReactNode;
};

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) return null;

  if (!user) {
    setLocation("/login");
    return null;
  }

  return <>{children}</>;
}
