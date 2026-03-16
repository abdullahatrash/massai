import clsx from "clsx";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useParams } from "react-router-dom";

import { listActiveAlerts } from "../api/alerts";
import { ApiError } from "../api/client";
import {
  getContractOverview,
  getPilotPresentation,
  type ContractOverview,
} from "../api/contracts";
import { NotFoundPage } from "./NotFoundPage";

export type ContractOutletContext = {
  contract: ContractOverview;
};

const contractSectionLinks: Array<{
  end?: boolean;
  label: string;
  to: string;
}> = [
  {
    end: true,
    label: "Overview",
    to: ".",
  },
  {
    label: "Milestones",
    to: "milestones",
  },
  {
    label: "Live Feed",
    to: "feed",
  },
  {
    label: "Alerts",
    to: "alerts",
  },
  {
    label: "Documents",
    to: "documents",
  },
  {
    label: "Analytics",
    to: "analytics",
  },
];

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "Not scheduled";
  }

  return format(parseISO(value), "d MMM yyyy");
}

function getNextMilestoneLabel(contract: ContractOverview): string {
  if (!contract.nextMilestone) {
    return "No upcoming milestone";
  }

  const relativeTime = formatDistanceToNowStrict(parseISO(contract.nextMilestone.plannedDate), {
    addSuffix: true,
  });

  return `${contract.nextMilestone.name} (${relativeTime})`;
}

export function ContractRouteLayout() {
  const { contractId } = useParams();

  const contractQuery = useQuery({
    enabled: Boolean(contractId),
    queryFn: () => getContractOverview(contractId!),
    queryKey: ["contract-overview", contractId],
  });
  const alertsQuery = useQuery({
    enabled: Boolean(contractId),
    queryFn: () => listActiveAlerts(contractId!),
    queryKey: ["contract-alerts", contractId],
  });

  if (!contractId) {
    return (
      <NotFoundPage
        actionLabel="Open contracts"
        actionTo="/contracts"
        description="No contract identifier was provided in the route."
        title="Contract not found"
      />
    );
  }

  if (contractQuery.isPending) {
    return (
      <section className="page-stack">
        <div className="hero-card">
          <span className="eyebrow">Loading contract</span>
          <h2>Preparing contract workspace</h2>
          <p>Fetching the overview that anchors the routed pages for this contract.</p>
        </div>
      </section>
    );
  }

  if (contractQuery.error instanceof ApiError && contractQuery.error.status === 404) {
    return (
      <NotFoundPage
        actionLabel="Back to contracts"
        actionTo="/contracts"
        description={`We could not find a contract matching "${contractId}".`}
        title="Contract not found"
      />
    );
  }

  if (contractQuery.error) {
    return (
      <section className="page-stack">
        <div className="content-card error-card">
          <h3>Unable to load this contract</h3>
          <p>{contractQuery.error.message}</p>
          <button
            className="primary-button"
            onClick={() => void contractQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  const contract = contractQuery.data;
  const pilot = getPilotPresentation(contract.pilotType);

  return (
    <section className="page-stack">
      <div className="hero-card contract-hero-card">
        <div className="contract-header-grid">
          <div>
            <span className={`contract-pilot-chip ${pilot.className}`}>{pilot.label}</span>
            <h2>{contract.productName}</h2>
            <p>
              Contract <code>{contract.id}</code> routed through the shared dashboard scaffold.
            </p>
          </div>
          <div className="contract-summary-grid">
            <article className="contract-summary-card">
              <span>Delivery date</span>
              <strong>{formatDateLabel(contract.deliveryDate)}</strong>
            </article>
            <article className="contract-summary-card">
              <span>Status</span>
              <strong>{contract.statusBadge}</strong>
            </article>
            <article className="contract-summary-card">
              <span>Progress</span>
              <strong>
                {contract.milestonesCompleted}/{contract.milestonesTotal} milestones
              </strong>
            </article>
            <article className="contract-summary-card">
              <span>Next milestone</span>
              <strong>{getNextMilestoneLabel(contract)}</strong>
            </article>
          </div>
        </div>
      </div>

      <nav aria-label="Contract sections" className="contract-tab-bar">
        {contractSectionLinks.map((item) => (
          <NavLink
            className={({ isActive }) =>
              clsx("contract-tab-link", {
                active: isActive,
              })
            }
            end={item.end}
            key={item.label}
            to={item.to}
          >
            <span>{item.label}</span>
            {item.label === "Alerts" && (alertsQuery.data?.length ?? 0) > 0 ? (
              <span className="tab-count-badge">{alertsQuery.data?.length}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ contract }} />
    </section>
  );
}
