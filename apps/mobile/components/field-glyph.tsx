import Ionicons from "@expo/vector-icons/Ionicons";

import { Text } from "@/components/text";
import { icon, useTheme } from "@/theme";

/**
 * What a `Field`'s leading chip holds: a mark, or a unit.
 *
 * `./field` draws the chip — its size, its inset, its centring, and its removal from the
 * accessibility tree — and this only decides what goes *inside* it. Two shapes, because
 * the two things a chip can carry are not the same kind of thing.
 *
 * A glyph is decoration. It is drawn at `icon.action` in `mutedForeground` and it names
 * the field for someone who recognises pictograms, which is most people and not all.
 *
 * A unit — the shop's currency mark, a percent sign — is a *word* in the only writing
 * most shops use, and it is set at `type.label` bold rather than as a grey pictogram. The
 * difference is not decoration: a price box whose chip says "₡" in the same grey as an
 * icon has told the owner nothing about which field they are in, and a discount box whose
 * chip is an icon has told them nothing about the unit they are about to type into.
 */
export function FieldGlyph({
	name,
	label: text,
}: {
	name?: React.ComponentProps<typeof Ionicons>["name"];
	label?: string;
}) {
	const { colors } = useTheme();
	if (text !== undefined) {
		return (
			<Text variant="label" bold>
				{text}
			</Text>
		);
	}
	return (
		<Ionicons
			name={name ?? "image-outline"}
			size={icon.action}
			color={colors.mutedForeground}
			accessibilityElementsHidden
			importantForAccessibility="no"
		/>
	);
}
