import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { PremiumLoader } from "@/components/shared/PremiumLoader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Required roles to access this route. If undefined, any authenticated user passes. */
  roles?: Array<"admin" | "super_admin" | "comercial" | "disenador" | "jefe_taller" | "operario">;
  /** Where to redirect unauthenticated users. */
  redirectTo?: string;
}

/**
 * Gate component for routes that require authentication.
 *
 * Behavior:
 *  - While auth is initializing → show loader
 *  - If not authenticated → redirect to /login, preserving the intended URL
 *  - If authenticated but missing required role → redirect to /
 *  - Otherwise → render children
 */
export function ProtectedRoute({ children, roles, redirectTo = "/login" }: ProtectedRouteProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const initialized = useAuthStore((s) => s.initialized);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Auth state hasn't loaded yet — don't redirect, wait.
  if (!initialized || isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Verificando sesión" />
      </div>
    );
  }

  // Not authenticated → bounce to login (and remember where we wanted to go).
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // Authenticated but lacking required role → bounce to home.
  if (roles && roles.length > 0) {
    const userRole = (profile?.role || "") as (typeof roles)[number];
    if (!roles.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
