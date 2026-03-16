export function SimulatorPage() {
  return (
    <section className="page-stack">
      <div className="hero-card">
        <span className="eyebrow">Admin Route</span>
        <h2>Simulator control surface</h2>
        <p>
          This route is intentionally restricted to users with the <code>admin</code> role. It
          proves the frontend role gate is active before the visual simulator UI lands.
        </p>
      </div>

      <div className="content-card">
        <h3>What comes next</h3>
        <p>
          E5 will replace this stub with the interactive mock sensor environment. For now, this
          page confirms the Keycloak session exposes roles to the React app and that protected
          routes can branch on them.
        </p>
      </div>
    </section>
  );
}
