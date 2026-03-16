import { format } from "date-fns";

import type { TimelineEvent } from "../api/timeline";

type ActivityFeedProps = {
  events: TimelineEvent[];
  isLoading?: boolean;
};

const timelineIcons: Record<string, string> = {
  "alert-triangle": "Alert",
  "check-circle": "Milestone",
  "file-check": "Record",
  flag: "Milestone",
  hourglass: "Approval",
  "x-circle": "Rejected",
};

function formatTimestamp(timestamp: string): string {
  return format(new Date(timestamp), "d MMM yyyy, HH:mm");
}

export function ActivityFeed({ events, isLoading = false }: ActivityFeedProps) {
  return (
    <section className="content-card activity-feed-card">
      <div className="section-header">
        <div>
          <span className="eyebrow">Recent activity</span>
          <h3>Latest contract events</h3>
        </div>
      </div>

      {isLoading ? <p>Loading the latest timeline events.</p> : null}

      {!isLoading && events.length === 0 ? (
        <p>No recent activity has been recorded for this contract yet.</p>
      ) : null}

      {!isLoading && events.length > 0 ? (
        <div className="activity-feed-list">
          {events.map((event) => (
            <article className="activity-feed-item" key={event.id}>
              <div className="activity-feed-badge">{timelineIcons[event.icon] ?? "Update"}</div>
              <div className="activity-feed-copy">
                <p>{event.description}</p>
                <span>{formatTimestamp(event.timestamp)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
