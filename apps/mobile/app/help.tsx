import type { MessageKey } from "@pymeshub/i18n";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

import { BackButton } from "@/components/back-button";
import { Card } from "@/components/card";
import { ListRow } from "@/components/list-row";
import { Screen, ScreenSection } from "@/components/screen";
import { useT } from "@/lib/i18n";
import { space } from "@/theme";

/**
 * The questions a customer actually asks, answered with what this app does.
 *
 * ## Why this screen exists at all, and what it is not
 *
 * It is not a policy document and it is not a support form. There is no support address to
 * write to — `grep -ri "mailto\|soporte@\|support@" .` returns nothing outside `node_modules`,
 * and no `mailto:` was invented here to fill the space — so a "contact us" button would be a
 * button that opens a composer addressed to nobody. The screen is therefore what it can honestly
 * be: four answers, each naming the screen and the button that resolves the question, and two
 * doors to the places those answers point at.
 *
 * The four are the four a marketplace is actually asked. Each answer is written as an
 * instruction about *this* app — "In Orders, open the order and you will see which step it is
 * on" — rather than as a restatement of terms, because an FAQ that says what a policy says is a
 * document, and the reader who opens Help has a problem, not a question about wording.
 *
 * ## The answers are rows, not cards
 *
 * One question and its answer is exactly `./list-row`'s shape: a title, a subtitle under it,
 * nothing to press. So the FAQ is one `Card` holding four of them, divided by the row's own
 * hairline — the last one undivided, because a line under the final row is a line under
 * nothing. Four separate `Card`s was the other candidate and it is wrong for a reason worth
 * stating: four surfaces stacked with a gap between them read as four unrelated things, and
 * these four are one list. Rule 4's "group, and make the groups navigable" is about the
 * grouping being visible, and a single surface is how it is visible.
 *
 * The rows carry no `onPress`, so `ListRow` draws them as plain text with
 * `accessibilityRole="text"` (`list-row.tsx:163`) rather than as a button that does nothing —
 * the same distinction `app/inbox.tsx` draws between a notice that opens an order and one that
 * does not. A screen reader hears the question, then the answer, in that order, which is the
 * order they are read in.
 *
 * ## The two doors
 *
 * `help.orders` goes to the orders tab and `help.safety` to `app/safety`, and each carries its
 * own hint, because a chevron is decoration a screen reader never hears. Both are `ListRow`s on
 * a second `Card`, which is the same grouped shape as the FAQ above and the reason they are not
 * two loose rows: rows in this app sit on a surface, and two of them with a hairline between are
 * a group of two.
 */
export default function Help() {
	const { t } = useT();

	return (
		// The six pushed screens that hide the stack header draw their own back control
		// (`lib/leave` lists them and owns the fallback); this is the seventh. It goes through
		// `Screen`'s `leading` slot rather than the body, because this screen hands its title to
		// the frame — a body child would render under the heading. See that prop.
		<Screen
			title={t("help.title")}
			leading={<BackButton to="/account" />}
			scroll
			contentStyle={styles.gap}
		>
			<ScreenSection title={t("help.faq.title")}>
				<Card>
					{FAQ.map((item, index) => (
						<ListRow
							key={item.question}
							title={t(item.question)}
							subtitle={t(item.answer)}
							// A hairline under every row but the last: the line under the final row
							// would be a divider delimiting nothing.
							divider={index < FAQ.length - 1}
						/>
					))}
				</Card>
			</ScreenSection>

			<Card>
				<ListRow
					title={t("help.orders")}
					chevron
					accessibilityHint={t("help.orders.help")}
					onPress={() => router.push("/orders")}
				/>
				<ListRow
					title={t("help.safety")}
					chevron
					divider={false}
					accessibilityHint={t("help.safety.help")}
					onPress={() => router.push("/safety")}
				/>
			</Card>
		</Screen>
	);
}

/**
 * The four questions, as keys.
 *
 * Typed as `MessageKey` rather than as strings so a renamed or deleted key is a compile error
 * here rather than a screen that prints `help.faq.track.title` to a customer — the same
 * arrangement `MOVE_LABELS` uses in `@pymeshub/i18n` (`packages/i18n/src/index.ts:435`) for the
 * order statuses.
 *
 * An array rather than four literals in the JSX, because the divider rule above needs the
 * index and the count, and because the four are a list: they are read in this order, and the
 * order lives in one place rather than in the order somebody happened to type the tags.
 */
const FAQ: { question: MessageKey; answer: MessageKey }[] = [
	{ question: "help.faq.track.title", answer: "help.faq.track.body" },
	{ question: "help.faq.cancel.title", answer: "help.faq.cancel.body" },
	{ question: "help.faq.problem.title", answer: "help.faq.problem.body" },
	{ question: "help.faq.delivery.title", answer: "help.faq.delivery.body" },
];

const styles = StyleSheet.create({
	// The FAQ section and the second card are one column. The section pays its
	// own `space.xxl` above it; the rest is this gap, which is the same `space.lg` the account
	// hub's blocks sit at.
	gap: { gap: space.lg },
});
