import platformOverviewRaw from "./architecture/platform-overview.md?raw";
import trustCenterOverviewRaw from "./security/trust-center-overview.md?raw";
import workspaceLaunchGuideRaw from "./operations/workspace-launch-guide.md?raw";
import supportPolicyRaw from "./operations/support-policy.md?raw";
import slaRaw from "./operations/sla.md?raw";

import securityPolicyRaw from "./security/security-policy.md?raw";
import incidentResponsePolicyRaw from "./security/incident-response-policy.md?raw";
import accessControlPolicyRaw from "./security/access-control-policy.md?raw";
import dataRetentionAndDeletionPolicyRaw from "./security/data-retention-and-deletion-policy.md?raw";

import onboardingProcessRaw from "./operations/onboarding-process.md?raw";
import offboardingProcessRaw from "./operations/offboarding-process.md?raw";

import legalAcceptanceRequirementsRaw from "./product-compliance/legal-acceptance-requirements.md?raw";
import auditLoggingRequirementsRaw from "./product-compliance/audit-logging-requirements.md?raw";
import aiUsageAndDisclosureRaw from "./product-compliance/ai-usage-and-disclosure.md?raw";
import multiTenantDataIsolationNotesRaw from "./product-compliance/multi-tenant-data-isolation-notes.md?raw";
import windowsInstallerLicenseRequirementsRaw from "./product-compliance/windows-installer-license-requirements.md?raw";

import costaRicaTaxInvoicingGuideRaw from "./business/costa-rica-tax-invoicing-guide.md?raw";
import pricingBillingPolicyRaw from "./business/pricing-billing-policy.md?raw";

import dataFlowDiagramRaw from "./architecture/data-flow-diagram.md?raw";

export const DOCS_CONTENT: Record<string, string> = {
  // Public — architecture
  "platform-overview": platformOverviewRaw,

  // Public — security
  "trust-center-overview": trustCenterOverviewRaw,

  // Public — operations
  "workspace-launch-guide": workspaceLaunchGuideRaw,
  "support-policy": supportPolicyRaw,
  "sla": slaRaw,

  // Internal — security
  "security-policy": securityPolicyRaw,
  "incident-response-policy": incidentResponsePolicyRaw,
  "access-control-policy": accessControlPolicyRaw,
  "data-retention-and-deletion-policy": dataRetentionAndDeletionPolicyRaw,

  // Internal — operations
  "onboarding-process": onboardingProcessRaw,
  "offboarding-process": offboardingProcessRaw,

  // Internal — product-compliance
  "legal-acceptance-requirements": legalAcceptanceRequirementsRaw,
  "audit-logging-requirements": auditLoggingRequirementsRaw,
  "ai-usage-and-disclosure": aiUsageAndDisclosureRaw,
  "multi-tenant-data-isolation-notes": multiTenantDataIsolationNotesRaw,
  "windows-installer-license-requirements": windowsInstallerLicenseRequirementsRaw,

  // Internal — business
  "costa-rica-tax-invoicing-guide": costaRicaTaxInvoicingGuideRaw,
  "pricing-billing-policy": pricingBillingPolicyRaw,

  // Internal — architecture
  "data-flow-diagram": dataFlowDiagramRaw,
};
