import clsx from "clsx";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { NotificationBell } from "../components/NotificationBell";

export function DashboardLayout() {
  const { logout, user } = useAuth();
  const simulatorEnabled =
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_SIMULATOR !== "false" &&
    Boolean(user?.roles.includes("admin"));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">MaaSAI Consumer Dashboard</span>
          <h1 className="headline">Production visibility without blockchain jargon</h1>
        </div>
        <div className="topbar-actions">
          <NotificationBell />

          <div className="account-card">
            <div>
              <p className="account-label">Signed in as</p>
              <strong>{user?.email ?? user?.name ?? "Unknown user"}</strong>
            </div>
            <button className="ghost-button" onClick={() => void logout()} type="button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="content-grid">
        <aside className="side-panel">
          <div className="shell-sidebar-header">
            <span className="eyebrow">Workspace</span>
            <div className="shell-sidebar-copy">
              <h2>Contracts</h2>
              <p>Your consumer routes, scoped to the contracts in your token claims.</p>
            </div>
          </div>

          <nav className="nav-stack" aria-label="Dashboard navigation">
            <NavLink
              className={({ isActive }) =>
                clsx("nav-link", {
                  active: isActive,
                })
              }
              to="/contracts"
            >
              Contracts
            </NavLink>
            {simulatorEnabled ? (
              <NavLink
                className={({ isActive }) =>
                  clsx("nav-link", {
                    active: isActive,
                  })
                }
                to="/simulator"
              >
                Simulator
              </NavLink>
            ) : null}
          </nav>

          <section className="info-card">
            <h2>Session scope</h2>
            <dl className="user-metadata-list">
              <div>
                <dt>Roles</dt>
                <dd>{user?.roles.join(", ") || "none"}</dd>
              </div>
              <div>
                <dt>Contracts</dt>
                <dd>{user?.contractIds.join(", ") || "none"}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <main className="page-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
