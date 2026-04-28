import { Injectable } from '@nestjs/common';

type Locale = 'en' | 'es';

type TranslationValue = string | ((params: any) => string);
interface TranslationSet {
  [key: string]: TranslationValue | TranslationSet;
}

const MESSAGES: Record<Locale, TranslationSet> = {
  en: {
    errors: {
      notFound: 'Not found',
      unauthorized: 'Unauthorized',
      forbidden: 'Forbidden',
      planLimit: (p: any) =>
        `Your ${p.plan} plan allows up to ${p.limit} ${p.resource}. Upgrade to add more.`,
      workspaceNotFound: 'Workspace not found',
      userNotFound: 'User not found',
      invalidCredentials: 'Invalid credentials',
      quotaExceeded: 'Quota exceeded',
      planTierRequired: (p: any) =>
        `${p.feature} requires ${p.plan} plan or higher.`,
    },
    notifications: {
      taskOverdue: 'Task overdue',
      conversationUnanswered: 'Unanswered conversation',
      dailySummary: 'Daily Summary',
    },
  },
  es: {
    errors: {
      notFound: 'No encontrado',
      unauthorized: 'No autorizado',
      forbidden: 'Prohibido',
      planLimit: (p: any) =>
        `Tu plan ${p.plan} permite un máximo de ${p.limit} ${p.resource}. Actualizá para agregar más.`,
      workspaceNotFound: 'Workspace no encontrado',
      userNotFound: 'Usuario no encontrado',
      invalidCredentials: 'Credenciales inválidas',
      quotaExceeded: 'Cuota excedida',
      planTierRequired: (p: any) =>
        `${p.feature} requiere plan ${p.plan} o superior.`,
    },
    notifications: {
      taskOverdue: 'Tarea vencida',
      conversationUnanswered: 'Conversación sin respuesta',
      dailySummary: 'Resumen del día',
    },
  },
};

@Injectable()
export class I18nService {
  private locale: Locale = 'es';

  setLocale(locale: string) {
    const normalized = locale?.toLowerCase().startsWith('en') ? 'en' : 'es';
    this.locale = normalized;
  }

  t(key: string, params?: Record<string, any>): string {
    const value = this.resolve(key);
    if (typeof value === 'function') {
      return value(params || {});
    }
    if (typeof value === 'string') {
      return value;
    }
    return key;
  }

  private resolve(key: string): TranslationValue | TranslationSet | undefined {
    const parts = key.split('.');
    let current: any = MESSAGES[this.locale];
    for (const part of parts) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }
}
