import { Injectable, Logger, BadRequestException, Optional } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { InsightsService } from "../insights/insights.service";
import { SearchService } from "../search/search.service";
import { DiagnosticService } from "./diagnostic.service";
import { EngineeringFixService } from "./engineering-fix.service";
import { GitHubService } from "../platform/github.service";
import { RailwayService } from "../platform/railway.service";
import { PlatformSettingsService } from "../platform/platform-settings.service";

@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly insights: InsightsService,
    private readonly searchService: SearchService,
    private readonly diagnostic: DiagnosticService,
    private readonly fixService: EngineeringFixService,
    @Optional() private readonly github?: GitHubService,
    @Optional() private readonly railway?: RailwayService,
    @Optional() private readonly platformSettings?: PlatformSettingsService,
  ) {}

  async execute(workspaceId: string, tool: string, args: Record<string, any>): Promise<any> {
    switch (tool) {
      case "get_workspace":
        return this.getWorkspace(workspaceId);
      case "get_stats":
        return this.getStats(workspaceId);
      case "get_insights":
        return this.getInsights(workspaceId);
      case "search":
        return this.search(workspaceId, args);
      case "list_contacts":
        return this.listContacts(workspaceId, args);
      case "list_tasks":
        return this.listTasks(workspaceId, args);
      case "create_task":
        return this.createTask(workspaceId, args);
      case "update_task":
        return this.updateTask(workspaceId, args);
      case "list_invoices":
        return this.listInvoices(workspaceId);
      case "list_conversations":
        return this.listConversations(workspaceId, args);
      case "get_conversation_detail":
        return this.getConversationDetail(workspaceId, args);
      case "reply_conversation":
        return this.replyConversation(workspaceId, args);
      case "list_automations":
        return this.listAutomations(workspaceId);
      case "create_automation":
        return this.createAutomation(workspaceId, args);
      case "toggle_automation":
        return this.toggleAutomation(workspaceId, args);
      case "get_billing":
        return this.getBilling(workspaceId);
      case "get_billing_invoices":
        return this.getBillingInvoices(workspaceId);
      case "list_pipeline_deals":
        return this.listPipelineDeals(workspaceId);
      case "create_deal":
        return this.createDeal(workspaceId, args);
      case "move_deal":
        return this.moveDeal(workspaceId, args);
      case "list_documents":
        return this.listDocuments(workspaceId, args);
      case "get_settings":
        return this.getSettings(workspaceId);
      case "get_errors":
        return this.getErrors(workspaceId, args);
      case "diagnose":
        return this.diagnose(workspaceId, args);
      case "list_diagnostic_cases":
        return this.listDiagnosticCases(workspaceId);
      case "list_fix_cases":
        return this.listFixCases(workspaceId);
      case "approve_fix":
        return this.approveFix(workspaceId, args);
      case "reject_fix":
        return this.rejectFix(workspaceId, args);
      // ── Platform / SRE tools (require GitHub token in PlatformSettings) ──
      case "read_github_file":
        return this.readGitHubFile(args);
      case "get_recent_commits":
        return this.getRecentCommits(args);
      case "apply_github_fix":
        return this.applyGitHubFix(args);
      case "get_railway_logs":
        return this.getRailwayLogs(args);
      default:
        throw new BadRequestException(`Unknown tool: ${tool}`);
    }
  }

  private async getWorkspace(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, plan: true, status: true, created_at: true },
    });
    return { workspace: ws };
  }

  private async getStats(workspaceId: string) {
    const [contacts, tasks, invoices, conversations] = await Promise.all([
      this.prisma.contact.count({ where: { workspace_id: workspaceId } }),
      this.prisma.task.count({ where: { workspace_id: workspaceId } }),
      this.prisma.invoice.count({ where: { workspace_id: workspaceId } }),
      this.prisma.conversation.count({ where: { workspace_id: workspaceId } }),
    ]);
    return { stats: { contacts, tasks, invoices, conversations } };
  }

  private async listContacts(workspaceId: string, args: Record<string, any>) {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (args.search) where.full_name = { contains: args.search, mode: "insensitive" };
    const contacts = await this.prisma.contact.findMany({
      where,
      select: { id: true, full_name: true, email: true, phone: true, type: true },
      take: 50,
    });
    return { contacts };
  }

  private async listTasks(workspaceId: string, args: Record<string, any>) {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (args.status) where.status = args.status;
    const tasks = await this.prisma.task.findMany({
      where,
      select: { id: true, title: true, status: true, priority: true, due_at: true },
      take: 50,
      orderBy: { created_at: "desc" },
    });
    return { tasks };
  }

  private async createTask(workspaceId: string, args: Record<string, any>) {
    const task = await this.prisma.task.create({
      data: {
        workspace_id: workspaceId,
        title: args.title,
        description: args.description || "",
        priority: args.priority || "MEDIUM",
        due_at: args.due_date ? new Date(args.due_date) : undefined,
        status: "TODO",
      },
    });
    return { task };
  }

  private async listInvoices(workspaceId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        number: true,
        amount: true,
        subtotal: true,
        tax_rate: true,
        tax_amount: true,
        status: true,
        due_date: true,
      },
      take: 50,
      orderBy: { created_at: "desc" },
    });
    return { invoices };
  }

  private async listConversations(workspaceId: string, args: Record<string, any>) {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (args.status) where.status = args.status;
    const conversations = await this.prisma.conversation.findMany({
      where,
      select: { id: true, subject: true, status: true, priority: true, created_at: true },
      take: 50,
      orderBy: { created_at: "desc" },
    });
    return { conversations };
  }

  private async listAutomations(workspaceId: string) {
    const automations = await this.prisma.automationRule.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, name: true, enabled: true, trigger_type: true },
      take: 50,
    });
    return { automations };
  }

  private async getBilling(workspaceId: string) {
    const [sub, ws] = await Promise.all([
      this.prisma.workspaceSubscription.findFirst({
        where: { workspace_id: workspaceId },
        select: {
          plan: true,
          status: true,
          provider: true,
          current_period_start: true,
          current_period_end: true,
        },
      }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } }),
    ]);
    return { subscription: sub, workspace_plan: ws?.plan };
  }

  private async getBillingInvoices(workspaceId: string) {
    const invoices = await this.prisma.billingInvoice.findMany({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        number: true,
        plan_name: true,
        total: true,
        currency: true,
        status: true,
        issued_at: true,
      },
      take: 50,
      orderBy: { issued_at: "desc" },
    });
    return { billing_invoices: invoices };
  }

  private async listPipelineDeals(workspaceId: string) {
    const deals = await this.prisma.deal.findMany({
      where: { workspace_id: workspaceId },
      select: { id: true, title: true, stage_id: true, value: true, status: true },
      take: 50,
      orderBy: { created_at: "desc" },
    });
    return { deals };
  }

  private async getSettings(workspaceId: string) {
    const [ws, members] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          status: true,
          locale: true,
          timezone: true,
        },
      }),
      this.prisma.workspaceUser.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } },
        take: 20,
      }),
    ]);
    return { workspace: ws, members };
  }

  private async getInsights(workspaceId: string) {
    const results = await this.insights.getInsights(workspaceId);
    return { insights: results };
  }

  private async search(workspaceId: string, args: Record<string, any>) {
    const q = args.q || args.query || "";
    if (!q) throw new BadRequestException('search requires a "q" argument');
    const typesArr = args.types
      ? (args.types as string).split(",").map((t: string) => t.trim())
      : [];
    const results = await this.searchService.search(workspaceId, q, typesArr, 10);
    return { results };
  }

  private async getConversationDetail(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    if (!id) throw new BadRequestException('get_conversation_detail requires "id" argument');
    const [conv, messages] = await Promise.all([
      this.prisma.conversation.findFirst({
        where: { id, workspace_id: workspaceId },
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          category: true,
          created_at: true,
          contact: { select: { full_name: true, email: true } },
        },
      }),
      this.prisma.message.findMany({
        where: { conversation_id: id, workspace_id: workspaceId },
        select: { id: true, direction: true, body_text: true, sender_name: true, sent_at: true },
        take: 100,
        orderBy: { sent_at: "asc" },
      }),
    ]);
    if (!conv) throw new BadRequestException(`Conversation "${id}" not found`);
    return { conversation: conv, messages };
  }

  private async replyConversation(workspaceId: string, args: Record<string, any>) {
    const id = args.id || args.conversation_id;
    const text = args.text || args.message;
    if (!id || !text) throw new BadRequestException('reply_conversation requires "id" and "text"');
    const msg = await this.prisma.message.create({
      data: {
        workspace_id: workspaceId,
        conversation_id: id,
        direction: "OUTBOUND",
        body_text: text,
        sender_name: "HubbyAgent",
      },
    });
    return { message: msg };
  }

  private async createAutomation(workspaceId: string, args: Record<string, any>) {
    if (!args.name || !args.trigger_type) {
      throw new BadRequestException('create_automation requires "name" and "trigger_type"');
    }
    const auto = await this.prisma.automationRule.create({
      data: {
        workspace_id: workspaceId,
        name: args.name,
        description: args.description || "",
        trigger_type: args.trigger_type,
        trigger_config_json: args.trigger_config || {},
        action_config_json: args.action_config || args.config || {},
        condition_config_json: args.condition_config || undefined,
        enabled: args.enabled !== false,
      },
    });
    return { automation: auto };
  }

  private async toggleAutomation(workspaceId: string, args: Record<string, any>) {
    if (!args.id) throw new BadRequestException('toggle_automation requires "id"');
    const existing = await this.prisma.automationRule.findFirst({
      where: { id: args.id, workspace_id: workspaceId },
    });
    if (!existing) throw new BadRequestException(`Automation "${args.id}" not found`);
    const updated = await this.prisma.automationRule.update({
      where: { id: args.id },
      data: { enabled: args.enabled !== undefined ? args.enabled : !existing.enabled },
    });
    return { automation: updated };
  }

  private async updateTask(workspaceId: string, args: Record<string, any>) {
    if (!args.id) throw new BadRequestException('update_task requires "id"');
    const data: Record<string, any> = {};
    if (args.title !== undefined) data.title = args.title;
    if (args.description !== undefined) data.description = args.description;
    if (args.status !== undefined) data.status = args.status;
    if (args.priority !== undefined) data.priority = args.priority;
    if (args.due_date !== undefined) data.due_at = new Date(args.due_date);
    if (args.assignee_id !== undefined) data.assigned_user_id = args.assignee_id;
    const task = await this.prisma.task.update({
      where: { id: args.id, workspace_id: workspaceId },
      data,
    });
    return { task };
  }

  private async createDeal(workspaceId: string, args: Record<string, any>) {
    if (!args.title || !args.stage_id)
      throw new BadRequestException('create_deal requires "title" and "stage_id"');
    const deal = await this.prisma.deal.create({
      data: {
        workspace_id: workspaceId,
        title: args.title,
        stage_id: args.stage_id,
        value: args.value || 0,
        contact_id: args.contact_id || undefined,
        status: "OPEN",
      },
    });
    return { deal };
  }

  private async moveDeal(workspaceId: string, args: Record<string, any>) {
    if (!args.id || !args.stage_id)
      throw new BadRequestException('move_deal requires "id" and "stage_id"');
    const deal = await this.prisma.deal.update({
      where: { id: args.id, workspace_id: workspaceId },
      data: { stage_id: args.stage_id },
    });
    return { deal };
  }

  private async listDocuments(workspaceId: string, args: Record<string, any>) {
    const where: Record<string, any> = { workspace_id: workspaceId };
    if (args.search) where.file_name = { contains: args.search, mode: "insensitive" };
    const docs = await this.prisma.document.findMany({
      where,
      select: {
        id: true,
        file_name: true,
        mime_type: true,
        file_size: true,
        ocr_text: true,
        created_at: true,
      },
      take: 50,
      orderBy: { created_at: "desc" },
    });
    return { documents: docs };
  }

  private async getErrors(workspaceId: string, args: Record<string, any>) {
    const limit = Math.min(args.limit || 10, 50);
    const errors = await (this.prisma as any).errorReport.findMany({
      where: { workspace_id: workspaceId },
      select: {
        id: true,
        source: true,
        category: true,
        severity: true,
        title: true,
        message: true,
        route: true,
        method: true,
        status_code: true,
        occurred_at: true,
        context_json: true,
      },
      orderBy: { occurred_at: "desc" },
      take: limit,
    });
    return {
      errors,
      count: errors.length,
      summary:
        errors.length > 0
          ? `${errors.length} error(es) reciente(s). ${errors.filter((e: Record<string, any>) => e.status_code && e.status_code >= 500).length} son del servidor (5xx).`
          : "No hay errores recientes en este workspace.",
    };
  }

  private async diagnose(workspaceId: string, args: Record<string, any>) {
    const result = await this.diagnostic.diagnose({
      workspaceId,
      user_description: args.description || args.user_description || "",
      error_report_id: args.error_report_id,
    });
    return { diagnosis: result };
  }

  private async listDiagnosticCases(workspaceId: string) {
    const cases = await this.diagnostic.listCases(workspaceId);
    return { diagnostic_cases: cases };
  }

  private async listFixCases(workspaceId: string) {
    const cases = await this.fixService.listFixCases(workspaceId);
    return { fix_cases: cases };
  }

  private async approveFix(workspaceId: string, args: Record<string, any>) {
    if (!args.fix_case_id) throw new BadRequestException("approve_fix requires fix_case_id");
    return this.fixService.approveFix(args.fix_case_id, { workspaceId, isPlatformAdmin: false });
  }

  private async rejectFix(workspaceId: string, args: Record<string, any>) {
    if (!args.fix_case_id) throw new BadRequestException("reject_fix requires fix_case_id");
    return this.fixService.rejectFix(args.fix_case_id, args.reason || "", {
      workspaceId,
      isPlatformAdmin: false,
    });
  }

  // ── Platform / SRE tools ─────────────────────────────────────────────────

  private async getGitHubCreds(): Promise<{ token: string; owner: string; repo: string } | null> {
    if (!this.github || !this.platformSettings) return null;
    try {
      const cfg = await this.platformSettings.getDecrypted();
      if (!cfg.github_token || !cfg.github_repo_owner || !cfg.github_repo_name) return null;
      return { token: cfg.github_token, owner: cfg.github_repo_owner, repo: cfg.github_repo_name };
    } catch {
      return null;
    }
  }

  /**
   * Read a file from the GitHub repository.
   * args: { path: string, ref?: string }
   */
  private async readGitHubFile(args: Record<string, any>) {
    if (!args.path) throw new BadRequestException("read_github_file requires path");
    const creds = await this.getGitHubCreds();
    if (!creds) {
      return { error: "GitHub not configured. Set github_token, github_repo_owner, github_repo_name in /settings/platform." };
    }
    const result = await this.github!.readFile({ ...creds, path: args.path, ref: args.ref ?? "master" });
    if (!result) return { error: `File not found: ${args.path}` };
    return {
      path: args.path,
      content: result.content.length > 12000
        ? result.content.slice(0, 12000) + "\n... (truncated)"
        : result.content,
      sha: result.sha,
      size: result.content.length,
    };
  }

  /**
   * Get recent commits that touched a file.
   * args: { path: string, limit?: number }
   */
  private async getRecentCommits(args: Record<string, any>) {
    if (!args.path) throw new BadRequestException("get_recent_commits requires path");
    const creds = await this.getGitHubCreds();
    if (!creds) {
      return { error: "GitHub not configured." };
    }
    const commits = await this.github!.getRecentCommits({ ...creds, path: args.path, limit: args.limit ?? 10 });
    return { path: args.path, commits };
  }

  /**
   * Apply code changes to a branch and open a real PR.
   * args: {
   *   branch_name: string,
   *   files: Array<{ path: string, content: string }>,
   *   pr_title: string,
   *   pr_body: string,
   *   base_branch?: string,
   *   diagnostic_case_id?: string  // optional: links back to a diagnostic case
   * }
   */
  private async applyGitHubFix(args: Record<string, any>) {
    if (!args.branch_name) throw new BadRequestException("apply_github_fix requires branch_name");
    if (!Array.isArray(args.files) || args.files.length === 0) {
      throw new BadRequestException("apply_github_fix requires files[]");
    }
    if (!args.pr_title) throw new BadRequestException("apply_github_fix requires pr_title");

    const creds = await this.getGitHubCreds();
    if (!creds) {
      return { error: "GitHub not configured. Set github_token, github_repo_owner, github_repo_name in /settings/platform." };
    }

    try {
      const result = await this.github!.applyFileChanges({
        ...creds,
        branchName: args.branch_name,
        baseBranch: args.base_branch ?? "master",
        files: args.files,
        prTitle: args.pr_title,
        prBody: args.pr_body ?? `Fix propuesto por agente de soporte PymesHub\n\nArchivos modificados: ${args.files.map((f: any) => f.path).join(", ")}`,
      });

      // If a diagnostic_case_id was provided, update its fix case with the PR URL
      if (args.diagnostic_case_id) {
        try {
          const fixCase = await (this.prisma as any).engineeringFixCase.findFirst({
            where: { diagnostic_case_id: args.diagnostic_case_id },
            select: { id: true },
          });
          if (fixCase) {
            await (this.prisma as any).engineeringFixCase.update({
              where: { id: fixCase.id },
              data: { pr_url: result.prUrl, pr_number: result.prNumber, status: "PR_OPENED" },
            });
          }
        } catch (err: any) {
          this.logger.warn(`[tools] Failed to update fix case with PR: ${err?.message}`);
        }
      }

      return {
        success: true,
        pr_url: result.prUrl,
        pr_number: result.prNumber,
        branch: result.branchName,
        files_committed: args.files.map((f: any) => f.path),
      };
    } catch (err: any) {
      this.logger.error(`[tools] apply_github_fix failed: ${err?.message}`);
      return { error: err?.message ?? "Unknown error creating PR" };
    }
  }

  /**
   * Get recent Railway deployment logs for the API service.
   * args: { limit?: number }
   */
  private async getRailwayLogs(args: Record<string, any>) {
    if (!this.railway) {
      return { error: "RailwayService not available." };
    }
    const limit = Math.min(args.limit ?? 100, 500);
    const { logs, deploymentId } = await this.railway.getRecentLogs(limit);
    return {
      deployment_id: deploymentId,
      log_count: logs.length,
      logs,
      summary: `${logs.length} líneas de log del deployment ${deploymentId ?? "desconocido"}.`,
    };
  }
}
