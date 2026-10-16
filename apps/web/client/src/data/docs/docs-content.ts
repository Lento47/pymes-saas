import backupAndRecoveryPolicyRaw from "./security/backup-and-recovery-policy.md?raw";

import customerComplaintsProcessRaw from "./operations/customer-complaints-process.md?raw";
import releaseCommunicationPolicyRaw from "./operations/release-communication-policy.md?raw";
import slaRaw from "./operations/sla.md?raw";
import supportPolicyRaw from "./operations/support-policy.md?raw";

import windowsInstallerLicenseRequirementsRaw from "./product-compliance/windows-installer-license-requirements.md?raw";

import legalEntityPlanCrRaw from "./business/legal-entity-plan-cr.md?raw";
import trademarkDomainReviewRaw from "./business/trademark-domain-review.md?raw";

import pymeshubOverviewRaw from "./product/pymeshub-overview.md?raw";
import gettingStartedRaw from "./product/getting-started.md?raw";
import orderingAndTrackingRaw from "./product/ordering-and-tracking.md?raw";
import sellingOnPymeshubRaw from "./product/selling-on-pymeshub.md?raw";
import deliveringOnPymeshubRaw from "./product/delivering-on-pymeshub.md?raw";
import howDiscoveryAndRankingWorkRaw from "./product/how-discovery-and-ranking-work.md?raw";
import dataAndPrivacyRaw from "./product/data-and-privacy.md?raw";
import supportedAndUnsupportedRaw from "./product/supported-and-unsupported.md?raw";
import openSourceCreditsRaw from "./product/open-source-credits.md?raw";
import softwarePolicyRaw from "./product/software-policy.md?raw";
import changelogRaw from "./product/changelog.md?raw";
import securityAdvisoriesRaw from "./product/security-advisories.md?raw";
import plansAndBillingRaw from "./product/plans-and-billing.md?raw";
import faqRaw from "./product/faq.md?raw";

/**
 * The doc-center pages that live in this folder. Legal documents are **not** listed
 * here: they are published by the Legal Center (`data/legal/legal-content.ts`) and the
 * document page reads that map as well, so one copy of each legal text serves both
 * surfaces.
 */
export const DOCS_CONTENT: Record<string, string> = {
  // Public — product
  "product-overview": pymeshubOverviewRaw,
  "getting-started": gettingStartedRaw,
  "ordering-and-tracking": orderingAndTrackingRaw,
  "selling-on-pymeshub": sellingOnPymeshubRaw,
  "delivering-on-pymeshub": deliveringOnPymeshubRaw,
  "how-discovery-and-ranking-work": howDiscoveryAndRankingWorkRaw,
  "data-and-privacy": dataAndPrivacyRaw,
  "supported-and-unsupported": supportedAndUnsupportedRaw,
  "open-source-credits": openSourceCreditsRaw,
  "software-policy": softwarePolicyRaw,
  changelog: changelogRaw,
  "security-advisories": securityAdvisoriesRaw,
  "plans-and-billing": plansAndBillingRaw,
  faq: faqRaw,

  // Public — operations
  "support-policy": supportPolicyRaw,
  sla: slaRaw,

  // Internal — operations
  "customer-complaints-process": customerComplaintsProcessRaw,
  "release-communication-policy": releaseCommunicationPolicyRaw,

  // Internal — security
  "backup-and-recovery-policy": backupAndRecoveryPolicyRaw,

  // Internal — product-compliance
  "windows-installer-license-requirements": windowsInstallerLicenseRequirementsRaw,

  // Internal — business
  "legal-entity-plan-cr": legalEntityPlanCrRaw,
  "trademark-domain-review": trademarkDomainReviewRaw,
};
