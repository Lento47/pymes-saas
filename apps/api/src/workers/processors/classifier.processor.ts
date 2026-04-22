import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { serializeJson } from '../../common/prisma/enterprise-sqlite-json';

interface ClassifierJobData {
  messageId: string;
  workspaceId: string;
}

@Injectable()
export class ClassifierProcessor {
  private readonly logger = new Logger(ClassifierProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(data: ClassifierJobData): Promise<any> {
    const { messageId, workspaceId } = data;

    this.logger.log(`Processing classifier job for message ${messageId}`);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, workspace_id: workspaceId },
    });

    if (!message) {
      this.logger.warn(`Message ${messageId} not found in workspace ${workspaceId}, skipping.`);
      return;
    }

    const urgentKeywords = ['urgente', 'urgent', 'asap', 'inmediatamente', 'emergencia', 'critical'];
    const isUrgent = urgentKeywords.some((k) =>
      message.body_text?.toLowerCase().includes(k),
    );

    const dateRegex = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/;
    const hasDate = dateRegex.test(message.body_text ?? '');

    const category = isUrgent ? 'urgente' : 'general';
    const sentiment = isUrgent ? 'negative' : 'neutral';

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        ai_classification_json: serializeJson({
          isUrgent,
          hasDate,
          category,
          sentiment,
          processed_at: new Date().toISOString(),
        }),
      },
    });

    if (isUrgent) {
      await this.prisma.conversation.update({
        where: { id: message.conversation_id },
        data: { priority: 'URGENT' },
      });
    }

    this.logger.log(
      `Classifier completed: message=${messageId}, category=${category}, isUrgent=${isUrgent}`,
    );

    return { messageId, category, isUrgent, hasDate, sentiment };
  }
}
