import { format, parseISO } from "date-fns";
import { useOutletContext } from "react-router-dom";

import type { ContractOutletContext } from "./ContractRouteLayout";

type ContractScaffoldPageProps = {
  body: string;
  eyebrow: string;
  title: string;
};

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "Not scheduled";
  }

  return format(parseISO(value), "d MMM yyyy");
}

export function ContractScaffoldPage({
  body,
  eyebrow,
  title,
}: ContractScaffoldPageProps) {
  const { contract } = useOutletContext<ContractOutletContext>();

  return (
    <div className="content-card placeholder-card">
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{body}</p>

      <dl className="placeholder-metadata-grid">
        <div>
          <dt>Contract</dt>
          <dd>{contract.id}</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>{formatDateLabel(contract.deliveryDate)}</dd>
        </div>
        <div>
          <dt>Status badge</dt>
          <dd>{contract.statusBadge}</dd>
        </div>
        <div>
          <dt>Milestones</dt>
          <dd>
            {contract.milestonesCompleted}/{contract.milestonesTotal}
          </dd>
        </div>
      </dl>
    </div>
  );
}
