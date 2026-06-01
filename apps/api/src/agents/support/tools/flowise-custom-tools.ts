/**
 * Flowise Custom Tool Definitions for PymesHub Support Agents
 *
 * Each tool below is a Custom Tool node to create in Flowise UI
 * (Tools → Custom Tool → Add New).
 *
 * Copy the JavaScript Function into the Flowise Custom Tool editor.
 * Replace placeholder values (API keys, URLs) with real ones.
 *
 * Usage in Flowise:
 *  1. Go to Flowise UI → Tools → Custom Tool
 *  2. Create a new tool with the Name, Description, and Input Schema below
 *  3. Paste the JavaScript Function code
 *  4. Save
 *  5. The tool name appears in the Tool node dropdown when building chatflows
 */

// ═══════════════════════════════════════════════════════════════════
// CORE TOOLS — These are the minimum for agents to work
// ═══════════════════════════════════════════════════════════════════

export const TOOL_DEFINITIONS = {

  // ── Workspace & Database ────────────────────────────────────────

  "get_workspace_data": {
    name: "get_workspace_data",
    description: "Get full workspace info: plan, status, member count, channel config, recent errors. Use when diagnosing any issue.",
    inputSchema: `{
  "workspace_id": { "type": "string", "description": "The workspace ID", "required": true }
}`,
    jsFunction: `const fetch = require('node-fetch');
const API_BASE = process.env.PYMESHUB_API_URL || 'https://api.pymeshub.lat';
const API_KEY = process.env.PYMESHUB_API_KEY || 'YOUR_API_KEY';

const url = API_BASE + '/api/admin/workspace/' + $workspace_id + '/full-context';
const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }
};
try {
  const res = await fetch(url, options);
  const data = await res.json();
  return JSON.stringify(data, null, 2);
} catch (e) { return 'Error: ' + e.message; }`
  },

  "get_recent_errors": {
    name: "get_recent_errors",
    description: "Get recent error reports for a workspace. Use when diagnosing bugs, crashes, or unexpected behavior.",
    inputSchema: `{
  "workspace_id": { "type": "string", "description": "The workspace ID", "required": true },
  "limit": { "type": "number", "description": "Max errors to return (default 20)", "required": false }
}`,
    jsFunction: `const fetch = require('node-fetch');
const API_BASE = process.env.PYMESHUB_API_URL || 'https://api.pymeshub.lat';
const API_KEY = process.env.PYMESHUB_API_KEY || 'YOUR_API_KEY';
const limit = $limit || 20;

const url = API_BASE + '/api/admin/workspace/' + $workspace_id + '/errors?limit=' + limit;
const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }
};
try {
  const res = await fetch(url, options);
  const data = await res.json();
  return JSON.stringify(data, null, 2);
} catch (e) { return 'Error: ' + e.message; }`
  },

  // ── Channels ────────────────────────────────────────────────────

  "get_channel_status": {
    name: "get_channel_status",
    description: "Check the status of all messaging channels (WhatsApp, Telegram, etc.) for a workspace. Use for connection issues.",
    inputSchema: `{
  "workspace_id": { "type": "string", "description": "The workspace ID", "required": true }
}`,
    jsFunction: `const fetch = require('node-fetch');
const API_BASE = process.env.PYMESHUB_API_URL || 'https://api.pymeshub.lat';
const API_KEY = process.env.PYMESHUB_API_KEY || 'YOUR_API_KEY';

const url = API_BASE + '/api/admin/workspace/' + $workspace_id + '/channels';
const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }
};
try {
  const res = await fetch(url, options);
  const data = await res.json();
  return JSON.stringify(data, null, 2);
} catch (e) { return 'Error: ' + e.message; }`
  },

  // ── GitHub / Code ───────────────────────────────────────────────

  "read_github_file": {
    name: "read_github_file",
    description: "Read a file from the PymesHub GitHub repository. Use to inspect source code when diagnosing bugs. Path is relative to repo root (e.g., apps/api/src/agents/support/support-orchestrator.service.ts)",
    inputSchema: `{
  "path": { "type": "string", "description": "File path relative to repo root", "required": true },
  "ref": { "type": "string", "description": "Branch or commit SHA (default: master)", "required": false }
}`,
    jsFunction: `const fetch = require('node-fetch');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'YOUR_GITHUB_PAT';
const repo = 'Lento47/pymes-saas';
const ref = $ref || 'master';

const url = 'https://api.github.com/repos/' + repo + '/contents/' + $path + '?ref=' + ref;
const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3.raw' }
};
try {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) return 'Error ' + res.status + ': ' + text.slice(0, 200);
  return text;
} catch (e) { return 'Error: ' + e.message; }`
  },

  "search_github_code": {
    name: "search_github_code",
    description: "Search the PymesHub GitHub repository for code matching a query. Use to find where a feature, error, or pattern appears in the codebase.",
    inputSchema: `{
  "query": { "type": "string", "description": "Search query (e.g., 'PrismaService' or 'SupportOrchestrator')", "required": true },
  "language": { "type": "string", "description": "Filter by language: typescript, javascript, python, etc.", "required": false }
}`,
    jsFunction: `const fetch = require('node-fetch');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'YOUR_GITHUB_PAT';
const repo = 'Lento47/pymes-saas';
let q = $query + ' repo:' + repo;
if ($language) q += ' language:' + $language;

const url = 'https://api.github.com/search/code?q=' + encodeURIComponent(q) + '&per_page=10';
const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json' }
};
try {
  const res = await fetch(url, options);
  const data = await res.json();
  // Return file paths and match info
  const items = (data.items || []).map(i => ({
    path: i.path,
    repo: i.repository?.full_name,
    url: i.html_url
  }));
  return JSON.stringify({ total: data.total_count, results: items }, null, 2);
} catch (e) { return 'Error: ' + e.message; }`
  },

  "get_recent_commits": {
    name: "get_recent_commits",
    description: "Get recent commits from the PymesHub GitHub repository. Use to find what changed recently that might have caused a regression.",
    inputSchema: `{
  "limit": { "type": "number", "description": "Number of commits to return (default 10)", "required": false },
  "path": { "type": "string", "description": "Filter commits touching this file path", "required": false }
}`,
    jsFunction: `const fetch = require('node-fetch');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'YOUR_GITHUB_PAT';
const repo = 'Lento47/pymes-saas';
const limit = $limit || 10;

let url = 'https://api.github.com/repos/' + repo + '/commits?per_page=' + limit;
if ($path) url += '&path=' + encodeURIComponent($path);

const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json' }
};
try {
  const res = await fetch(url, options);
  const data = await res.json();
  const commits = (Array.isArray(data) ? data : []).map(c => ({
    sha: c.sha?.slice(0, 7),
    message: c.commit?.message?.split('\\n')[0],
    author: c.commit?.author?.name,
    date: c.commit?.author?.date,
    files: c.files?.map(f => f.filename) || []
  }));
  return JSON.stringify(commits, null, 2);
} catch (e) { return 'Error: ' + e.message; }`
  },

  // ── Railway / Deploy ────────────────────────────────────────────

  "get_railway_logs": {
    name: "get_railway_logs",
    description: "Get recent deployment logs from Railway for the PymesHub API service. Use when diagnosing deploy failures or runtime errors.",
    inputSchema: `{
  "limit": { "type": "number", "description": "Number of log lines (default 50)", "required": false }
}`,
    jsFunction: `const fetch = require('node-fetch');
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN || 'YOUR_RAILWAY_TOKEN';
const SERVICE_ID = process.env.RAILWAY_SERVICE_ID || 'YOUR_SERVICE_ID';
const limit = $limit || 50;

const query = 'query($serviceId: String!, $limit: Int!) { deploymentLogs(serviceId: $serviceId, limit: $limit) { timestamp message severity } }';
const url = 'https://backboard.railway.app/graphql/v2';
const options = {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + RAILWAY_TOKEN, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, variables: { serviceId: SERVICE_ID, limit } })
};
try {
  const res = await fetch(url, options);
  const json = await res.json();
  const logs = json?.data?.deploymentLogs || [];
  return JSON.stringify(logs.slice(-limit), null, 2);
} catch (e) { return 'Error: ' + e.message; }`
  },

  // ── Billing ─────────────────────────────────────────────────────

  "get_billing_status": {
    name: "get_billing_status",
    description: "Get billing status for a workspace: current plan, credit balance, usage, limits.",
    inputSchema: `{
  "workspace_id": { "type": "string", "description": "The workspace ID", "required": true }
}`,
    jsFunction: `const fetch = require('node-fetch');
const API_BASE = process.env.PYMESHUB_API_URL || 'https://api.pymeshub.lat';
const API_KEY = process.env.PYMESHUB_API_KEY || 'YOUR_API_KEY';

const url = API_BASE + '/api/admin/workspace/' + $workspace_id + '/billing';
const options = {
  method: 'GET',
  headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }
};
try {
  const res = await fetch(url, options);
  const data = await res.json();
  return JSON.stringify(data, null, 2);
} catch (e) { return 'Error: ' + e.message; }`
  },

  // ── PR Creation (Tier 3+) ───────────────────────────────────────

  "create_github_pr": {
    name: "create_github_pr",
    description: "Create a GitHub Pull Request on the PymesHub repository. PRs are ALWAYS created as DRAFT. Only use when a code fix has been reviewed and approved.",
    inputSchema: `{
  "branch": { "type": "string", "description": "Branch name for the PR", "required": true },
  "title": { "type": "string", "description": "PR title", "required": true },
  "body": { "type": "string", "description": "PR description (markdown)", "required": true },
  "base": { "type": "string", "description": "Base branch (default: master)", "required": false }
}`,
    jsFunction: `const fetch = require('node-fetch');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || 'YOUR_GITHUB_PAT';
const repo = 'Lento47/pymes-saas';
const base = $base || 'master';

const url = 'https://api.github.com/repos/' + repo + '/pulls';
const options = {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json' },
  body: JSON.stringify({
    title: $title,
    body: $body + '\\n\\n> Generated by PymesHub Support Agent. Review required before merge.',
    head: $branch,
    base: base,
    draft: true
  })
};
try {
  const res = await fetch(url, options);
  const data = await res.json();
  if (data.html_url) return 'PR created: ' + data.html_url;
  return 'Failed: ' + JSON.stringify(data);
} catch (e) { return 'Error: ' + e.message; }`
  }
};
