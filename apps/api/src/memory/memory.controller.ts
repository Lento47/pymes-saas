import { Controller, Get, Post, Body, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { ContactMemoryService } from "./contact-memory.service";
import { CreditsService } from "./credits.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("memory")
export class MemoryController {
  constructor(
    private readonly contactMemory: ContactMemoryService,
    private readonly credits: CreditsService,
  ) {}

  @Get("credits")
  async getCredits(@CurrentUser() user: AuthUser) {
    const balance = await this.credits.getBalance(user.workspace_id);
    const history = await this.credits.getTransactionHistory(user.workspace_id);
    const packs = this.credits.getCreditPacks();
    return { balance, history, packs };
  }

  @Get("contacts/:contactId")
  async getContactMemory(
    @CurrentUser() user: AuthUser,
    @Param("contactId") contactId: string,
  ) {
    const status = await this.contactMemory.getMemoryStatus(contactId);
    const profile = await this.contactMemory.getActiveProfile(contactId);
    return { status, profile };
  }

  @Post("contacts/:contactId/extend")
  async extendMemory(
    @CurrentUser() user: AuthUser,
    @Param("contactId") contactId: string,
    @Body() body: { days: number },
  ) {
    const days = Math.min(Math.max(body.days ?? 30, 1), 365);
    const credits = await this.credits.getBalance(user.workspace_id);
    if (credits < days) {
      return { ok: false, message: `Créditos insuficientes. Tenés ${credits}, necesitás ${days}.` };
    }
    await this.credits.deductCredits(
      user.workspace_id,
      days,
      `Extensión manual: contacto ${contactId} por ${days} días`,
    );
    await this.contactMemory.extendMemory(user.workspace_id, contactId, days);
    return { ok: true, days_extended: days, new_balance: credits - days };
  }
}
