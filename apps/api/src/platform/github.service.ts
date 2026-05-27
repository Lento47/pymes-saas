/**
 * GitHubService
 *
 * Creates description-only PRs when an engineering fix case is approved.
 * Uses the GitHub REST API v3 directly (no Octokit dependency).
 *
 * Flow:
 *  1. GET  /repos/{owner}/{repo}/git/refs/heads/{base}   → SHA of base branch
 *  2. POST /repos/{owner}/{repo}/git/refs                → create fix branch at same SHA
 *  3. POST /repos/{owner}/{repo}/pulls                   → create PR with fix summary
 *
 * The dev applies the changes manually based on the PR description / diffs.
 */
import { Injectable, Logger } from "@nestjs/common";

const GH_API = "https://api.github.com";

export interface CreatePRParams {
  token: string;
  owner: string;
  repo: string;
  branchName: string;
  baseBranch?: string;   // defaults to "master"
  title: string;
  body: string;          // markdown — fix summary + file diffs
}

export interface CreatedPR {
  prUrl: string;
  prNumber: number;
  branchName: string;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  async createDescriptionPR(params: CreatePRParams): Promise<CreatedPR> {
    const { token, owner, repo, branchName, title, body } = params;
    const base = params.baseBranch ?? "master";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    // 1. Get SHA of base branch
    const refRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/refs/heads/${base}`, { headers });
    if (!refRes.ok) {
      const err = await refRes.text();
      throw new Error(`GitHub: failed to get base branch ref (${refRes.status}): ${err}`);
    }
    const refData = (await refRes.json()) as any;
    const sha: string = refData?.object?.sha;
    if (!sha) throw new Error("GitHub: could not read SHA from base branch ref");

    // 2. Create fix branch at that SHA
    const createBranchRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });
    if (!createBranchRes.ok) {
      const err = await createBranchRes.text();
      // 422 = branch already exists, that's fine
      if (createBranchRes.status !== 422) {
        throw new Error(`GitHub: failed to create branch (${createBranchRes.status}): ${err}`);
      }
      this.logger.warn(`[github] Branch ${branchName} already exists, using it`);
    }

    // 3. Create the PR
    const prRes = await fetch(`${GH_API}/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base,
        draft: true,
      }),
    });
    if (!prRes.ok) {
      const err = await prRes.text();
      throw new Error(`GitHub: failed to create PR (${prRes.status}): ${err}`);
    }
    const prData = (await prRes.json()) as any;

    this.logger.log(`[github] PR #${prData.number} created: ${prData.html_url}`);
    return {
      prUrl: prData.html_url as string,
      prNumber: prData.number as number,
      branchName,
    };
  }

  /** Build the markdown body for a fix PR from EngineeringFixCase data */
  buildPRBody(params: {
    fixSummary: string;
    diagnosticTitle: string;
    category: string;
    riskLevel: string;
    module: string | null;
    errorCode: string | null;
    filesChanged: Array<{ file: string; reason: string; diff_suggestion?: string }>;
  }): string {
    const { fixSummary, diagnosticTitle, category, riskLevel, module, errorCode, filesChanged } = params;

    const lines: string[] = [
      `## 🔧 Fix propuesto por PymesHub AI`,
      ``,
      `**Diagnóstico:** ${diagnosticTitle}`,
      `**Categoría:** \`${category}\`  |  **Riesgo:** \`${riskLevel}\``,
      module    ? `**Módulo:** \`${module}\`` : "",
      errorCode ? `**Error Code:** \`${errorCode}\`` : "",
      ``,
      `### Resumen del fix`,
      ``,
      fixSummary,
      ``,
      `---`,
      ``,
      `### Archivos a modificar`,
      ``,
      `| Archivo | Motivo |`,
      `|---------|--------|`,
      ...filesChanged.map((f) => `| \`${f.file}\` | ${f.reason} |`),
      ``,
    ];

    for (const fc of filesChanged) {
      if (fc.diff_suggestion) {
        lines.push(`#### \`${fc.file}\``);
        lines.push(``);
        lines.push("```diff");
        lines.push(fc.diff_suggestion);
        lines.push("```");
        lines.push(``);
      }
    }

    lines.push(`---`);
    lines.push(`> ⚠️ Este PR fue generado automáticamente. Revisar y aplicar los cambios manualmente antes de mergear.`);

    return lines.filter((l) => l !== undefined).join("\n");
  }
}
