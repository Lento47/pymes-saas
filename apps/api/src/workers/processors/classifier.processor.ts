import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { stringifyJson } from '../../common/prisma/json';
import { QUEUE_NAMES } from '../queues.constants';

interface ClassifierJobData {
  messageId: string;
  workspaceId: string;
}

@Injectable()
@Processor(QUEUE_NAMES.CLASSIFIER)
export class ClassifierProcessor extends WorkerHost {
  private readonly logger = new Logger(ClassifierProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ClassifierJobData>): Promise<any> {
    const { messageId, workspaceId } = job.data;

    this.logger.log(`Processing classifier job ${job.id} for message ${messageId}`);

    // 1. Cargar mensaje
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, workspace_id: workspaceId },
    });

    // 2. Si no existe, return
    if (!message) {
      this.logger.warn(`Message ${messageId} not found in workspace ${workspaceId}, skipping.`);
      return;
    }

    // 3. Clasificar con lógica simple
    const urgentKeywords = ['urgente', 'urgent', 'asap', 'inmediatamente', 'emergencia', 'critical'];
    const isUrgent = urgentKeywords.some((k) =>
      message.body_text?.toLowerCase().includes(k),
    );

    const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/;
    const hasDate = dateRegex.test(message.body_text ?? '');

    const category = isUrgent ? 'urgente' : 'general';
    const sentiment = isUrgent ? 'negative' : 'neutral';

    // 4. Actualizar mensaje con clasificación
    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        ai_classification_json: stringifyJson({
          isUrgent,
          hasDate,
          category,
          sentiment,
          processed_at: new Date().toISOString(),
        }),
      },
    });

    // 5. Si es urgente, actualizar prioridad de la conversación
    if (isUrgent) {
      await this.prisma.conversation.update({
        where: { id: message.conversation_id },
        data: { priority: 'URGENT' },
      });
      this.logger.log(
        `Conversation ${message.conversation_id} marked as URGENT due to urgent message ${messageId}`,
      );
    }

    // 6. Log resultado
    this.logger.log(
      `Classifier job ${job.id} completed: message=${messageId}, category=${category}, isUrgent=${isUrgent}, hasDate=${hasDate}`,
    );

    return { messageId, category, isUrgent, hasDate, sentiment };
  }
}
