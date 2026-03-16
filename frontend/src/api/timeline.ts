import { apiRequest } from "./client";

export type TimelineEvent = {
  description: string;
  icon: string;
  id: string;
  timestamp: string;
  type: string;
};

export async function listTimeline(contractId: string): Promise<TimelineEvent[]> {
  return apiRequest<TimelineEvent[]>(`/api/v1/contracts/${contractId}/timeline`);
}
