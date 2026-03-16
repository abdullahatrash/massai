import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";

export function DashboardLayout() {
  const { logout, user } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">MaaSAI Consumer Dashboard</span>
          <h1 className="headline">Authenticated monitoring workspace</h1>
        </div>
        <div className="account-card">
          <div>
            <p className="account-label">Signed in as</p>
            <strong>{user?.email ?? "Unknown user"}</strong>
          </div>
          <button className="ghost-button" onClick={() => void logout()} type="button">
            Logout
          </button>
        </div>
      </header>

      <div className="content-grid">
        <aside className="side-panel">
          <nav className="nav-stack" aria-label="Dashboard navigation">
            <NavLink
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              to="/contracts"
            >
              Contracts
            </NavLink>
            {user?.roles.includes("admin") && (
              <NavLink
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
                to="/simulator"
              >
                Simulator
              </NavLink>
            )}
          </nav>

          <section className="info-card">
            <h2>Session claims</h2>
            <p>Roles: {user?.roles.join(", ") || "none"}</p>
            <p>Contracts: {user?.contractIds.join(", ") || "none"}</p>
          </section>
        </aside>

        <main className="page-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
