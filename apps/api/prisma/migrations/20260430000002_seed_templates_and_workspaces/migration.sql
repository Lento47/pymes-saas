-- Seed: System Templates (automation, message, invoice)
-- Seed: Workspace Templates (retail, services, healthcare, restaurant)

-- ============================================================
-- SYSTEM TEMPLATES — Automation (6)
-- ============================================================
INSERT INTO "system_templates" ("id", "key", "type", "name", "description", "category", "channel", "body", "order", "created_at", "updated_at") VALUES
(gen_random_uuid(), 'auto.assign-whatsapp-urgent', 'automation', 'Asignar WhatsApp urgente', 'Asigna automáticamente conversaciones urgentes de WhatsApp al dueño del workspace', 'sales', NULL, '{"trigger_type": "MESSAGE_RECEIVED", "trigger_config_json": {"channel": "WHATSAPP"}, "condition_config_json": {"field": "priority", "operator": "eq", "value": "URGENT"}, "action_config_json": {"type": "assign", "assigned_user_id": "__OWNER__"}}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'auto.tag-invoice-conversations', 'automation', 'Etiquetar conversación de factura', 'Detecta mensajes sobre facturas y los categoriza como billing', 'billing', NULL, '{"trigger_type": "MESSAGE_RECEIVED", "trigger_config_json": {"keywords": ["factura", "pago", "cobro", "deuda", "invoice"]}, "condition_config_json": {"field": "body_text", "operator": "contains", "value": "factura"}, "action_config_json": {"type": "set_status", "status": "PENDING"}}', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'auto.notify-overdue-invoice', 'automation', 'Notificar factura vencida', 'Notifica al dueño cuando una factura está vencida', 'billing', NULL, '{"trigger_type": "TASK_OVERDUE", "trigger_config_json": {}, "condition_config_json": null, "action_config_json": {"type": "notify_in_app", "title": "Factura vencida", "body": "Hay una factura vencida que requiere atención."}}', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'auto.create-task-for-lead', 'automation', 'Crear tarea para nuevo lead', 'Crea una tarea de seguimiento cuando entra un nuevo lead', 'sales', NULL, '{"trigger_type": "CONVERSATION_CREATED", "trigger_config_json": {"channel": "FORM"}, "condition_config_json": null, "action_config_json": {"type": "create_task", "title": "Seguimiento de nuevo lead", "description": "Contactar al lead en las próximas 24 horas."}}', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'auto.warn-wa-window-closing', 'automation', 'Avisar ventana de WhatsApp cerrando', 'Notifica al agente cuando la ventana de 24h de WhatsApp está por cerrar', 'support', NULL, '{"trigger_type": "CONVERSATION_STATUS_CHANGED", "trigger_config_json": {}, "condition_config_json": {"field": "is_service_window_open", "operator": "eq", "value": "true"}, "action_config_json": {"type": "notify_in_app", "title": "Ventana WhatsApp cerrando", "body": "Responde pronto. La ventana de servicio está por cerrar."}}', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'auto.resolve-after-task-done', 'automation', 'Cerrar conversación al completar tarea', 'Marca la conversación como resuelta cuando todas las tareas están completadas', 'general', NULL, '{"trigger_type": "TASK_CREATED", "trigger_config_json": {}, "condition_config_json": null, "action_config_json": {"type": "set_status", "status": "RESOLVED"}}', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- ============================================================
-- SYSTEM TEMPLATES — Message (6)
-- ============================================================
INSERT INTO "system_templates" ("id", "key", "type", "name", "description", "category", "channel", "body", "order", "created_at", "updated_at") VALUES
(gen_random_uuid(), 'msg.welcome-whatsapp', 'message', 'Saludo de bienvenida (WhatsApp)', 'Mensaje de bienvenida para nuevos contactos', 'onboarding', 'whatsapp', '{"body": "¡Hola {{name}}! 👋 Gracias por contactar a PymeHub. ¿En qué podemos ayudarte hoy?", "variables": {"name": "Nombre del contacto"}, "language": "es"}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'msg.quote-ready', 'message', 'Cotización lista', 'Aviso de que la cotización está lista para revisión', 'sales', 'whatsapp', '{"body": "Tu cotización #{{quote}} para {{service}} está lista. Total: {{amount}}. ¿Te gustaría revisarla?", "variables": {"quote": "Número de cotización", "service": "Servicio", "amount": "Monto"}, "language": "es"}', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'msg.payment-reminder', 'message', 'Recordatorio de pago', 'Recordatorio amable de factura pendiente', 'billing', 'email', '{"body": "Estimado/a {{name}},\n\nTe recordamos que tu factura {{number}} por {{amount}} vence el {{due_date}}.\n\nPuedes realizar el pago en: {{payment_link}}\n\nGracias,\nEquipo PymeHub", "variables": {"name": "Nombre", "number": "Número de factura", "amount": "Monto", "due_date": "Fecha de vencimiento", "payment_link": "Link de pago"}, "language": "es"}', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'msg.follow-up', 'message', 'Seguimiento post-venta', 'Mensaje de seguimiento después de una venta', 'sales', 'email', '{"body": "¡Hola {{name}}!\n\nEsperamos que estés disfrutando de {{product}}. Si tienes alguna duda o necesitas algo, no dudes en contactarnos.\n\n¿Te gustaría dejarnos una reseña?\n\nSaludos,\nEquipo PymeHub", "variables": {"name": "Nombre", "product": "Producto o servicio"}, "language": "es"}', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'msg.received-confirmation', 'message', 'Confirmación de recepción', 'Acuse de recibo automático', 'support', 'whatsapp', '{"body": "¡Gracias {{name}}! Hemos recibido tu mensaje y te responderemos lo antes posible. ⏱️", "variables": {"name": "Nombre del contacto"}, "language": "es"}', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'msg.review-invitation', 'message', 'Invitación a reseña', 'Solicita una reseña o feedback al cliente', 'general', 'email', '{"body": "Hola {{name}},\n\nNos encantaría conocer tu opinión sobre nuestro servicio de {{service}}. Tu feedback nos ayuda a mejorar.\n\nDejar reseña: {{review_link}}\n\n¡Gracias!\nEquipo PymeHub", "variables": {"name": "Nombre", "service": "Servicio", "review_link": "Link de reseña"}, "language": "es"}', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- ============================================================
-- SYSTEM TEMPLATES — Invoice (3)
-- ============================================================
INSERT INTO "system_templates" ("id", "key", "type", "name", "description", "category", "channel", "body", "order", "created_at", "updated_at") VALUES
(gen_random_uuid(), 'inv.standard-cr', 'invoice', 'Factura estándar CR', 'Factura electrónica estándar con IVA 13%, cabecera completa, y formato Hacienda', 'billing', NULL, '{"tax_rate": 13, "tax_code": "01", "currency": "CRC", "show_logo": true, "show_tax_id": true, "show_payment_methods": true, "terms": "Pago a 30 días", "footer": "Gracias por su preferencia."}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'inv.simplified', 'invoice', 'Factura simplificada', 'Factura minimalista: logo, items, total. Para servicios simples.', 'billing', NULL, '{"tax_rate": 13, "tax_code": "01", "currency": "CRC", "show_logo": true, "show_tax_id": false, "show_payment_methods": false, "footer": ""}', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'inv.services', 'invoice', 'Servicios profesionales', 'Factura para servicios profesionales con desglose por horas', 'billing', NULL, '{"tax_rate": 13, "tax_code": "01", "currency": "CRC", "show_logo": true, "show_tax_id": true, "show_payment_methods": true, "line_item_format": "hourly", "terms": "Pago a 15 días", "footer": "Servicios profesionales exentos de retención."}', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- ============================================================
-- WORKSPACE TEMPLATES (4)
-- ============================================================
INSERT INTO "workspace_templates" ("id", "key", "name", "description", "industry", "pipeline_stages", "contact_tags", "automation_rules", "invoice_config", "order", "created_at", "updated_at") VALUES
(gen_random_uuid(), 'workspace.retail', 'Tienda / Retail', 'Configuración para comercios retail: pipeline de ventas, contactos con tags de cliente/proveedor, automatización de seguimiento', 'retail',
  '[{"name": "Consulta", "order": 0, "color": "#6366f1"}, {"name": "Cotización", "order": 1, "color": "#f59e0b"}, {"name": "Venta", "order": 2, "color": "#22c55e"}, {"name": "Entregado", "order": 3, "color": "#6b7280"}]',
  ARRAY['cliente', 'proveedor', 'retail'],
  '[{"name": "Notificar nueva venta", "trigger_type": "CONVERSATION_STATUS_CHANGED", "trigger_config_json": {}, "condition_config_json": {"field": "status", "operator": "eq", "value": "RESOLVED"}, "action_config_json": {"type": "notify_in_app", "title": "Venta completada", "body": "Una venta fue marcada como completada."}, "enabled": true}]',
  '{"tax_rate": 13, "currency": "CRC", "terms": "Pago a 30 días"}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'workspace.services', 'Servicios profesionales', 'Para consultores, abogados, contadores: pipeline de propuesta, facturación por horas, seguimiento de clientes', 'services',
  '[{"name": "Lead", "order": 0, "color": "#6366f1"}, {"name": "Propuesta", "order": 1, "color": "#f59e0b"}, {"name": "Negociación", "order": 2, "color": "#ef4444"}, {"name": "Cerrado", "order": 3, "color": "#22c55e"}]',
  ARRAY['cliente', 'lead', 'servicios'],
  '[{"name": "Seguimiento a 3 días", "trigger_type": "CONVERSATION_CREATED", "trigger_config_json": {}, "condition_config_json": null, "action_config_json": {"type": "create_task", "title": "Seguimiento de propuesta", "description": "Contactar al cliente 3 días después de enviar la propuesta."}, "enabled": true}, {"name": "Notificar propuesta aceptada", "trigger_type": "CONVERSATION_STATUS_CHANGED", "trigger_config_json": {}, "condition_config_json": {"field": "status", "operator": "eq", "value": "RESOLVED"}, "action_config_json": {"type": "notify_in_app", "title": "Propuesta aceptada", "body": "Felicitaciones. El cliente aceptó la propuesta."}, "enabled": true}]',
  '{"tax_rate": 13, "currency": "CRC", "line_item_format": "hourly", "terms": "Pago a 15 días"}', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'workspace.healthcare', 'Clínica / Salud', 'Para clínicas, consultorios y centros de salud: gestión de citas, expedientes simplificados, facturación médica', 'healthcare',
  '[{"name": "Cita pendiente", "order": 0, "color": "#6366f1"}, {"name": "En consulta", "order": 1, "color": "#f59e0b"}, {"name": "Tratamiento", "order": 2, "color": "#ef4444"}, {"name": "Seguimiento", "order": 3, "color": "#22c55e"}]',
  ARRAY['paciente', 'proveedor', 'salud'],
  '[{"name": "Recordatorio de cita", "trigger_type": "TASK_OVERDUE", "trigger_config_json": {}, "condition_config_json": null, "action_config_json": {"type": "notify_in_app", "title": "Cita pendiente", "body": "Hay una cita que requiere seguimiento."}, "enabled": true}]',
  '{"tax_rate": 0, "currency": "CRC", "show_tax_id": true, "terms": "Pago al contado"}', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'workspace.restaurant', 'Restaurante / Gastronomía', 'Para restaurantes y servicios de comida: órdenes rápidas, proveedores, facturas de compra y venta', 'restaurant',
  '[{"name": "Pedido recibido", "order": 0, "color": "#6366f1"}, {"name": "En preparación", "order": 1, "color": "#f59e0b"}, {"name": "Entregado", "order": 2, "color": "#22c55e"}, {"name": "Facturado", "order": 3, "color": "#6b7280"}]',
  ARRAY['cliente', 'proveedor', 'restaurante'],
  '[{"name": "Notificar pedido nuevo", "trigger_type": "CONVERSATION_CREATED", "trigger_config_json": {}, "condition_config_json": null, "action_config_json": {"type": "notify_in_app", "title": "Nuevo pedido", "body": "Se recibió un nuevo pedido."}, "enabled": true}]',
  '{"tax_rate": 13, "currency": "CRC", "terms": "Pago al contado"}', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
