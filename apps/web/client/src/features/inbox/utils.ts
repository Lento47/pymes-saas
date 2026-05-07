import type { ChannelTab, ConversationStatusFilter, InboxConversation } from "./types";

export function buildConversationQueryParams(input: {
  search: string;
  statusFilter: ConversationStatusFilter;
  channelTab: ChannelTab;
  assignedUserId?: string;
}): Record<string, string> {
  const params: Record<string, string> = {};

  if (input.search.trim()) {
    params.q = input.search.trim();
  }

  if (input.statusFilter !== "ALL") {
    params.status = input.statusFilter;
  }

  if (input.channelTab === "UNASSIGNED") {
    params.unassigned = "true";
  } else if (input.channelTab === "MINE") {
    if (input.assignedUserId) params.assigned_user_id = input.assignedUserId;
  } else if (input.channelTab !== "ALL") {
    params.channel_type = input.channelTab;
  }

  return params;
}

export function normalizeConversationResponse(
  data: any
): InboxConversation[] {
  return Array.isArray(data) ? data : data?.data || [];
}
