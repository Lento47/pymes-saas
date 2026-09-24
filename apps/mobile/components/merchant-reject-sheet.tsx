import type { MessageKey } from "@pymeshub/i18n";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { useT } from "@/lib/i18n";
import { space } from "@/theme";

import { Button } from "./button";
import { Card } from "./card";
import { Field } from "./field";
import { ListRow } from "./list-row";
import { Sheet } from "./sheet";
import { Text } from "./text";

const QUICK_REASONS: MessageKey[] = [
	"biz.board.reject.outOfStock",
	"biz.board.reject.tooBusy",
	"biz.board.reject.closing",
];

/** The reason sent to a customer when a merchant rejects a pending order. */
export function MerchantRejectSheet({
	open,
	busy,
	onClose,
	onReason,
}: {
	open: boolean;
	busy: boolean;
	onClose: () => void;
	onReason: (reason: string) => void;
}) {
	const { t } = useT();
	const [otherOpen, setOtherOpen] = useState(false);
	const [text, setText] = useState("");

	const close = () => {
		setOtherOpen(false);
		setText("");
		onClose();
	};
	const submit = (reason: string) => {
		if (busy || reason.trim().length === 0) return;
		setOtherOpen(false);
		setText("");
		onReason(reason.trim());
	};

	return (
		<Sheet
			open={open}
			onClose={close}
			title={t("biz.board.reject.reason")}
			closeLabel={t("action.close")}
			avoidKeyboard
			footer={
				otherOpen ? (
					<Button
						label={t("biz.board.reject")}
						onPress={() => submit(text)}
						disabled={text.trim().length === 0 || busy}
						loading={busy}
					/>
				) : undefined
			}
		>
			<Card>
				{QUICK_REASONS.map((key) => (
					<ListRow
						key={key}
						title={t(key)}
						onPress={() => {
							if (!busy) submit(t(key));
						}}
					/>
				))}
				{otherOpen ? (
					<View style={styles.other}>
						<Field
							label={t("biz.board.reject.other")}
							value={text}
							onChangeText={setText}
							maxLength={300}
							multiline
							editable={!busy}
						/>
					</View>
				) : (
					<ListRow
						title={t("biz.board.reject.other")}
						divider={false}
						chevron
						onPress={() => {
							if (!busy) setOtherOpen(true);
						}}
					/>
				)}
			</Card>
			<Text variant="caption" tone="muted" style={styles.help}>
				{t("biz.board.reject.help")}
			</Text>
		</Sheet>
	);
}

const styles = StyleSheet.create({
	other: { paddingHorizontal: space.md, paddingVertical: space.sm },
	help: { marginTop: space.md, paddingHorizontal: space.lg },
});
