import type { MessageKey } from "@pymeshub/i18n";
import { StyleSheet, View } from "react-native";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Screen, ScreenSection } from "@/components/screen";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { leaveScreen } from "@/lib/leave";
import { space, TEXT_STACK_GAP } from "@/theme";

/**
 * What to be careful about when a stranger brings you food.
 *
 * ## The one loud thing, and it is the emergency number
 *
 * `docs/design-mobile.md`'s Rule 1 gives a screen one loud element, and on this screen it is
 * deliberately the first block: the number, at `display`, in a `Card` at the top. That is the
 * inverse of the rule's usual reading — "money is never the loudest thing on a browse screen"
 * — and it is the same rule applied to a different screen. A safety screen's whole job is the
 * one thing a reader needs when they are frightened, and burying it under three paragraphs of
 * advice would be arranging the page by how comfortable it is to write rather than by what it
 * is for.
 *
 * The number is drawn as text and **is not a dial button**, which is a decision rather than an
 * omission. `Linking.openURL("tel:…")` needs `android.intent.action.DIAL` declared in the
 * manifest's `<queries>` on Android 11+ for `canOpenURL` to answer truthfully, and this app's
 * prebuilt manifest does not declare it — so a "Call" control here would be a button that
 * works on iOS and silently does nothing on Android, on the screen where doing nothing is
 * least acceptable. 911 is dialable from any phone without an app's help, and the sentence
 * under the number is the instruction. When the manifest query is added, the control can be
 * too; until then this is a fact rather than a broken promise.
 *
 * The number itself is `safe.emergency.number` in the dictionary rather than a literal at this
 * call site, and that is not because it would ever be translated — a translated "911" is a
 * number that does not answer. It is there because the string is *data*: it is a fact about a
 * country, it belongs with the copy that talks about it, and a literal in this file is a value
 * a reader of the dictionary cannot find.
 *
 * ## The three tips name controls that exist
 *
 * Each one points at something in this app — the business's page with its fee and its minimum,
 * the order screen with its number and its status, the record an in-app order leaves — rather
 * than offering generic advice about strangers. A tip that says "be careful" is a tip the
 * reader already knew; a tip that says which screen settles the question is help. That is the
 * same line `app/help.tsx` draws for its own four answers.
 *
 * ## Reporting is a door, not a form
 *
 * There is no report button and no support inbox — see `app/help.tsx`, which says in the same
 * words why no `mailto:` was invented. What exists is the order, and the order carries both the
 * shop's contact and the record of what happened, so `safe.report.body` says to open it. The
 * screen sends the reader to the orders tab to do that, which is the only action on it.
 */
export default function Safety() {
	const { t } = useT();

	return (
		// The six pushed screens that hide the stack header draw their own back control
		// (`lib/leave` lists them and owns the fallback); this is the seventh. It goes through
		// `Screen`'s `leading` slot rather than the body, because this screen hands its title to
		// the frame — a body child would render under the heading. See that prop.
		<Screen
			title={t("safe.title")}
			leading={<BackButton to="/account" />}
			scroll
			contentStyle={styles.gap}
		>
			<Text variant="body" tone="muted">
				{t("safe.intro")}
			</Text>

			{/* Rule 1's one loud thing, and the only block on this screen that is not advice. */}
			<Card style={styles.emergency}>
				<Text variant="caption" tone="muted" bold>
					{t("safe.emergency")}
				</Text>
				<Text variant="display" bold tabular>
					{t("safe.emergency.number")}
				</Text>
				<Text variant="body" tone="muted">
					{t("safe.emergency.body")}
				</Text>
			</Card>

			<ScreenSection title={t("safe.tips.title")}>
				<View style={styles.tips}>
					{TIPS.map((tip) => (
						<Card key={tip.title} style={styles.tip}>
							<Text variant="label" bold>
								{t(tip.title)}
							</Text>
							<Text variant="body" tone="muted">
								{t(tip.body)}
							</Text>
						</Card>
					))}
				</View>
			</ScreenSection>

			<ScreenSection title={t("safe.report.title")}>
				<Text variant="body" tone="muted">
					{t("safe.report.body")}
				</Text>
				<Button
					label={t("help.orders")}
					variant="secondary"
					onPress={() => leaveScreen("/orders")}
				/>
			</ScreenSection>
		</Screen>
	);
}

/**
 * The three, as keys.
 *
 * Typed as `MessageKey` so a renamed key is a compile error here rather than a card printing
 * `safe.tip.meet.body` to somebody — the arrangement `app/help.tsx` uses for its FAQ and
 * `MOVE_LABELS` uses in `@pymeshub/i18n` (`packages/i18n/src/index.ts:435`).
 *
 * Three separate `Card`s, where the FAQ on `app/help.tsx` is four rows on one — and the two
 * are not inconsistent. A FAQ's rows are questions about one thing, so one surface groups them;
 * these are three unrelated precautions, and a reader who has taken in the first should be able
 * to stop reading without the second appearing to be part of it.
 */
const TIPS: { title: MessageKey; body: MessageKey }[] = [
	{ title: "safe.tip.meet.title", body: "safe.tip.meet.body" },
	{ title: "safe.tip.share.title", body: "safe.tip.share.body" },
	{ title: "safe.tip.cash.title", body: "safe.tip.cash.body" },
];

const styles = StyleSheet.create({
	// The intro, the emergency block and the two sections are one column. The
	// sections pay their own `space.xxl` above them; the rest is this gap.
	gap: { gap: space.lg },
	// The emergency block's three lines read as one statement, so they sit at the tighter
	// `space.sm` rather than the loose gap the rest of the column uses — and the number is the
	// line the two others belong to.
	emergency: { gap: space.sm },
	// A tip is a title and the line beneath it — one text stack, so it sits at the gap
	// `./list-row` and `./product-row` put between a body's lines, while the emergency block
	// above keeps the looser `space.sm` because its three lines are one statement.
	tip: { gap: TEXT_STACK_GAP },
	tips: { gap: space.md },
});
