/**
 * GitHubService
 *
 * Creates PRs (description-only or with real code commits) via GitHub REST API v3.
 * Also exposes read helpers used by the support agent tools.
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

  /** Read a file from the repo. Returns { content, sha, encoding } */
  async readFile(params: {
    token: string; owner: string; repo: string; path: string; ref?: string;
  }): Promise<{ content: string; sha: string } | null> {
    const { token, owner, repo, path, ref = "master" } = params;
    const url = `${GH_API}/repos/${owner}/${repo}/contents/${path.replace(/^\//, "")}?ref=${ref}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) {
      this.logger.warn(`[github] readFile ${path} → ${res.status}`);
      return null;
    }
    const data = (await res.json()) as any;
    // content is base64-encoded by GitHub
    const decoded = Buffer.from(data.content ?? "", "base64").toString("utf8");
    return { content: decoded, sha: data.sha as string };
  }

  /** Get recent commits that touched a file */
  async getRecentCommits(params: {
    token: string; owner: string; repo: string; path: string; limit?: number;
  }): Promise<Array<{ sha: string; message: string; author: string; date: string }>> {
    const { token, owner, repo, path, limit = 10 } = params;
    const url = `${GH_API}/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=${limit}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as any[];
    return data.map((c: any) => ({
      sha: c.sha?.slice(0, 8) ?? "",
      message: c.commit?.message?.split("\n")[0] ?? "",
      author: c.commit?.author?.name ?? "",
      date: c.commit?.author?.date ?? "",
    }));
  }

  /**
   * Apply file changes to a branch and create a PR with real code.
   * Creates the branch, commits each file, then opens a draft PR.
   */
  async applyFileChanges(params: {
    token: string;
    owner: string;
    repo: string;
    branchName: string;
    baseBranch?: string;
    files: Array<{ path: string; content: string; commitMessage?: string }>;
    prTitle: string;
    prBody: string;
  }): Promise<CreatedPR> {
    const { token, owner, repo, branchName, prTitle, prBody } = params;
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
      throw new Error(`GitHub: failed to get base branch ref (${refRes.status}): ${await refRes.text()}`);
    }
    const sha: string = ((await refRes.json()) as any)?.object?.sha;
    if (!sha) throw new Error("GitHub: could not read SHA from base branch ref");

    // 2. Create fix branch
    const branchRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });
    if (!branchRes.ok && branchRes.status !== 422) {
      throw new Error(`GitHub: failed to create branch (${branchRes.status}): ${await branchRes.text()}`);
    }

    // 3. Commit each file to the branch
    for (const file of params.files) {
      // Get current file SHA (needed for updates; null for new files)
      let fileSha: string | undefined;
      try {
        const existing = await this.readFile({ token, owner, repo, path: file.path, ref: branchName });
        fileSha = existing?.sha;
      } catch {
        // file may not exist yet — that's fine
      }

      const body: Record<string, any> = {
        message: file.commitMessage ?? `fix: update ${file.path}`,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        branch: branchName,
      };
      if (fileSha) body.sha = fileSha;

      const fileRes = await fetch(
        `${GH_API}/repos/${owner}/${repo}/contents/${file.path.replace(/^\//, "")}`,
        { method: "PUT", headers, body: JSON.stringify(body) },
      );
      if (!fileRes.ok) {
        const errText = await fileRes.text();
        throw new Error(`GitHub: failed to commit ${file.path} (${fileRes.status}): ${errText}`);
      }
      this.logger.log(`[github] Committed ${file.path} to ${branchName}`);
    }

    // 4. Create the PR
    const prRes = await fetch(`${GH_API}/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: prTitle, body: prBody, head: branchName, base, draft: true }),
    });
    if (!prRes.ok) {
      throw new Error(`GitHub: failed to create PR (${prRes.status}): ${await prRes.text()}`);
    }
    const prData = (await prRes.json()) as any;
    this.logger.log(`[github] Real-code PR #${prData.number} created: ${prData.html_url}`);
    return { prUrl: prData.html_url as string, prNumber: prData.number as number, branchName };
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
