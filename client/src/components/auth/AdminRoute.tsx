import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/store";

type AdminRouteProps = {
  children: ReactNode;
};

export default function AdminRoute({ children }: AdminRouteProps) {
  const [, setLocation] = useLocation();
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) return null;

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (user.role !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <h2 className="text-2xl font-bold text-foreground">Not Authorized</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          You don’t have access to this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
