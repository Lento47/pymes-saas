import { Injectable } from '@nestjs/common';
import { ClassifierProcessor } from './processors/classifier.processor';
import { DocumentProcessor } from './processors/document.processor';
import { AutomationProcessor } from './processors/automation.processor';
import { NotificationProcessor } from './processors/notification.processor';

@Injectable()
export class QueueService {
  constructor(
    private readonly classifier: ClassifierProcessor,
    private readonly document: DocumentProcessor,
    private readonly automation: AutomationProcessor,
    private readonly notification: NotificationProcessor,
  ) {}

  async enqueueClassifier(messageId: string, workspaceId: string): Promise<void> {
    setImmediate(() => this.classifier.process({ messageId, workspaceId }));
  }

  async enqueueDocument(documentId: string, workspaceId: string): Promise<void> {
    setImmediate(() => this.document.process({ documentId, workspaceId }));
  }

  async enqueueAutomation(
    ruleId: string,
    workspaceId: string,
    triggerEntityType: string,
    triggerEntityId: string,
  ): Promise<void> {
    setImmediate(() =>
      this.automation.process({ ruleId, workspaceId, triggerEntityType, triggerEntityId }),
    );
  }

  async enqueueNotification(
    workspaceId: string,
    userId: string,
    type: string,
    title: string,
    body: string,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ): Promise<void> {
    setImmediate(() =>
      this.notification.process({
        workspaceId,
        userId,
        type,
        title,
        body,
        relatedEntityType,
        relatedEntityId,
      }),
    );
  }
}
