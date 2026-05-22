// /chat is deprecated — Phase 2 of the agent/chat/support unification.
// The page hit the same backend endpoints as /agent (POST /agent/stream)
// with a subset of the UI; the only real difference was the absence of
// quick-action forms and the "escalar" button. Keeping a redirect here
// preserves bookmarks and external links while consolidating the code
// to a single component on /agent.
import { Redirect } from 'wouter';

export default function ChatPage() {
  return <Redirect to="/agent" replace />;
}
