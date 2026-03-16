import { startTransition, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { EventLogPanel } from "./EventLogPanel";
import { MilestoneTriggerPanel } from "./MilestoneTriggerPanel";
import { type SimulatorOutletContext, getPilotMeta } from "./simulatorShared";
import { ManualSendForm } from "./ManualSendForm";
import { ScenarioRunner } from "./ScenarioRunner";

function formatDeliveryDate(deliveryDate: string | null) {
  if (!deliveryDate) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(deliveryDate));
}

export function ContractSimulator() {
  const { contractId } = useParams();
  const { contractsState, refreshSimulatorData } = useOutletContext<SimulatorOutletContext>();
  const [activeTab, setActiveTab] = useState<"manual" | "milestones" | "scenarios">("scenarios");

  if (contractsState.status === "loading") {
    return (
      <section className="simulator-panel-stack">
        <div className="simulator-detail-card">
          <h2>Loading contract simulator</h2>
          <p>Waiting for the seeded contract list before we mount the pilot controls.</p>
        </div>
      </section>
    );
  }

  if (contractsState.status === "error") {
    return (
      <section className="simulator-panel-stack">
        <div className="simulator-detail-card simulator-state-card-error">
          <h2>Simulator unavailable</h2>
          <p>{contractsState.message}</p>
        </div>
      </section>
    );
  }

  const contract = contractsState.contracts.find((entry) => entry.id === contractId);

  if (!contract) {
    return (
      <section className="simulator-panel-stack">
        <div className="simulator-detail-card simulator-state-card-error">
          <h2>Contract not found</h2>
          <p>The requested seeded contract is not available in this simulator session.</p>
        </div>
      </section>
    );
  }

  const pilotMeta = getPilotMeta(contract.pilotType);
  const progressRatio =
    contract.milestonesTotal > 0
      ? Math.round((contract.milestonesCompleted / contract.milestonesTotal) * 100)
      : 0;

  return (
    <section className="simulator-panel-stack">
      <div className="simulator-hero-card">
        <span className={`simulator-section-kicker ${pilotMeta.accentClass}`}>
          {pilotMeta.label.toUpperCase()}
        </span>
        <h2>{pilotMeta.simulatorHeading}</h2>
        <p>
          {contract.productName ?? contract.id} is loaded and ready for scenario playback, manual
          sends, milestone triggers, and event logging in the next Epic 5 tickets.
        </p>
      </div>

      <div className="simulator-summary-grid">
        <article className="simulator-detail-card">
          <h3>Contract</h3>
          <p>{contract.id}</p>
        </article>

        <article className="simulator-detail-card">
          <h3>Status badge</h3>
          <p>{contract.statusBadge}</p>
        </article>

        <article className="simulator-detail-card">
          <h3>Milestone progress</h3>
          <p>
            {contract.milestonesCompleted}/{contract.milestonesTotal} complete ({progressRatio}%)
          </p>
        </article>

        <article className="simulator-detail-card">
          <h3>Delivery target</h3>
          <p>{formatDeliveryDate(contract.deliveryDate)}</p>
        </article>
      </div>

      <div className="simulator-tab-bar" role="tablist" aria-label="Simulator tools">
        <button
          aria-selected={activeTab === "scenarios"}
          className={activeTab === "scenarios" ? "simulator-tab active" : "simulator-tab"}
          onClick={() => startTransition(() => setActiveTab("scenarios"))}
          role="tab"
          type="button"
        >
          Scenarios
        </button>
        <button
          aria-selected={activeTab === "manual"}
          className={activeTab === "manual" ? "simulator-tab active" : "simulator-tab"}
          onClick={() => startTransition(() => setActiveTab("manual"))}
          role="tab"
          type="button"
        >
          Manual Send
        </button>
        <button
          aria-selected={activeTab === "milestones"}
          className={activeTab === "milestones" ? "simulator-tab active" : "simulator-tab"}
          onClick={() => startTransition(() => setActiveTab("milestones"))}
          role="tab"
          type="button"
        >
          Milestones
        </button>
      </div>

      <div className="simulator-workspace-grid">
        <div>
          {activeTab === "scenarios" ? (
            <ScenarioRunner contract={contract} onPlaybackSettled={refreshSimulatorData} />
          ) : activeTab === "milestones" ? (
            <MilestoneTriggerPanel
              contract={contract}
              onSubmissionSettled={refreshSimulatorData}
            />
          ) : (
            <ManualSendForm contract={contract} onSubmitSettled={refreshSimulatorData} />
          )}
        </div>
        <EventLogPanel contractId={contract.id} />
      </div>

    </section>
  );
}
