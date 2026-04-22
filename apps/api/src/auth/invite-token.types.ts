export interface InviteTokenPayload {
  type: 'workspace-invite';
  email: string;
  workspace_id: string;
  workspace_slug: string;
}
