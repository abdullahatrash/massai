import { Link, useOutletContext } from "react-router-dom";

import { type SimulatorOutletContext, getPilotMeta } from "./simulatorShared";

export function SimulatorIndex() {
  const { connectionState, contractsState } = useOutletContext<SimulatorOutletContext>();

  return (
    <section className="simulator-panel-stack">
      <div className="simulator-hero-card">
        <span className="simulator-section-kicker">Factory Simulator</span>
        <h2>Pick a seeded contract to open its pilot simulator</h2>
        <p>
          This workspace stays separate from the consumer dashboard so demos and ingest testing are
          unmistakably on the factory side.
        </p>
      </div>

      <div className="simulator-summary-grid">
        <article className="simulator-detail-card">
          <h3>Connection status</h3>
          <p>{connectionState.details}</p>
        </article>

        <article className="simulator-detail-card">
          <h3>Factory contracts</h3>
          <p>
            {contractsState.status === "success"
              ? `${contractsState.contracts.length} seeded contracts are ready for simulation.`
              : "The simulator contract index will appear here after the backend responds."}
          </p>
        </article>
      </div>

      {contractsState.status === "success" ? (
        <div className="simulator-contract-card-grid">
          {contractsState.contracts.map((contract) => {
            const pilotMeta = getPilotMeta(contract.pilotType);

            return (
              <Link className="simulator-overview-card" key={contract.id} to={`/simulator/${contract.id}`}>
                <span className={`simulator-contract-icon ${pilotMeta.accentClass}`}>
                  {pilotMeta.icon}
                </span>
                <div>
                  <strong>{pilotMeta.label} pilot</strong>
                  <p>{contract.productName ?? contract.id}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
