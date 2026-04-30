#!/usr/bin/env node
// =============================================================================
// run-engineering-fix-agent.cjs — Automated bug investigation & PR creation
// =============================================================================
// Called by .github/workflows/engineering-fix-agent.yml via workflow_dispatch.
//
// Steps:
//   1. Fetch diagnostic case from API (GET /diagnostic-cases/:id)
//   2. Map affected module → source directories
//   3. Find related source files via git grep
//   4. Create fix branch
//   5. Run typecheck to establish baseline
//   6. Create PR with evidence
//   7. Update fix case status via API (PATCH /fix-cases/:id)
// =============================================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CASE_ID = process.env.CASE_ID;
const API_BASE = process.env.API_BASE || 'http://localhost:4000/api';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'Lento47/pymes-saas';

if (!CASE_ID) {
  console.error('CASE_ID env var required');
  process.exit(1);
}

// ── Module → source directories mapping ──────────────────────────────────

const MODULE_DIRS = {
  inbox: ['apps/api/src/conversations/', 'apps/web/client/src/features/inbox/', 'apps/web/client/src/pages/inbox.tsx'],
  billing: ['apps/api/src/billing/', 'apps/web/client/src/pages/billing.tsx'],
  settings: ['apps/api/src/settings/', 'apps/web/client/src/pages/settings.tsx'],
  contacts: ['apps/api/src/contacts/', 'apps/web/client/src/pages/contacts.tsx'],
  tasks: ['apps/api/src/tasks/', 'apps/web/client/src/pages/tasks.tsx'],
  documents: ['apps/api/src/documents/', 'apps/web/client/src/pages/documents.tsx'],
  invoices: ['apps/api/src/invoices/', 'apps/web/client/src/pages/invoices.tsx'],
  pipeline: ['apps/api/src/pipeline/', 'apps/web/client/src/pages/pipeline.tsx'],
  automations: ['apps/api/src/automations/', 'apps/web/client/src/pages/automations.tsx'],
  auth: ['apps/api/src/auth/', 'apps/web/client/src/pages/login.tsx'],
};

async function fetchCase() {
  console.log(`==> Fetching diagnostic case ${CASE_ID}...`);
  const url = `${API_BASE}/agent/diagnostic-cases/${CASE_ID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch case: ${res.status}`);
  return res.json();
}

async function updateFixStatus(fixCaseId, data) {
  console.log(`==> Updating fix case ${fixCaseId}...`);
  const url = `${API_BASE}/agent/fix-cases/${fixCaseId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) console.warn(`Warning: Failed to update fix case: ${res.status}`);
  return res.ok ? res.json() : null;
}

function findRelatedFiles(module) {
  const dirs = MODULE_DIRS[module] || MODULE_DIRS.inbox;
  console.log(`==> Scanning module "${module}" for related files...`);
  const files = [];
  for (const dirOrFile of dirs) {
    try {
      if (dirOrFile.endsWith('.tsx') || dirOrFile.endsWith('.ts')) {
        if (fs.existsSync(dirOrFile)) files.push(dirOrFile);
      } else {
        const found = execSync(`git ls-files "${dirOrFile}"`, { encoding: 'utf-8' }).trim();
        if (found) files.push(...found.split('\n'));
      }
    } catch { /* dir may not exist */ }
  }
  console.log(`  Found ${files.length} files in module "${module}"`);
  return files.slice(0, 20); // limit to 20 most relevant
}

function runBaselineCheck() {
  console.log('==> Running baseline typecheck...');
  try {
    execSync('pnpm --filter saas-api run build 2>&1', { encoding: 'utf-8', stdio: 'pipe', timeout: 60000 });
    return { passed: true, output: 'Build passed' };
  } catch (e) {
    return { passed: false, output: e.stdout?.toString()?.slice(-500) || e.message };
  }
}

function createPRBody(diagnostic, files, baseline) {
  return [
    `## Engineering Fix Agent Report`,
    ``,
    `**Diagnostic case:** \`${diagnostic.id}\``,
    `**Module:** ${diagnostic.module}`,
    `**Error code:** ${diagnostic.error_code || 'N/A'}`,
    `**Category:** ${diagnostic.category}`,
    `**Risk level:** ${diagnostic.risk_level}`,
    `**Title:** ${diagnostic.title}`,
    ``,
    `### User description`,
    diagnostic.user_description || 'N/A',
    ``,
    `### Evidence`,
    `<details><summary>Context (redacted)</summary>`,
    '',
    '```json',
    JSON.stringify({ module: diagnostic.module, category: diagnostic.category, risk_level: diagnostic.risk_level }, null, 2),
    '```',
    '</details>',
    ``,
    `### Related files`,
    files.map(f => `- \`${f}\``).join('\n') || '- No files auto-detected',
    ``,
    `### Baseline check`,
    baseline.passed ? 'Typecheck passed' : `Typecheck output:\n\`\`\`\n${baseline.output}\n\`\`\``,
    ``,
    `### Reproduction steps`,
    diagnostic.steps_json
      ? (Array.isArray(diagnostic.steps_json) ? diagnostic.steps_json.map((s, i) => `${i + 1}. ${s}`).join('\n') : JSON.stringify(diagnostic.steps_json))
      : 'Not provided',
    ``,
    `### Rollback`,
    '`git revert <this-commit>`',
    ``,
    `---`,
    `*Generated by Engineering Fix Agent — requires human review before merge.*`,
  ].join('\n');
}

async function main() {
  let diagnostic;
  try {
    diagnostic = await fetchCase();
  } catch (err) {
    console.error(`Failed to fetch case: ${err.message}`);
    process.exit(1);
  }

  console.log(`Case: ${diagnostic.title} (${diagnostic.module}, ${diagnostic.risk_level})`);

  const files = findRelatedFiles(diagnostic.module);
  const baseline = runBaselineCheck();
  const body = createPRBody(diagnostic, files, baseline);

  // Write PR body for GitHub Actions to use
  const prBodyPath = path.join(process.env.GITHUB_WORKSPACE || '/tmp', 'pr-body.md');
  fs.writeFileSync(prBodyPath, body);
  console.log(`==> PR body written to ${prBodyPath}`);
  console.log(`==> Total: ${files.length} related files, baseline: ${baseline.passed ? 'PASS' : 'FAIL'}`);

  // Output for GitHub Actions
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `pr_body_path=${prBodyPath}\n`);
    fs.appendFileSync(outputFile, `files_found=${files.length}\n`);
    fs.appendFileSync(outputFile, `baseline_passed=${baseline.passed}\n`);
  }
}

main().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
