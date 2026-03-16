import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

type ProtectedRouteProps = {
  requiredRole?: string;
};

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { error, isAuthenticated, isReady, login, user } = useAuth();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      void login();
    }
  }, [isAuthenticated, isReady, login]);

  if (!isReady) {
    return (
      <section className="app-shell status-shell">
        <div className="status-card">
          <span className="eyebrow">Authentication</span>
          <h1>Preparing your session</h1>
          <p>Checking your Keycloak session and refreshing access if needed.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="app-shell status-shell">
        <div className="status-card">
          <span className="eyebrow">Authentication Error</span>
          <h1>Keycloak did not initialize cleanly</h1>
          <p>{error}</p>
          <button className="primary-button" onClick={() => void login()} type="button">
            Retry login
          </button>
        </div>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="app-shell status-shell">
        <div className="status-card">
          <span className="eyebrow">Authentication</span>
          <h1>Redirecting to Keycloak</h1>
          <p>Your session is not active yet. We&apos;re sending you to the login flow now.</p>
        </div>
      </section>
    );
  }

  if (requiredRole && !user?.roles.includes(requiredRole)) {
    return (
      <section className="app-shell status-shell">
        <div className="status-card">
          <span className="eyebrow">Access Restricted</span>
          <h1>This route is limited to {requiredRole} users</h1>
          <p>Your current roles are {user?.roles.join(", ") || "none"}.</p>
        </div>
      </section>
    );
  }

  return <Outlet />;
}
