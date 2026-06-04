import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

type ChecklistTask = { key?: string; completed?: boolean; notes?: string };
type ChecklistCategory = { key?: string; title?: string; items?: ChecklistTask[] };
type ChecklistItem = ChecklistCategory | ChecklistTask;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProject(workspaceId: string) {
    return this.prisma.onboardingProject.findUnique({
      where: { workspace_id: workspaceId },
      include: { owner_user: { select: { id: true, email: true, name: true } } },
    });
  }

  async getStatus(workspaceId: string) {
    const project = await this.prisma.onboardingProject.findUnique({
      where: { workspace_id: workspaceId },
      select: { status: true, checklist: true },
    });
    if (!project) return { exists: false };
    const checklist = (project.checklist as ChecklistCategory[]) ?? [];
    let completed = 0;
    let total = 0;
    for (const cat of checklist) {
      if (cat.items) {
        for (const item of cat.items) {
          total++;
          if (item.completed) completed++;
        }
      }
    }
    return { exists: true, status: project.status, completed, total };
  }

  // TODO(types): saveProject and updateProject accept Record<string,any> instead
  // of a typed DTO. Add CreateOnboardingProjectDto with explicit validation.
  async saveProject(workspaceId: string, data: Record<string, any>) {
    const existing = await this.prisma.onboardingProject.findUnique({
      where: { workspace_id: workspaceId },
    });
    if (existing) {
      return this.prisma.onboardingProject.update({
        where: { workspace_id: workspaceId },
        data: {
          status: data.status ?? existing.status,
          checklist: data.checklist ?? existing.checklist,
          notes: data.notes ?? existing.notes,
          success_criteria: data.success_criteria ?? existing.success_criteria,
          target_go_live_date: data.target_go_live_date
            ? new Date(data.target_go_live_date)
            : existing.target_go_live_date,
        },
      });
    }
    return this.prisma.onboardingProject.create({
      data: {
        workspace: { connect: { id: workspaceId } },
        plan_key: data.plan_key ?? "BUSINESS_PLUS",
        checklist: data.checklist ?? [],
        status: data.status ?? "IN_PROGRESS",
        notes: data.notes,
        success_criteria: data.success_criteria,
        target_go_live_date: data.target_go_live_date ? new Date(data.target_go_live_date) : null,
      },
    });
  }

  async updateProject(workspaceId: string, data: Record<string, any>) {
    const updateData: Record<string, any> = {
      status: data.status,
      target_go_live_date: data.target_go_live_date
        ? new Date(data.target_go_live_date)
        : undefined,
      checklist: data.checklist ?? undefined,
      notes: data.notes,
      success_criteria: data.success_criteria,
    };
    if (typeof data.owner_user_id === "string") {
      updateData.owner_user_id = data.owner_user_id;
    }
    return this.prisma.onboardingProject.update({
      where: { workspace_id: workspaceId },
      data: updateData,
    });
  }

  async updateChecklistItem(
    workspaceId: string,
    categoryIndex: number,
    itemIndex: number,
    completed: boolean,
    notes?: string,
  ) {
    const project = await this.prisma.onboardingProject.findUnique({
      where: { workspace_id: workspaceId },
      select: { checklist: true },
    });
    if (!project) throw new NotFoundException("Proyecto de onboarding no encontrado.");

    const checklist = (project.checklist as ChecklistCategory[]) ?? [];
    if (checklist[categoryIndex]?.items?.[itemIndex]) {
      checklist[categoryIndex].items[itemIndex].completed = completed;
      if (notes !== undefined) checklist[categoryIndex].items[itemIndex].notes = notes;
    }

    return this.prisma.onboardingProject.update({
      where: { workspace_id: workspaceId },
      data: { checklist },
    });
  }
}
