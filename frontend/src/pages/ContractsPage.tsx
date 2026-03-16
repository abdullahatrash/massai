import { startTransition, useEffect, useState } from "react";

import { ApiError, apiRequest } from "../api/client";

type AuthProfile = {
  contract_ids: string[];
  email: string | null;
  id: string;
  preferred_username: string | null;
  roles: string[];
};

type LoadState =
  | { status: "loading" }
  | { status: "success"; profile: AuthProfile }
  | { status: "error"; message: string };

export function ContractsPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      startTransition(() => setState({ status: "loading" }));

      try {
        const profile = await apiRequest<AuthProfile>("/api/v1/auth/me");
        if (!isActive) {
          return;
        }
        startTransition(() => setState({ status: "success", profile }));
      } catch (error) {
        if (!isActive) {
          return;
        }
        const message =
          error instanceof ApiError ? error.message : "Unable to load the authenticated profile.";
        startTransition(() => setState({ status: "error", message }));
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="page-stack">
      <div className="hero-card">
        <span className="eyebrow">Protected Route</span>
        <h2>Contracts workspace</h2>
        <p>
          This page uses the access token from Keycloak and calls the protected backend route
          <code> /api/v1/auth/me</code>.
        </p>
      </div>

      {state.status === "loading" ? (
        <div className="content-card">
          <h3>Loading your session details</h3>
          <p>Waiting for the backend to confirm the token and return your scoped claims.</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="content-card error-card">
          <h3>Backend auth call failed</h3>
          <p>{state.message}</p>
        </div>
      ) : null}

      {state.status === "success" ? (
        <div className="content-card">
          <h3>Authenticated profile</h3>
          <dl className="profile-grid">
            <div>
              <dt>User ID</dt>
              <dd>{state.profile.id}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{state.profile.email ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{state.profile.preferred_username ?? "Unavailable"}</dd>
            </div>
          </dl>

          <div className="claim-block">
            <h4>Roles</h4>
            <div className="chip-row">
              {state.profile.roles.map((role) => (
                <span className="chip" key={role}>
                  {role}
                </span>
              ))}
            </div>
          </div>

          <div className="claim-block">
            <h4>Contract IDs</h4>
            <div className="chip-row">
              {state.profile.contract_ids.map((contractId) => (
                <span className="chip accent" key={contractId}>
                  {contractId}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
