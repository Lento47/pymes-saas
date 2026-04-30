import { Injectable, Logger } from '@nestjs/common';

interface DocEntry {
  slug: string;
  title: string;
  category: string;
  summary: string;
  sections: string[];
}

@Injectable()
export class DocsService {
  private readonly logger = new Logger(DocsService.name);
  private readonly docs: DocEntry[] = [
    {
      slug: 'platform-overview',
      title: 'Visión General de la Plataforma',
      category: 'architecture',
      summary: 'PymesHub es una plataforma de customer operations que unifica conversaciones omnicanal, facturación, pipeline de ventas, gestión documental, automatizaciones y gobernanza de workspace.',
      sections: [
        'Componentes: Bandeja omnicanal (WhatsApp, email), Gestión de contactos y leads, Facturación y cobro, Pipeline y tareas, Documentos y archivos, Automatizaciones inteligentes, Gobernanza del workspace.',
        'Arquitectura: Frontend React SPA, API NestJS con GraphQL y REST, PostgreSQL con Prisma ORM, Object storage S3/MinIO, BullMQ sobre Redis para workers, WebSockets para notificaciones.',
        'Seguridad: Aislamiento multi-tenant, cifrado TLS 1.3 en tránsito y en reposo, autenticación JWT con refresh tokens rotativos, RBAC por rol, auditoría de acciones críticas, backups diarios.',
        'Modelo de responsabilidad: PymesHub como responsable de datos de cuenta y facturación; como encargado de datos que el cliente carga en la plataforma.',
      ],
    },
    {
      slug: 'workspace-launch-guide',
      title: 'Guía de Lanzamiento de Workspace',
      category: 'operations',
      summary: 'Guía paso a paso para activar un workspace con roles, canales, departamentos y documentación.',
      sections: [
        'Paso 1: Crear workspace con slug único y nombre comercial.',
        'Paso 2: Configurar roles (OWNER, ADMIN, AGENT, VIEWER) e invitar miembros.',
        'Paso 3: Configurar canales — WhatsApp (conectar número, configurar plantillas) y correo electrónico.',
        'Paso 4: Organizar departamentos (Ventas, Soporte, Finanzas, Operaciones).',
        'Paso 5: Configurar pipeline con etapas (Lead → Calificado → Propuesta → Negociación → Cerrado).',
        'Paso 6: Revisar documentos de confianza (Términos, Privacidad, DPA, SLA, Soporte, Subencargados).',
        'Paso 7: Activar workspace y verificar flujo completo.',
      ],
    },
    {
      slug: 'support-policy',
      title: 'Política de Soporte',
      category: 'operations',
      summary: 'Define cómo PymesHub recibe, clasifica, gestiona y cierra solicitudes de soporte.',
      sections: [
        'Canales autorizados: correo de soporte, formulario dentro de la app, canal de incidentes críticos.',
        'Horario de atención: laboral de Costa Rica. Incidentes críticos escalables fuera de horario.',
        'Prioridades: P1 Crítico (servicio caído), P2 Alto (funcionalidad degradada), P3 Medio (error acotado), P4 Bajo (consultas).',
        'Tiempos orientativos de primera respuesta: P1 mismo día, P2 ventana laboral prioritaria, P3 cola regular, P4 según capacidad.',
        'Flujo: Recepción → Registro → Clasificación → Asignación → Análisis/Respuesta → Cierre.',
        'Escalamiento requerido cuando: incidente de seguridad, impacto multi-tenant, reclamo de privacidad, cambio de contrato o facturación.',
        'Exclusiones del soporte base: desarrollo a medida, integraciones especiales, limpieza manual extensa, capacitación fuera del onboarding.',
      ],
    },
    {
      slug: 'sla',
      title: 'SLA Base',
      category: 'operations',
      summary: 'Objetivo de disponibilidad mensual y criterios de manejo de incidentes.',
      sections: [
        'Disponibilidad objetivo mensual para componentes principales del servicio.',
        'Exclusiones: mantenimientos programados, fuerza mayor, eventos de terceros, configuraciones del cliente, uso prohibido.',
        'Mantenimientos programados anunciados con anticipación en ventanas de menor impacto.',
        'Incidentes severos (P1/SEV-1): activación prioritaria, contención inmediata, comunicación a clientes impactados.',
        'Créditos no automáticos — requieren pacto enterprise expreso.',
      ],
    },
    {
      slug: 'trust-center-overview',
      title: 'Trust Center',
      category: 'security',
      summary: 'Material de confianza, seguridad y cumplimiento para procurement, IT, seguridad y compliance.',
      sections: [
        'Seguridad: Control de acceso por roles, política de seguridad, respuesta a incidentes, desarrollo seguro.',
        'Privacidad: Política de Privacidad, Data Processing Addendum, Retención y Eliminación, Aviso de Subencargados.',
        'Operación: SLA Base, Política de Soporte, Guía de Lanzamiento.',
        'Cumplimiento: Términos de Servicio, AUP, Audit Logging, Aceptación Legal en Producto.',
        'Controles: Autenticación JWT, TLS 1.3, cifrado en reposo, segregación multi-tenant, backups diarios, capacitación del personal.',
        'Respuesta a incidentes: Detección automatizada, clasificación SEV-1 a SEV-4, contención inmediata, notificación a clientes.',
        'Cumplimiento normativo: Ley 8968 (CR), Ley 8454, Ley 7472, buenas prácticas GDPR.',
      ],
    },
    {
      slug: 'terms-of-service',
      title: 'Términos de Servicio',
      category: 'legal',
      summary: 'Reglas de acceso, uso, licencia, pagos, suspensión, responsabilidad y ley aplicable.',
      sections: [
        'Aceptación electrónica con evidencia de versión, fecha y cuenta.',
        'Roles de responsable y encargado según uso de la Plataforma.',
        'Restricciones de uso: no actividades ilícitas, spam, malware, ingeniería inversa, datos sensibles sin autorización.',
        'Suspensión por incumplimiento material, riesgo de seguridad, requerimiento legal o impago.',
        'Limitación de responsabilidad: hasta el monto pagado en 12 meses previos, con carve-outs para dolo, culpa grave y violaciones de datos.',
        'Ley aplicable: Costa Rica. Para consumidores, interpretación según Ley 7472.',
      ],
    },
    {
      slug: 'privacy-policy',
      title: 'Política de Privacidad',
      category: 'legal',
      summary: 'Cómo PymesHub recopila, usa, conserva, comparte y protege datos personales.',
      sections: [
        'Datos recopilados: cuenta, autenticación, mensajes, contactos, facturas, documentos, actividad de uso.',
        'Finalidades: crear cuenta, prestar servicio, emitir comprobantes, soporte, seguridad, comunicaciones.',
        'Base legal: consentimiento expreso (regla general en Costa Rica), ejecución contractual, obligación legal.',
        'Proveedores: infraestructura, mensajería, analítica, pagos, IA — sujetos a confidencialidad contractual.',
        'Transferencias internacionales: envío a encargados no es transferencia si no reutilizan datos.',
        'Derechos del titular: acceso, rectificación, supresión, revocación. Plazo de respuesta: 5 días hábiles.',
        'Seguridad: medidas administrativas, físicas y lógicas. Notificación de vulneración en 5 días hábiles.',
        'Retención: máximo 10 años para datos que puedan afectar al titular, disociación permitida para conservación más larga.',
      ],
    },
    {
      slug: 'billing-refunds-policy',
      title: 'Facturación y Reembolsos',
      category: 'legal',
      summary: 'Ciclos de cobro, renovación, impuestos, cancelación, downgrade y política de reembolsos.',
      sections: [
        'Planes: Starter ($25/mes), Growth ($59/mes), Business ($119/mes), Business+ (personalizado).',
        'Add-ons disponibles: Usuario extra ($8/mes), WhatsApp + Analíticas ($19/mes), Asistente IA ($29/mes), Inventario avanzado ($29/mes), Aprobaciones y firma digital ($25/mes).',
        'Ciclos de facturación mensual. Renovación automática salvo cancelación antes de la fecha de renovación.',
        'Pagos no reembolsables una vez iniciado el período, excepto cobro duplicado o error manifiesto.',
        'Impuestos aplicables según normativa costarricense. Paddle maneja la conversión de moneda.',
        'Chargebacks: PymeHub puede suspender el servicio hasta regularización y cobrar costos razonables.',
      ],
    },
    {
      slug: 'whatsapp-ai-policy',
      title: 'Política de WhatsApp e IA',
      category: 'legal',
      summary: 'Reglas de uso de canales WhatsApp y funcionalidades asistidas por inteligencia artificial.',
      sections: [
        'Opt-in obligatorio y verificable para mensajes de WhatsApp.',
        'Respeto de opt-out y ventana de 24 horas para mensajes libres.',
        'Prohibición de datos sensibles en prompts de IA (tarjetas, credenciales, salud).',
        'Revisión humana obligatoria para decisiones de alto impacto.',
        'El cliente es responsable de validar outputs de IA antes de usarlos operativamente.',
        'Las funcionalidades de IA se ofrecen como apoyo operativo, no como decisión final.',
      ],
    },
    {
      slug: 'cookies-policy',
      title: 'Política de Cookies',
      category: 'legal',
      summary: 'Tipos de cookies utilizadas, finalidad, duración y mecanismos de gestión del consentimiento.',
      sections: [
        'Cookies estrictamente necesarias para el funcionamiento del sitio.',
        'Cookies de analítica, preferencias y marketing sujetas a consentimiento.',
        'El usuario puede aceptar, rechazar o retirar consentimiento desde el banner o centro de preferencias.',
        'Cada categoría lista proveedor, finalidad, duración y mecanismo de desactivación.',
      ],
    },
    {
      slug: 'data-processing-addendum',
      title: 'Data Processing Addendum (DPA)',
      category: 'legal',
      summary: 'Reglas vinculantes cuando el cliente es responsable y PymeHub actúa como encargado del tratamiento.',
      sections: [
        'PymeHub trata datos solo conforme a instrucciones documentadas del cliente.',
        'Subencargados autorizados con lista pública y mecanismo de objeción.',
        'Medidas de seguridad técnicas, administrativas y físicas.',
        'Notificación de incidentes sin demora indebida.',
        'Retorno o supresión de datos al terminar la relación en 30 días.',
        'Transferencias internacionales bajo SCCs o equivalentes.',
      ],
    },
    {
      slug: 'acceptable-use-policy',
      title: 'Política de Uso Aceptable (AUP)',
      category: 'legal',
      summary: 'Conductas permitidas y prohibidas al usar PymeHub.',
      sections: [
        'Prohibido: uso ilegal, spam, malware, infracción de propiedad intelectual, datos sensibles sin autorización.',
        'Reglas específicas de WhatsApp: opt-in obligatorio, respetar opt-out, usar plantillas aprobadas.',
        'Reglas de IA: no usar outputs sin revisión humana en decisiones sensibles.',
        'Consecuencias por incumplimiento: suspensión o terminación del servicio.',
      ],
    },
    {
      slug: 'subprocessors-notice',
      title: 'Aviso de Subencargados',
      category: 'legal',
      summary: 'Lista pública de terceros que tratan datos por cuenta de PymeHub.',
      sections: [
        'Proveedores listados con función, categorías de datos y región de tratamiento.',
        'Actualizaciones notificadas con anticipación. Cliente puede objetar por motivos razonables.',
        'Todos los subencargados sujetos a confidencialidad, seguridad y limitación de finalidad.',
      ],
    },
  ];

  search(query: string): { title: string; slug: string; snippet: string }[] {
    const q = query.toLowerCase();
    const results: { title: string; slug: string; snippet: string; score: number }[] = [];

    for (const doc of this.docs) {
      let score = 0;
      let bestSnippet = doc.summary;

      if (doc.title.toLowerCase().includes(q)) score += 3;
      if (doc.summary.toLowerCase().includes(q)) score += 2;

      for (const section of doc.sections) {
        if (section.toLowerCase().includes(q)) {
          score += 2;
          const idx = section.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 60);
          const end = Math.min(section.length, idx + q.length + 120);
          bestSnippet = (start > 0 ? '…' : '') + section.slice(start, end) + (end < section.length ? '…' : '');
        }
      }

      const words = q.split(/\s+/);
      for (const word of words) {
        if (word.length < 3) continue;
        if (doc.title.toLowerCase().includes(word)) score += 1;
        for (const section of doc.sections) {
          if (section.toLowerCase().includes(word)) score += 1;
        }
      }

      if (score > 0) {
        results.push({ title: doc.title, slug: doc.slug, snippet: bestSnippet, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5).map(({ title, slug, snippet }) => ({ title, slug, snippet }));
  }
}
