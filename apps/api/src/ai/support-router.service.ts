import { Injectable } from '@nestjs/common';

export type AgentType = 'hubby' | 'docs' | 'onboarding' | 'inbox' | 'billing' | 'troubleshooting' | 'escalation';

interface RouteRule {
  keywords: string[];
  agent: AgentType;
}

@Injectable()
export class SupportRouterService {
  private readonly routes: RouteRule[] = [
    {
      keywords: ['factura', 'facturas', 'facturación', 'cobro', 'cobrar', 'pago', 'pagar',
        'plan', 'planes', 'precio', 'precios', 'suscripción', 'subscription', 'downgrade',
        'upgrade', 'reembolso', 'refund', 'límite', 'limite', 'billing', 'invoice'],
      agent: 'billing',
    },
    {
      keywords: ['whatsapp', 'mensaje', 'mensajes', 'conversación', 'conversacion',
        'conversaciones', 'bandeja', 'inbox', 'asignar', 'asignación', 'asignacion',
        'reenviar', 'reenvío', 'cliente escribió', 'cliente escribio', 'responder',
        'email', 'correo', 'formulario', 'telegram'],
      agent: 'inbox',
    },
    {
      keywords: ['no funciona', 'error', 'falla', 'falló', 'fallo', 'roto', 'bug',
        'problema', 'no puedo', 'no carga', 'lento', 'lenta', 'crash', 'caído',
        'caido', 'no entra', 'no recibo', 'no llega', 'no envía', 'no envia',
        'no sincroniza', 'desapareció', 'desaparecio', 'perdí', 'perdi'],
      agent: 'troubleshooting',
    },
    {
      keywords: ['cómo', 'como', 'documentación', 'documentacion', 'guía', 'guia',
        'explicar', 'explicame', 'qué es', 'que es', 'significa', 'dónde', 'donde',
        'configurar', 'configuración', 'configuracion', 'pasos', 'tutorial'],
      agent: 'docs',
    },
    {
      keywords: ['empezar', 'comenzar', 'primeros pasos', 'onboarding', 'workspace',
        'invitar', 'invitación', 'invitacion', 'rol', 'roles', 'permiso', 'permisos',
        'equipo', 'departamento', 'departamentos', 'canal', 'canales'],
      agent: 'onboarding',
    },
    {
      keywords: ['ticket', 'soporte humano', 'hablar con alguien', 'persona real',
        'escalar', 'urgencia', 'urgente', 'emergencia', 'no me resuelve'],
      agent: 'escalation',
    },
  ];

  private readonly toolSets: Record<AgentType, string[]> = {
    hubby: [
      'get_workspace', 'get_stats', 'get_insights', 'search', 'get_settings',
      'list_contacts', 'list_tasks', 'list_invoices', 'list_conversations',
      'get_conversation_detail', 'list_automations', 'get_billing',
      'get_billing_invoices', 'list_pipeline_deals', 'list_documents',
      'create_contact', 'update_contact', 'create_task', 'update_task',
      'create_deal', 'move_deal', 'reply_conversation',
      'create_automation', 'toggle_automation', 'search_pymeshub_docs',
      'get_errors',
    ],
    docs: ['search_pymeshub_docs'],
    onboarding: [
      'get_workspace', 'get_settings', 'search_pymeshub_docs',
      'create_contact', 'create_task',
    ],
    inbox: [
      'list_conversations', 'get_conversation_detail', 'reply_conversation',
      'list_contacts', 'create_contact', 'search_pymeshub_docs',
    ],
    billing: [
      'get_billing', 'get_billing_invoices', 'get_workspace',
      'search_pymeshub_docs',
    ],
    troubleshooting: [
      'get_workspace', 'get_settings', 'get_stats', 'search',
      'search_pymeshub_docs', 'list_conversations', 'get_conversation_detail',
      'get_errors',
    ],
    escalation: ['search_pymeshub_docs'], // minimal tools, just documents for context
  };

  classifyIntent(input: string): { agent: AgentType; confidence: number } {
    const lower = input.toLowerCase();
    let bestAgent: AgentType = 'hubby';
    let bestScore = 0;

    for (const route of this.routes) {
      let score = 0;
      for (const keyword of route.keywords) {
        if (lower.includes(keyword)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestAgent = route.agent;
      }
    }

    return { agent: bestAgent, confidence: bestAgent === 'hubby' ? 0.5 : Math.min(bestScore / 3, 1) };
  }

  getToolSet(agent: AgentType): string[] {
    return this.toolSets[agent] || this.toolSets.hubby;
  }
}
