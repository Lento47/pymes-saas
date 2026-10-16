/**
 * Published security advisories — the single source the advisories page renders.
 *
 * This list is the visible end of the coordinated-disclosure pipeline the reporting
 * policy describes (`/documentation/security-advisories`): a report arrives through
 * GitHub private vulnerability reporting or `security@pymeshub.lat` (`SECURITY.md`),
 * it is triaged and fixed inside the targets stated there, and only then does it earn
 * a row here. The list starts empty not because the page can't render a table but
 * because **an identifier must never exist before its advisory does** — seeding the
 * page with a placeholder `OTL-SA-2026-000` would be exactly the fake publication
 * the reporting policy refuses to make.
 *
 * The identifier scheme is `OTL-SA-YYYY-NNN` (the S.A. of Otnel), year of publication,
 * a per-year counter. Each entry is mirrored to GitHub Security Advisories; keep the
 * two in agreement with `documents` below.
 */
export type AdvisorySeverity = "critical" | "high" | "medium" | "low";

export interface SecurityAdvisory {
	/** The `OTL-SA-YYYY-NNN` identifier. Assigned only when this advisory is published. */
	identifier: string;
	/** Short sentence a shop owner understands without the technical background. */
	title: string;
	/** ISO date (`YYYY-MM-DD`) — the day the fix reached production. */
	publishedAt: string;
	severity: AdvisorySeverity;
	/** Versions or components affected, in reporter's terms, not internal codenames. */
	affectedVersions: string;
	/** The version, commit or deploy date that carries the fix. */
	fixedVersion: string;
	/** Two to four sentences: what was wrong, what it could have done, what the fix was. */
	summary: string;
	/** The reporter, in whatever form they approved — omit when they chose anonymity. */
	credit?: string;
}

export const securityAdvisories: SecurityAdvisory[] = [];
