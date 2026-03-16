import { Link, NavLink, Outlet } from "react-router-dom";
import { startTransition, useEffect, useState } from "react";

import { ApiError, apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import {
  type ConnectionState,
  type SimulatorContract,
  type SimulatorOutletContext,
  getPilotMeta,
} from "./simulatorShared";

type HealthcheckPayload = {
  auth: string;
  db: string;
  environment: string;
  status: string;
};

type ContractsState =
  | { status: "loading" }
  | { status: "success"; contracts: SimulatorContract[] }
  | { status: "error"; message: string };

function formatConnectionState(connectionState: ConnectionState) {
  if (connectionState.status === "connected") {
    return "Connected";
  }

  if (connectionState.status === "unavailable") {
    return "Unavailable";
  }

  return "Checking";
}

export function SimulatorLayout() {
  const { logout, user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "checking",
    details: "Pinging backend API.",
  });
  const [contractsState, setContractsState] = useState<ContractsState>({ status: "loading" });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadSimulatorData() {
      startTransition(() => {
        setConnectionState({
          status: "checking",
          details: "Pinging backend API.",
        });
        setContractsState({ status: "loading" });
      });

      try {
        const [healthcheck, contracts] = await Promise.all([
          apiRequest<HealthcheckPayload>("/health"),
          apiRequest<SimulatorContract[]>("/api/v1/contracts"),
        ]);

        if (!isActive) {
          return;
        }

        startTransition(() => {
          setConnectionState({
            status: "connected",
            details:
              healthcheck.status === "ok"
                ? `Backend reachable in ${healthcheck.environment}.`
                : `Backend reachable with ${healthcheck.status} dependencies.`,
          });
          setContractsState({
            status: "success",
            contracts,
          });
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof ApiError
            ? error.message
            : "Unable to load the simulator control surface.";

        startTransition(() => {
          setConnectionState({
            status: "unavailable",
            details: "Backend API is not reachable right now.",
          });
          setContractsState({
            status: "error",
            message,
          });
        });
      }
    }

    void loadSimulatorData();

    return () => {
      isActive = false;
    };
  }, [requestVersion]);

  const context: SimulatorOutletContext = {
    connectionState,
    contractsState,
    refreshSimulatorData: () => {
      startTransition(() => {
        setRequestVersion((currentVersion) => currentVersion + 1);
      });
    },
  };

  return (
    <div className="simulator-shell">
      <header className="simulator-topbar">
        <div className="simulator-title-block">
          <span className="simulator-badge">Factory Simulator</span>
          <h1 className="simulator-headline">Factory-side sensor control room</h1>
          <p className="simulator-subtitle">
            Development-only workspace for seeded contracts, scenario playback, and manual test
            sends.
          </p>
        </div>

        <div className="simulator-actions">
          <div className={`simulator-connection ${connectionState.status}`}>
            <span className="simulator-connection-label">API status</span>
            <strong>{formatConnectionState(connectionState)}</strong>
            <span>{connectionState.details}</span>
          </div>

          <div className="simulator-account-card">
            <span className="simulator-account-label">Signed in as</span>
            <strong>{user?.email ?? "Unknown admin"}</strong>
            <span>Roles: {user?.roles.join(", ") || "none"}</span>
          </div>

          <div className="simulator-action-row">
            <button
              className="ghost-button simulator-button"
              onClick={context.refreshSimulatorData}
              type="button"
            >
              Refresh
            </button>
            <Link className="ghost-button simulator-button simulator-link-button" to="/contracts">
              Consumer dashboard
            </Link>
            <button className="ghost-button simulator-button" onClick={() => void logout()} type="button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="simulator-grid">
        <aside className="simulator-sidebar">
          <div className="simulator-sidebar-copy">
            <h2>Seeded contracts</h2>
            <p>Select a pilot contract to load its simulator panel.</p>
          </div>

          {contractsState.status === "loading" ? (
            <div className="simulator-state-card">
              <h3>Loading contracts</h3>
              <p>Connecting to the backend and pulling the seeded pilot list.</p>
            </div>
          ) : null}

          {contractsState.status === "error" ? (
            <div className="simulator-state-card simulator-state-card-error">
              <h3>Contracts unavailable</h3>
              <p>{contractsState.message}</p>
            </div>
          ) : null}

          {contractsState.status === "success" ? (
            <nav aria-label="Simulator contracts" className="simulator-contract-list">
              {contractsState.contracts.map((contract) => {
                const pilotMeta = getPilotMeta(contract.pilotType);

                return (
                  <NavLink
                    className={({ isActive }) =>
                      isActive
                        ? "simulator-contract-link active"
                        : "simulator-contract-link"
                    }
                    key={contract.id}
                    to={`/simulator/${contract.id}`}
                  >
                    <span className={`simulator-contract-icon ${pilotMeta.accentClass}`}>
                      {pilotMeta.icon}
                    </span>

                    <span className="simulator-contract-copy">
                      <strong>{contract.productName ?? contract.id}</strong>
                      <span>{pilotMeta.label.toUpperCase()}</span>
                      <span>{contract.id}</span>
                    </span>

                    <span className="simulator-contract-progress">
                      {contract.milestonesCompleted}/{contract.milestonesTotal}
                    </span>
                  </NavLink>
                );
              })}
            </nav>
          ) : null}
        </aside>

        <main className="simulator-main-panel">
          <Outlet context={context} />
        </main>
      </div>
    </div>
  );
}
