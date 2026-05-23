import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";

const MEMORY_TTL_DAYS = 14;

export interface ContactMemoryProfile {
  summary: string;
  common_requests: string[];
  communication_style: string;
  last_intent?: string;
  last_interaction_at?: string;
  preferences?: Record<string, string>;
}

@Injectable()
export class ContactMemoryService {
  private readonly logger = new Logger(ContactMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getActiveProfile(contactId: string): Promise<ContactMemoryProfile | null> {
    const memory = await this.prisma.contactAiMemory.findUnique({
      where: { contact_id: contactId },
      select: { status: true, profile_json: true, expires_at: true, extended_until: true },
    });

    if (!memory) return null;

    // Paused → not injected into agent context
    if (memory.status === "PAUSED") return null;

    const now = new Date();
    const effectiveExpiry = memory.extended_until ?? memory.expires_at;
    if (effectiveExpiry < now) return null;

    return memory.profile_json as ContactMemoryProfile;
  }

  async upsertProfile(
    workspaceId: string,
    contactId: string,
    updates: Partial<ContactMemoryProfile>,
  ): Promise<void> {
    const existing = await this.prisma.contactAiMemory.findUnique({
      where: { contact_id: contactId },
      select: { profile_json: true, status: true, expires_at: true },
    });

    if (!existing) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + MEMORY_TTL_DAYS);

      await this.prisma.contactAiMemory.create({
        data: {
          contact_id: contactId,
          workspace_id: workspaceId,
          profile_json: { ...updates } as any,
          status: "ACTIVE",
          expires_at: expiresAt,
        },
      });
      return;
    }

    // Merge with existing profile
    const current = (existing.profile_json as Record<string, any>) ?? {};
    const merged = this.mergeProfile(current, updates);

    await this.prisma.contactAiMemory.update({
      where: { contact_id: contactId },
      data: {
        profile_json: merged as any,
        // Reactivate if it was paused and credits are available (TTL not exceeded)
        status: existing.status === "PAUSED" ? "PAUSED" : "ACTIVE",
      },
    });
  }

  async enrichFromAgentRun(
    workspaceId: string,
    contactId: string,
    intent: string,
    collected: Record<string, string | null>,
  ): Promise<void> {
    const profile = await this.getFullProfile(contactId);
    const current = profile ?? { summary: "", common_requests: [], communication_style: "casual" };

    // Update common_requests
    const mainItem = collected.product ?? collected.service ?? collected.issue ?? null;
    if (mainItem && !current.common_requests.includes(mainItem)) {
      current.common_requests = [...(current.common_requests ?? []).slice(-9), mainItem];
    }

    current.last_intent = intent;
    current.last_interaction_at = new Date().toISOString();

    // Carry over delivery preferences
    if (collected.delivery_type) {
      current.preferences = { ...current.preferences, delivery_type: collected.delivery_type };
    }
    if (collected.address) {
      current.preferences = { ...current.preferences, address: collected.address };
    }
    if (collected.time) {
      current.preferences = { ...current.preferences, preferred_time: collected.time };
    }

    await this.upsertProfile(workspaceId, contactId, current);
  }

  async extendMemory(workspaceId: string, contactId: string, days: number): Promise<void> {
    const memory = await this.prisma.contactAiMemory.findUnique({
      where: { contact_id: contactId },
      select: { extended_until: true, expires_at: true, status: true },
    });

    if (!memory) return;

    const base = memory.extended_until ?? memory.expires_at;
    const newExpiry = new Date(Math.max(base.getTime(), Date.now()));
    newExpiry.setDate(newExpiry.getDate() + days);

    await this.prisma.contactAiMemory.update({
      where: { contact_id: contactId },
      data: {
        extended_until: newExpiry,
        status: "EXTENDED",
      },
    });
  }

  async pauseExpired(workspaceId: string): Promise<number> {
    const now = new Date();
    const result = await this.prisma.contactAiMemory.updateMany({
      where: {
        workspace_id: workspaceId,
        status: { in: ["ACTIVE", "EXTENDED"] },
        expires_at: { lt: now },
        extended_until: null,
      },
      data: { status: "PAUSED" },
    });

    // Also pause EXTENDED ones where extended_until has passed
    const result2 = await this.prisma.contactAiMemory.updateMany({
      where: {
        workspace_id: workspaceId,
        status: "EXTENDED",
        extended_until: { lt: now },
      },
      data: { status: "PAUSED" },
    });

    return result.count + result2.count;
  }

  // Returns count of active contacts with memory (for credit deduction)
  async countActiveMemories(workspaceId: string): Promise<number> {
    const now = new Date();
    return this.prisma.contactAiMemory.count({
      where: {
        workspace_id: workspaceId,
        status: "EXTENDED",
        extended_until: { gte: now },
      },
    });
  }

  async getMemoryStatus(contactId: string) {
    return this.prisma.contactAiMemory.findUnique({
      where: { contact_id: contactId },
      select: { status: true, expires_at: true, extended_until: true, created_at: true },
    });
  }

  private async getFullProfile(contactId: string): Promise<ContactMemoryProfile | null> {
    const memory = await this.prisma.contactAiMemory.findUnique({
      where: { contact_id: contactId },
      select: { profile_json: true },
    });
    return memory ? (memory.profile_json as ContactMemoryProfile) : null;
  }

  private mergeProfile(
    current: Record<string, any>,
    updates: Partial<ContactMemoryProfile>,
  ): ContactMemoryProfile {
    return {
      summary: updates.summary ?? current.summary ?? "",
      common_requests: updates.common_requests ?? current.common_requests ?? [],
      communication_style: updates.communication_style ?? current.communication_style ?? "casual",
      last_intent: updates.last_intent ?? current.last_intent,
      last_interaction_at: updates.last_interaction_at ?? current.last_interaction_at,
      preferences: { ...(current.preferences ?? {}), ...(updates.preferences ?? {}) },
    };
  }
}
