import { Controller, Get, Post, Body, Param, UseGuards, BadRequestException } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthUser } from "../auth/strategies/jwt.strategy";
import { ContactMemoryService } from "./contact-memory.service";
import { CreditsService } from "./credits.service";
import { AiTokenMeteringService } from "../ai-tokens/ai-token-metering.service";
import { WorkspaceUserRole } from "@prisma/client";

const TOKENS_PER_CREDIT = 1_000;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("memory")
export class MemoryController {
  constructor(
    private readonly contactMemory: ContactMemoryService,
    private readonly credits: CreditsService,
    private readonly aiTokens: AiTokenMeteringService,
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

  @Post("transfer-to-tokens")
  @Roles(WorkspaceUserRole.ADMIN, WorkspaceUserRole.OWNER)
  async transferCreditsToTokens(
    @CurrentUser() user: AuthUser,
    @Body() body: { credits: number },
  ) {
    const amount = Math.floor(body.credits ?? 0);
    if (!amount || amount < 1) {
      throw new BadRequestException("Debe transferir al menos 1 crédito.");
    }
    if (amount > 10_000) {
      throw new BadRequestException("No se pueden transferir más de 10,000 créditos a la vez.");
    }

    const currentCredits = await this.credits.getBalance(user.workspace_id);
    if (currentCredits < amount) {
      throw new BadRequestException(
        `Créditos insuficientes. Tenés ${currentCredits}, querés transferir ${amount}.`,
      );
    }

    const tokensToAdd = amount * TOKENS_PER_CREDIT;

    await this.credits.deductCredits(
      user.workspace_id,
      amount,
      `Transferencia a tokens IA: ${amount} créditos → ${tokensToAdd.toLocaleString()} tokens`,
    );

    const tokenBalance = await this.aiTokens.addTokens(
      user.workspace_id,
      tokensToAdd,
      "PURCHASE",
      `Convertidos desde ${amount} crédito${amount !== 1 ? "s" : ""} de memoria`,
    );

    const newCreditBalance = await this.credits.getBalance(user.workspace_id);

    return {
      ok: true,
      credits_used: amount,
      tokens_added: tokensToAdd,
      new_credit_balance: newCreditBalance,
      token_balance: tokenBalance,
    };
  }
}
