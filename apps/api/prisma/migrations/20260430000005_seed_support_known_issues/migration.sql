-- Seed initial known issues for support diagnostics
INSERT INTO "support_known_issues" ("id", "error_code", "title", "module", "category", "severity", "description", "workaround", "fix_status", "updated_at")
VALUES
  ('seed_001', 'ERR-INBOX-ROUTING-4021', 'Conversation assignment fails in Inbox', 'inbox', 'PRODUCT_BUG', 'medium',
   'Admin users report that WhatsApp conversation assignment sometimes fails with routing error.',
   'Try assigning from the conversation detail view instead of the list view.', 'OPEN', NOW()),
  ('seed_002', 'ERR-WHATSAPP-WEBHOOK-500', 'WhatsApp webhook not receiving events', 'inbox', 'INTEGRATION_ISSUE', 'high',
   'Meta webhook configuration may have changed or token expired.',
   'Verify webhook URL in Meta Business settings and re-enable the channel in PymesHub.', 'OPEN', NOW()),
  ('seed_003', 'ERR-BILLING-INVOICE-404', 'Billing invoice PDF not generated', 'billing', 'PRODUCT_BUG', 'low',
   'Some invoices fail PDF generation on first attempt.',
   'Wait a few minutes and refresh. The invoice PDF is generated asynchronously.', 'FIX_IN_PROGRESS', NOW()),
  ('seed_004', 'ERR-AUTH-TOKEN-EXPIRED', 'Authentication token expired during action', 'auth', 'PERMISSION_ISSUE', 'low',
   'Session expired while performing a critical action.',
   'Refresh the page or log out and back in to get a fresh token.', 'FIXED', NOW()),
  ('seed_005', 'ERR-PLAN-LIMIT-INVOICES', 'Invoice creation blocked by plan limit', 'billing', 'BILLING_OR_PLAN', 'medium',
   'Workspace reached its monthly invoice limit.',
   'Upgrade to a higher plan or wait until next billing cycle.', 'WONT_FIX', NOW()),
  ('seed_006', 'ERR-AUTOMATION-TRIGGER-FAIL', 'Automation rule trigger failed silently', 'automations', 'PRODUCT_BUG', 'medium',
   'Some automation rules with email notifications fail to fire.',
   'Disable and re-enable the automation rule, or recreate it with the same conditions.', 'OPEN', NOW()),
  ('seed_007', 'ERR-DOCUMENT-UPLOAD-TIMEOUT', 'Large document upload timed out', 'documents', 'PRODUCT_BUG', 'low',
   'Files larger than 20MB may timeout on slow connections.',
   'Compress the file or split into smaller files before uploading.', 'OPEN', NOW()),
  ('seed_008', 'ERR-PIPELINE-STAGE-LOST', 'Pipeline deal stage reverted after move', 'pipeline', 'PRODUCT_BUG', 'high',
   'Deal stage changes occasionally revert after moving between columns.',
   'Move the deal again and verify the stage change persists. Engineering investigating.', 'FIX_IN_PROGRESS', NOW())
ON CONFLICT ("error_code") DO NOTHING;
