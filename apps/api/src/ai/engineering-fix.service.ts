import { ForbiddenException, Injectable, Logger, NotFoundException, Optional, Inject, forwardRef } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AiService } from "./ai.service";
import { GitHubService } from "../platform/github.service";
import { PlatformSettingsService } from "../platform/platform-settings.service";
import { FixApprovalService } from "./fix-approval.service";
import { PrCreationPolicyService } from "../agents/support/pr-creation-policy.service";
import { PLAN_TO_TIER } from "../agents/flowise-setup.service";
import type { SupportTier } from "../agents/support/support-agent.types";

/** Most files we'll attempt to rewrite for a single fix (keeps the PR reviewable). */
const MAX_FILES_PER_FIX = 5;
/** Skip files larger than this — the model can't reliably rewrite them without truncating. */
const MAX_FILE_BYTES = 16_000;

interface RbacActor {
  workspaceId: string;
  isPlatformAdmin: boolean;
}

@Injectable()
export class EngineeringFixService {
  private readonly logger = new Logger(EngineeringFixService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    @Optional() private readonly github?: GitHubService,
    @Optional() private readonly platformSettings?: PlatformSettingsService,
    @Optional() @Inject(forwardRef(() => FixApprovalService))
    private readonly fixApproval?: FixApprovalService,
    @Optional() private readonly prPolicy?: PrCreationPolicyService,
  ) {}

  /**
   * Look up a fix case and verify the caller's workspace owns the
   * underlying diagnostic case. Platform admins bypass the check
   * (they need to act cross-workspace from the platform/admin UI).
   */
  private async assertFixCaseAccessible(fixCaseId: string, actor: RbacActor) {
    const fixCase = await (this.prisma as any).engineeringFixCase.findUnique({
      where: { id: fixCaseId },
      include: {
        diagnosticCase: {
          select: {
            workspace_id: true,
            title: true,
            module: true,
            error_code: true,
            category: true,
            risk_level: true,
          },
        },
      },
    });
    if (!fixCase) throw new NotFoundException("Fix case not found");
    if (!actor.isPlatformAdmin && fixCase.diagnosticCase?.workspace_id !== actor.workspaceId) {
      throw new ForbiddenException("Fix case belongs to another workspace");
    }
    return fixCase;
  }

  /**
   * Same idea, for diagnostic-case lookups before mutating fix flow.
   */
  private async assertDiagnosticAccessible(diagnosticCaseId: string, actor: RbacActor) {
    const diagnostic = await this.prisma.supportDiagnosticCase.findUnique({
      where: { id: diagnosticCaseId },
      select: {
        id: true,
        workspace_id: true,
        module: true,
        error_code: true,
        title: true,
        user_description: true,
        safe_summary: true,
      },
    });
    if (!diagnostic) {
      throw new NotFoundException(`Diagnostic case ${diagnosticCaseId} not found`);
    }
    if (!actor.isPlatformAdmin && diagnostic.workspace_id !== actor.workspaceId) {
      throw new ForbiddenException("Diagnostic case belongs to another workspace");
    }
    return diagnostic;
  }

  async createFixCase(diagnosticCaseId: string, actor: RbacActor) {
    const diagnostic = await this.assertDiagnosticAccessible(diagnosticCaseId, actor);

    const branchName =
      `fix/${diagnostic.module}-${diagnostic.error_code || diagnostic.id.slice(0, 8)}-${diagnostic.id.slice(0, 6)}`
        .toLowerCase()
        .replace(/[^a-z0-9/-]/g, "-");

    const fixCase = await this.prisma.engineeringFixCase.create({
      data: {
        diagnostic_case_id: diagnosticCaseId,
        branch_name: branchName,
        status: "PENDING",
      },
    });

    await this.prisma.supportDiagnosticCase.update({
      where: { id: diagnosticCaseId },
      data: { status: "INVESTIGATING" },
    });

    this.logger.log(`Engineering fix case created: ${fixCase.id}, branch: ${branchName}`);

    // Auto-generate fix proposal via AI (fire-and-forget)
    this.proposeFixAndUpdate(
      fixCase.id,
      diagnostic,
      diagnosticCaseId,
      diagnostic.workspace_id,
    ).catch((err) => {
      this.logger.error(`Auto fix proposal failed for ${fixCase.id}: ${err?.message}`);
    });

    return fixCase;
  }

  private async proposeFixAndUpdate(
    fixCaseId: string,
    diagnostic: {
      workspace_id: string;
      module: string;
      error_code: string | null;
      title: string;
      user_description: string | null;
      safe_summary: string | null;
    },
    diagnosticCaseId: string,
    workspaceId: string,
  ) {
    const proposal = await this.aiService.generateFixProposal(workspaceId, diagnostic);
    if (!proposal) {
      await this.updateFixStatus(fixCaseId, {
        status: "INVESTIGATING",
        error_log: "AI fix proposal generation failed",
      });
      return;
    }

    await this.updateFixStatus(fixCaseId, {
      status: "FIX_READY",
      fix_summary: proposal.fix_summary,
      files_changed: proposal.files_changed_json,
    });

    await this.prisma.supportDiagnosticCase.update({
      where: { id: diagnosticCaseId },
      data: { resolution_json: proposal },
    });

    this.logger.log(`Fix proposal generated for ${fixCaseId}`);

    // Notify workspace OWNER via WA (fire-and-forget)
    if (this.fixApproval) {
      this.fixApproval
        .notifyFixReady(fixCaseId, workspaceId)
        .catch((err: any) =>
          this.logger.warn(`[fix-approval] WA notify failed: ${err?.message}`),
        );
    }
  }

  /**
   * Create a fix case with a pre-generated AI proposal (status: FIX_READY immediately).
   * Used by the automated support pipeline that calls AiGatewayService directly
   * instead of re-generating through the standard AI flow.
   */
  async createFixCaseWithProposal(
    diagnosticCaseId: string,
    proposal: {
      fix_summary: string;
      files_to_check: Array<{ file: string; reason: string; diff_suggestion?: string }>;
    },
    actor: RbacActor,
  ) {
    const diagnostic = await this.assertDiagnosticAccessible(diagnosticCaseId, actor);

    const branchName =
      `fix/${diagnostic.module}-${diagnostic.error_code || diagnostic.id.slice(0, 8)}-${diagnostic.id.slice(0, 6)}`
        .toLowerCase()
        .replace(/[^a-z0-9/-]/g, "-");

    const fixCase = await (this.prisma as any).engineeringFixCase.create({
      data: {
        diagnostic_case_id: diagnosticCaseId,
        branch_name: branchName,
        status: "FIX_READY",
        fix_summary: proposal.fix_summary,
        files_changed_json: proposal.files_to_check,
      },
    });

    await this.prisma.supportDiagnosticCase.update({
      where: { id: diagnosticCaseId },
      data: { status: "INVESTIGATING" },
    });

    this.logger.log(
      `[fix] Pre-proposed fix case created: ${fixCase.id} (FIX_READY immediately), branch: ${branchName}`,
    );

    return fixCase;
  }

  async approveFix(fixCaseId: string, actor: RbacActor) {
    const fixCase = await this.assertFixCaseAccessible(fixCaseId, actor);
    if (fixCase.status !== "FIX_READY" && fixCase.status !== "PENDING_APPROVAL") {
      throw new Error("Fix case must be in FIX_READY or PENDING_APPROVAL status to approve");
    }

    const updated = await this.updateFixStatus(fixCaseId, { status: "PR_OPENED" });

    // Fire-and-forget: open a draft PR with REAL committed code. Falls back to a
    // description-only PR if code can't be generated or policy blocks the change.
    this.openPrForFix(fixCase).catch((err: unknown) => {
      this.logger.error(
        `[github] PR creation failed for fix ${fixCaseId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return updated;
  }

  /**
   * Open a draft PR for an approved fix case, committing actual code.
   *
   * Pipeline:
   *   1. Resolve the workspace tier (PR creation is tier-gated).
   *   2. For each proposed file, read its current content from GitHub and ask
   *      the AI to return the full corrected file.
   *   3. Run the proposal through PrCreationPolicyService (blocks prohibited
   *      paths, secrets, destructive migrations; forces draft + review labels).
   *   4. Commit the files and open a DRAFT PR via applyFileChanges.
   *
   * If no code could be generated, or the policy blocks the change, fall back to
   * a description-only PR so a human still gets a reviewable starting point.
   * The agent never merges or approves — humans do, per CLAUDE.md.
   */
  private async openPrForFix(fixCase: any): Promise<void> {
    if (!this.github || !this.platformSettings) return;

    const cfg = await this.platformSettings.getDecrypted();
    if (!cfg.github_token || !cfg.github_repo_owner || !cfg.github_repo_name) {
      this.logger.warn("[github] PR skipped — GitHub not configured in platform settings");
      return;
    }
    const creds = { token: cfg.github_token, owner: cfg.github_repo_owner, repo: cfg.github_repo_name };

    const diagnostic = fixCase.diagnosticCase ?? {};
    const proposed: Array<{ file: string; reason: string; diff_suggestion?: string }> =
      Array.isArray(fixCase.files_changed_json) ? fixCase.files_changed_json : [];

    // Resolve tier from the owning workspace's plan.
    const workspaceId: string | undefined = diagnostic.workspace_id;
    let tier: SupportTier = "TIER_1";
    if (workspaceId) {
      const ws = await this.prisma.workspace
        .findUnique({ where: { id: workspaceId }, select: { plan: true } })
        .catch(() => null);
      tier = (PLAN_TO_TIER[ws?.plan ?? "FREE"] as SupportTier) ?? "TIER_1";
    }

    // Generate full file contents for each proposed file.
    const files: Array<{ path: string; content: string }> = [];
    for (const item of proposed.slice(0, MAX_FILES_PER_FIX)) {
      const path = (item.file ?? "").trim();
      if (!path) continue;
      const existing = await this.github
        .readFile({ ...creds, path, ref: "master" })
        .catch(() => null);
      const currentContent = existing?.content ?? "";
      if (currentContent.length > MAX_FILE_BYTES) {
        this.logger.warn(`[github] Skipping ${path} — too large to rewrite safely (${currentContent.length} bytes)`);
        continue;
      }
      const newContent = workspaceId
        ? await this.aiService.generateFileFix(workspaceId, {
            filePath: path,
            currentContent,
            diagnosticTitle: diagnostic.title ?? "Error de plataforma",
            fixSummary: fixCase.fix_summary ?? "Fix generado por IA",
            reason: item.reason ?? "",
            diffSuggestion: item.diff_suggestion,
          })
        : null;
      if (newContent && newContent !== currentContent) {
        files.push({ path, content: newContent });
      }
    }

    // No code generated → fall back to a description-only PR.
    if (files.length === 0) {
      this.logger.warn(`[github] No code generated for fix ${fixCase.id} — opening description-only PR`);
      await this.createGitHubPRForFix(fixCase);
      return;
    }

    // Policy gate. Branch must match fix/ai/<area>/<timestamp>.
    const area = (diagnostic.module ?? "general").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "") || "general";
    const branchName = `fix/ai/${area}/${Date.now()}`;
    const baseBranch = "master";

    if (this.prPolicy) {
      const decision = this.prPolicy.validateProposal({
        tier,
        securityReviewPassed: false,
        branch_name: branchName,
        base_branch: baseBranch,
        files,
      });
      if (!decision.allowed) {
        this.logger.warn(
          `[github] Code PR blocked by policy for fix ${fixCase.id} (${tier}): ${decision.violations.join("; ")} — falling back to description PR`,
        );
        await this.createGitHubPRForFix(fixCase);
        return;
      }

      const prBody =
        this.github.buildPRBody({
          fixSummary: fixCase.fix_summary ?? "Propuesta de fix generada por IA",
          diagnosticTitle: diagnostic.title ?? "Error de plataforma",
          category: diagnostic.category ?? "PRODUCT_BUG",
          riskLevel: diagnostic.risk_level ?? "HIGH",
          module: diagnostic.module ?? null,
          errorCode: diagnostic.error_code ?? null,
          filesChanged: proposed,
        }) +
        "\n\n---\n_PR generado por el agente de soporte — DRAFT. Requiere revisión y merge manual por un humano. El agente no puede mergear, aprobar ni desplegar._";

      const result = await this.github.applyFileChanges({
        ...creds,
        branchName,
        baseBranch,
        files,
        prTitle: `fix: ${diagnostic.title ?? fixCase.id} [AI]`,
        prBody,
        labels: decision.labels,
      });

      await this.prisma.engineeringFixCase.update({
        where: { id: fixCase.id },
        data: {
          pr_url: result.prUrl,
          pr_number: result.prNumber,
          branch_name: branchName,
        },
      });
      this.logger.log(`[github] Real-code draft PR #${result.prNumber} created for fix ${fixCase.id}: ${result.prUrl}`);
      return;
    }

    // No policy service available — refuse to push code; description PR only.
    this.logger.warn(`[github] PrCreationPolicyService unavailable — description-only PR for fix ${fixCase.id}`);
    await this.createGitHubPRForFix(fixCase);
  }

  /** Create a GitHub description PR from an approved fix case */
  private async createGitHubPRForFix(fixCase: any): Promise<void> {
    if (!this.github || !this.platformSettings) return;

    const cfg = await this.platformSettings.getDecrypted();
    if (!cfg.github_token || !cfg.github_repo_owner || !cfg.github_repo_name) {
      this.logger.warn("[github] PR skipped — GitHub not configured in platform settings");
      return;
    }

    const diagnostic = fixCase.diagnosticCase ?? {};
    const filesChanged: Array<{ file: string; reason: string; diff_suggestion?: string }> =
      Array.isArray(fixCase.files_changed_json) ? fixCase.files_changed_json : [];

    const prBody = this.github.buildPRBody({
      fixSummary:       fixCase.fix_summary ?? "Propuesta de fix generada por IA",
      diagnosticTitle:  diagnostic.title ?? "Error de plataforma",
      category:         diagnostic.category ?? "PRODUCT_BUG",
      riskLevel:        diagnostic.risk_level ?? "HIGH",
      module:           diagnostic.module ?? null,
      errorCode:        diagnostic.error_code ?? null,
      filesChanged,
    });

    const result = await this.github.createDescriptionPR({
      token:      cfg.github_token,
      owner:      cfg.github_repo_owner,
      repo:       cfg.github_repo_name,
      branchName: fixCase.branch_name,
      title:      `fix: ${diagnostic.title ?? fixCase.id} [AI]`,
      body:       prBody,
    });

    // Save PR url + number back to the fix case
    await (this.prisma as any).engineeringFixCase.update({
      where: { id: fixCase.id },
      data: { pr_url: result.prUrl, pr_number: result.prNumber },
    });

    this.logger.log(`[github] PR #${result.prNumber} created for fix ${fixCase.id}: ${result.prUrl}`);
  }

  async rejectFix(fixCaseId: string, reason: string, actor: RbacActor) {
    await this.assertFixCaseAccessible(fixCaseId, actor);
    return this.updateFixStatus(fixCaseId, {
      status: "PENDING",
      error_log: reason || "Rejected by admin",
    });
  }

  async listFixCases(workspaceId: string) {
    return (this.prisma as any).engineeringFixCase.findMany({
      where: {
        diagnosticCase: { workspace_id: workspaceId },
      },
      include: {
        diagnosticCase: {
          select: { title: true, module: true, error_code: true, category: true, risk_level: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 50,
    });
  }

  async getFixCase(fixCaseId: string, actor: RbacActor) {
    const fixCase = await (this.prisma as any).engineeringFixCase.findUnique({
      where: { id: fixCaseId },
      include: {
        diagnosticCase: {
          select: {
            id: true,
            workspace_id: true,
            title: true,
            module: true,
            error_code: true,
            category: true,
            risk_level: true,
            user_description: true,
            safe_summary: true,
            evidence_json: true,
          },
        },
      },
    });
    if (!fixCase) throw new NotFoundException("Fix case not found");
    if (!actor.isPlatformAdmin && fixCase.diagnosticCase?.workspace_id !== actor.workspaceId) {
      throw new ForbiddenException("Fix case belongs to another workspace");
    }
    return fixCase;
  }

  async getDiagnosticCaseForFix(caseId: string) {
    return this.prisma.supportDiagnosticCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        workspace_id: true,
        module: true,
        error_code: true,
        trace_id: true,
        category: true,
        risk_level: true,
        title: true,
        user_description: true,
        safe_summary: true,
        steps_json: true,
        evidence_json: true,
        created_at: true,
      },
    });
  }

  async updateFixStatus(
    fixCaseId: string,
    data: {
      status?: string;
      pr_url?: string;
      pr_number?: number;
      files_changed?: Record<string, any>;
      test_added?: Record<string, any>;
      fix_summary?: string;
      rollback_notes?: string;
      error_log?: string;
    },
    actor?: RbacActor,
  ) {
    // approveFix/rejectFix call this from inside the service after
    // already running assertFixCaseAccessible. External callers
    // (controller, agent script) supply actor and we re-check here.
    if (actor) {
      await this.assertFixCaseAccessible(fixCaseId, actor);
    }
    const updateData: Record<string, any> = { updated_at: new Date() };
    if (data.status) updateData.status = data.status;
    if (data.pr_url !== undefined) updateData.pr_url = data.pr_url;
    if (data.pr_number !== undefined) updateData.pr_number = data.pr_number;
    if (data.files_changed) updateData.files_changed_json = data.files_changed;
    if (data.test_added) updateData.test_added_json = data.test_added;
    if (data.fix_summary) updateData.fix_summary = data.fix_summary;
    if (data.rollback_notes) updateData.rollback_notes = data.rollback_notes;
    if (data.error_log !== undefined) updateData.error_log = data.error_log;

    return this.prisma.engineeringFixCase.update({
      where: { id: fixCaseId },
      data: updateData,
    });
  }
}
