import { StyleSheet, View } from "react-native";

import { Card } from "@/components/card";
import { Image } from "@/components/image";
import { Text } from "@/components/text";
import { useT } from "@/lib/i18n";
import { space, useTheme } from "@/theme";

/**
 * One courier as a business sees them in the delivery pool.
 *
 * ## Why this is shared, and why it is not the whole `courierDirectoryEntry`
 *
 * The entry shape carries `isMember` and `isInvited`, and both are **relationship facts
 * relative to one business** — "is this courier already on *my* roster", "have I already
 * invited them". Neither has a meaning without a business on the other side, so neither can
 * live in a component a courier renders about *themselves*: the honest value would be
 * `false`, and a card that asserts a courier is not a member of a shop that was never asked
 * is a card lying in the only direction that happens to look flattering.
 *
 * So the card takes the **identity** half — avatar, name, service area, bio, availability,
 * and the verified mark — and leaves the relationship half to the call site as an `action`
 * node. `app/(business)/team.tsx` passes its invite button; the courier's own profile passes
 * nothing. One rendering of "a courier, as a shop sees them", from one place.
 *
 * ## Why the avatar is here when the pool does not draw it yet
 *
 * `courierDirectoryEntry.image` is `user.image` — the same avatar `users.me` returns, and
 * the pool listing simply does not draw it today. Including it here means the two surfaces
 * agree the moment the pool starts showing faces, and a courier preview that has a photo
 * above the fold is the part that reads as finished.
 *
 * The row falls back to a `FieldGlyph`-style initial when there is no picture, because an
 * empty circle is a hole where a face should be and a courier with no avatar is the common
 * case, not the edge one.
 */
export interface CourierDirectoryIdentity {
	/** `courierProfile.id`. Named for the shape it comes from, not for its role here. */
	profileId: string;
	displayName: string;
	/** `user.image` — the avatar, not the vehicle photo. */
	image: string | null;
	serviceArea: string;
	bio: string | null;
	isAvailable: boolean;
}

export function CourierDirectoryCard({
	courier,
	action,
}: {
	courier: CourierDirectoryIdentity;
	/** The business's own row action. Absent when nobody is being invited. */
	action?: React.ReactNode;
}) {
	const { t } = useT();
	const { colors } = useTheme();
	const muted = colors.muted;
	const initial = courier.displayName.trim().charAt(0).toUpperCase();

	return (
		<Card style={styles.card}>
			<View style={styles.identity}>
				{courier.image ? (
					<Image
						uri={courier.image}
						style={styles.avatar}
						radiusToken="full"
						accessibilityLabel={courier.displayName}
					/>
				) : (
					<View
						style={[styles.fallback, { backgroundColor: muted }]}
						accessibilityElementsHidden
					>
						<Text variant="label" bold style={styles.initial}>
							{initial}
						</Text>
					</View>
				)}
				{/*
				 * The name on its own line, the area under it, and the verified mark last.
				 *
				 * This was a `ListRow` with the mark in its `state` slot, which put
				 * "Verificado por PymesHub" on the same line as the name and pushed the
				 * service area onto a third — so the mark read as a peer of the name and the
				 * area read as a subtitle of it. A shop scanning a pool of twelve needs the
				 * name first, the area second, and the badge last, and the badge is worth the
				 * least space of the three.
				 */}
				<View style={styles.text}>
					<Text variant="body" bold numberOfLines={1}>
						{courier.displayName}
					</Text>
					<Text variant="caption" tone="muted" numberOfLines={1}>
						{courier.serviceArea}
					</Text>
					<Text variant="caption" tone="action" numberOfLines={1}>
						{t("biz.courier.directoryVerified")}
					</Text>
				</View>
			</View>

			{courier.bio ? (
				<Text variant="caption" tone="muted">
					{courier.bio}
				</Text>
			) : null}

			{action ? <View style={styles.action}>{action}</View> : null}
		</Card>
	);
}

const styles = StyleSheet.create({
	card: { gap: space.sm },
	identity: { flexDirection: "row", alignItems: "center", gap: space.sm },
	text: { flex: 1 },
	// 44 is `MIN_TOUCH_TARGET` and is also simply the smallest circle that can hold a
	// capital at `label` without the letter touching the edge.
	avatar: { width: 44, height: 44 },
	fallback: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
	},
	initial: { textAlign: "center" },
	action: { marginTop: space.xs },
});
