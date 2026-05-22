import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { EmrendeAiService } from "./emprende-ai.service";
import { PlanLimitsService } from "../common/plan-limits/plan-limits.service";

class ReplyDto {
  conversationId!: string;
  messageText!: string;
}

class ChatDto {
  message!: string;
  conversationId?: string;
}

class SuggestTasksDto {
  messageText!: string;
  contactId?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("ai/emprende")
export class EmrendeAiController {
  constructor(
    private readonly emprendeAi: EmrendeAiService,
    private readonly planLimits: PlanLimitsService,
  ) {}

  @Post("reply")
  @HttpCode(HttpStatus.OK)
  async getSuggestedReply(
    @CurrentUser() user: { workspace_id: string },
    @Body() dto: ReplyDto,
  ) {
    await this.planLimits.enforcePlanTier(user.workspace_id, "EMPRENDE", "IA de respuestas");
    const reply = await this.emprendeAi.generateReply(
      user.workspace_id,
      dto.conversationId,
      dto.messageText,
    );
    return { reply };
  }

  @Post("chat")
  @HttpCode(HttpStatus.OK)
  async chat(
    @CurrentUser() user: { workspace_id: string },
    @Body() dto: ChatDto,
  ) {
    await this.planLimits.enforcePlanTier(user.workspace_id, "EMPRENDE", "Asistente IA Emprende");
    const ctx = await this.emprendeAi.buildBusinessContext(user.workspace_id);
    const systemPrompt = this.emprendeAi.buildSystemPrompt(ctx);
    const reply = dto.conversationId
      ? await this.emprendeAi.generateReply(
          user.workspace_id,
          dto.conversationId,
          dto.message,
        )
      : await this.emprendeAi.generateReply(user.workspace_id, null, dto.message);
    return {
      reply,
      context: { businessName: ctx.workspaceName, categories: ctx.categories },
    };
  }

  @Post("analyze-contact/:id")
  @HttpCode(HttpStatus.OK)
  async analyzeContact(
    @CurrentUser() user: { workspace_id: string },
    @Param("id") contactId: string,
  ) {
    await this.planLimits.enforcePlanTier(user.workspace_id, "EMPRENDE", "Perfil IA de contacto");
    return this.emprendeAi.analyzeContactProfile(user.workspace_id, contactId);
  }

  @Post("suggest-tasks")
  @HttpCode(HttpStatus.OK)
  async suggestTasks(
    @CurrentUser() user: { workspace_id: string },
    @Body() dto: SuggestTasksDto,
  ) {
    await this.planLimits.enforcePlanTier(user.workspace_id, "EMPRENDE", "Sugerencia de tareas IA");
    return this.emprendeAi.suggestTasksFromMessage(user.workspace_id, dto.messageText);
  }
}
