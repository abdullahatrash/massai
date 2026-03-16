import { format, isValid, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  formatProviderName,
  getPilotIconGlyph,
  getPilotPresentation,
  listContracts,
  type ContractListItem,
  type ContractStatusBadge,
} from "../api/contracts";
import { StatusBadge } from "../components/StatusBadge";
import { MilestoneProgressBar } from "../components/MilestoneProgressBar";

function statusPriority(status: ContractStatusBadge): number {
  switch (status) {
    case "ACTION_REQUIRED":
      return 0;
    case "DELAYED":
      return 1;
    case "ON_TRACK":
      return 2;
    case "COMPLETED":
      return 3;
    case "DISPUTED":
      return 4;
    default:
      return 5;
  }
}

function sortContracts(contracts: ContractListItem[]): ContractListItem[] {
  return [...contracts].sort((left, right) => {
    const statusDelta = statusPriority(left.statusBadge) - statusPriority(right.statusBadge);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const leftTime = left.deliveryDate ? Date.parse(left.deliveryDate) : Number.POSITIVE_INFINITY;
    const rightTime = right.deliveryDate
      ? Date.parse(right.deliveryDate)
      : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return (left.productName ?? left.id).localeCompare(right.productName ?? right.id);
  });
}

function formatDeliveryDate(value: string | null): string {
  if (!value) {
    return "Delivery date not set";
  }

  const parsedDate = parseISO(value);
  if (!isValid(parsedDate)) {
    return value;
  }

  return format(parsedDate, "d MMM yyyy");
}

function ContractsListSkeleton() {
  return (
    <div className="contracts-card-grid" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <article className="contract-list-card skeleton-card" key={index}>
          <div className="contract-list-topline">
            <div className="skeleton-chip" />
            <div className="skeleton-pill" />
          </div>
          <div className="skeleton-heading" />
          <div className="skeleton-text-row wide" />
          <div className="skeleton-text-row" />
          <div className="skeleton-progress" />
        </article>
      ))}
    </div>
  );
}

function ContractCard({ contract }: { contract: ContractListItem }) {
  const pilot = getPilotPresentation(contract.pilotType);
  const providerName = formatProviderName(contract.providerId);
  const productName = contract.productName ?? contract.id;

  return (
    <Link className="contract-list-card" to={`/contracts/${contract.id}`}>
      <div className="contract-list-topline">
        <span className={`contract-list-pilot ${pilot.className}`}>
          <span aria-hidden="true" className="contract-list-pilot-icon">
            {getPilotIconGlyph(contract.pilotType)}
          </span>
          {pilot.label}
        </span>
        <StatusBadge status={contract.statusBadge} />
      </div>

      <div className="contract-list-copy">
        <h3>{productName}</h3>
        <p>{providerName}</p>
      </div>

      <dl className="contract-list-meta">
        <div>
          <dt>Contract ID</dt>
          <dd>{contract.id}</dd>
        </div>
        <div>
          <dt>Delivery date</dt>
          <dd>{formatDeliveryDate(contract.deliveryDate)}</dd>
        </div>
      </dl>

      <MilestoneProgressBar
        completed={contract.milestonesCompleted}
        total={contract.milestonesTotal}
      />
    </Link>
  );
}

export function ContractsList() {
  const contractsQuery = useQuery({
    queryFn: () => listContracts(),
    queryKey: ["contracts"],
    select: (response) => ({
      contracts: sortContracts(response.data),
      meta: response.meta,
    }),
  });

  const contractCount = contractsQuery.data?.contracts.length ?? 0;
  const unreadNotifications = contractsQuery.data?.meta?.unreadNotifications ?? 0;

  return (
    <section className="page-stack">
      <div className="hero-card contracts-hero-card">
        <span className="eyebrow">Contracts</span>
        <h2>Your active production contracts</h2>
        <p>
          Review delivery status, milestone progress, and which contracts need attention without
          leaving the dashboard.
        </p>

        <div className="contracts-overview-strip">
          <article className="contracts-overview-card">
            <span>Visible contracts</span>
            <strong>{contractCount}</strong>
          </article>
          <article className="contracts-overview-card">
            <span>Unread notifications</span>
            <strong>{unreadNotifications}</strong>
          </article>
          <article className="contracts-overview-card">
            <span>Priority rule</span>
            <strong>Action required stays on top</strong>
          </article>
        </div>
      </div>

      {contractsQuery.isPending ? <ContractsListSkeleton /> : null}

      {contractsQuery.isError ? (
        <div className="content-card error-card">
          <h3>Unable to load contracts</h3>
          <p>{contractsQuery.error.message}</p>
          <button className="primary-button" onClick={() => void contractsQuery.refetch()} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {contractsQuery.isSuccess && contractsQuery.data.contracts.length === 0 ? (
        <div className="content-card empty-state-card">
          <h3>No contracts are assigned to this account</h3>
          <p>
            Once a contract is linked to your consumer identity, it will appear here with progress,
            alerts, and delivery status.
          </p>
        </div>
      ) : null}

      {contractsQuery.isSuccess && contractsQuery.data.contracts.length > 0 ? (
        <div className="contracts-card-grid">
          {contractsQuery.data.contracts.map((contract) => (
            <ContractCard contract={contract} key={contract.id} />
          ))}
        </div>
      ) : null}

      {contractsQuery.isSuccess && contractsQuery.data.contracts.length > 0 ? (
        <div className="content-card contracts-footnote-card">
          <h3>List behavior</h3>
          <p>
            Cards stay client-side navigable through React Router, and any contract marked
            <code>ACTION_REQUIRED</code> is promoted to the top of the list.
          </p>
          <Link className="scaffold-link ghost-button" to={`/contracts/${contractsQuery.data.contracts[0]?.id}`}>
            Open top priority contract
          </Link>
        </div>
      ) : null}
    </section>
  );
}
