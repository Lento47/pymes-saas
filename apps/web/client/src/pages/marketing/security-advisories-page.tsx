import { ArrowLeft, Mail, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import { Footer } from "@/components/marketing/footer";
import { MarketingShell, ProductPageHero } from "@/components/marketing/marketing-site";
import { useI18n } from "@/components/providers/i18n-provider";
import { securityAdvisories, type AdvisorySeverity, type SecurityAdvisory } from "@/data/security-advisories";
import { applySeoMetadata } from "@/lib/seo";
import { Link } from "wouter";

/**
 * The advisories page — `/security/advisories`.
 *
 * The reporting policy (`/documentation/security-advisories`) promised this page long
 * before it existed, and kept repeating "is not live yet" while it wasn't. This is the
 * promise's end. It renders `data/security-advisories.ts` — the list starts empty,
 * because an identifier is assigned only to an advisory that is actually published —
 * so the empty state is load-bearing: it must read as policy working as intended.
 * The card design follows the trust-section tiles on `/security` rather than a
 * markdown render, because an advisory is structured data (identifier, severity,
 * affected, fix, credit), not prose.
 */

/** The per-severity chip tone, kinned to the trust tiles: amber family at rest. */
const severityTone: Record<AdvisorySeverity, string> = {
	critical: "border-red-500/25 bg-red-500/10 text-red-400",
	high: "border-orange-500/25 bg-orange-500/10 text-orange-400",
	medium: "border-amber-500/25 bg-amber-500/10 text-amber-400",
	low: "border-sky-500/25 bg-sky-500/10 text-sky-400",
};

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex gap-2 text-sm">
			<dt className="shrink-0 text-slate-500">{label}</dt>
			<dd className="text-slate-300">{value}</dd>
		</div>
	);
}

function AdvisoryCard({ advisory }: { advisory: SecurityAdvisory }) {
	const t = useI18n().messages.site.security.advisories;
	return (
		<article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-mono text-base tracking-[-0.02em] text-amber-400">{advisory.identifier}</h2>
				<span
					className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${severityTone[advisory.severity]}`}
				>
					{t.severityLabel}: {t.severity[advisory.severity]}
				</span>
			</header>
			<h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-white">{advisory.title}</h3>
			<p className="mt-3 text-sm leading-6 text-slate-400">{advisory.summary}</p>
			<dl className="mt-5 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
				<DetailRow label={t.publishedLabel} value={advisory.publishedAt} />
				<DetailRow label={t.affectedLabel} value={advisory.affectedVersions} />
				<DetailRow label={t.fixedLabel} value={advisory.fixedVersion} />
				{advisory.credit ? <DetailRow label={t.creditLabel} value={advisory.credit} /> : null}
			</dl>
		</article>
	);
}

export default function SecurityAdvisoriesPage() {
	const { messages, locale } = useI18n();
	const t = messages.site.security.advisories;

	useEffect(() => {
		applySeoMetadata({
			canonicalPath: "/security/advisories",
			title: "PymesHub | " + t.page.title,
			description: t.page.subtitle,
		});
	}, [locale, t]);

	return (
		<MarketingShell>
			<ProductPageHero badge={t.page.badge} title={t.page.title} subtitle={t.page.subtitle} hideCtas />
			<section className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
				<div className="mx-auto max-w-3xl space-y-6">
					{securityAdvisories.length === 0 ? (
						<div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-8 text-center sm:p-10">
							<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-slate-300">
								<ShieldAlert className="h-5 w-5" />
							</div>
							<p className="mt-5 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
								{t.emptyBadge}
							</p>
							<h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-white">{t.emptyTitle}</h2>
							<p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">{t.emptyBody}</p>
						</div>
					) : (
						securityAdvisories.map((advisory) => (
							<AdvisoryCard key={advisory.identifier} advisory={advisory} />
						))
					)}

					<div className="rounded-[24px] border border-amber-500/20 bg-amber-500/[0.06] p-8">
						<div className="flex items-start gap-4">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
								<Mail className="h-5 w-5" />
							</div>
							<div>
								<h2 className="text-lg font-semibold tracking-[-0.03em] text-white">{t.reportingTitle}</h2>
								<p className="mt-2 text-sm leading-6 text-slate-400">{t.reportingBody}</p>
								<Link
									href="/documentation/security-advisories"
									className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:border-amber-500/40 hover:text-amber-400"
								>
									{t.reportingCta}
								</Link>
							</div>
						</div>
					</div>

					<div className="flex justify-center">
						<Link
							href="/security"
							className="inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-300"
						>
							<ArrowLeft className="h-4 w-4" />
							{t.backCta}
						</Link>
					</div>
				</div>
			</section>
			<Footer />
		</MarketingShell>
	);
}
