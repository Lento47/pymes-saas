import { router } from "expo-router";
import type { ReactNode } from "react";

import { useSession } from "@/lib/auth/session";
import { useT } from "@/lib/i18n";

import { EmptyState } from "./empty-state";
import { Spinner } from "./spinner";

/**
 * The gate a screen behind sign-in sits in.
 *
 * Three states and each one is honest about itself. `loading` is a spinner rather than a
 * skeleton because the shape of the answer is not a layout this component owns — the caller
 * knows what it is about to draw and this component does not — and because the question
 * being asked ("is there a session at all?") is answered by the OS keychain and possibly a
 * network round trip rather than by a row of data. The signed-out state is an `EmptyState`
 * with the sentence that explains what signing in gets you, not a bare "Inicia sesión": a
 * gate that says only what it wants is a wall.
 *
 * A screen that needs a skeleton of its own should not use this for it: gate the screen and
 * let the screen render its own waiting shape inside the gate, where the layout is known.
 *
 * ## The waiting state has an exit
 *
 * `unanswered` is the read having spent every attempt without learning anything, and it is
 * rendered as a retry rather than as more waiting — see `lib/auth/session` for why it is not
 * a fourth status. A spinner with no end is the one shape here that is not honest: it says
 * "this is still happening" about something that has already stopped happening. What it must
 * not say is "inicia sesión", because that is a claim about identity that nothing answered.
 * So the sentence is the blameless one `state.error` carries, and the button is `refresh` —
 * the same read, asked again by the person who is still waiting for it.
 */
export function SignedIn({ children }: { children: ReactNode }) {
	const { status, unanswered, refresh } = useSession();
	const { t } = useT();

	if (status === "loading") {
		if (unanswered)
			return (
				<EmptyState
					icon="alert-circle-outline"
					title={t("state.error.title")}
					body={t("state.error.body")}
					actionLabel={t("action.retry")}
					onAction={() => void refresh()}
				/>
			);
		return <Spinner label={t("state.loading")} />;
	}

	if (status !== "signed-in") {
		return (
			<EmptyState
				icon="person-outline"
				title={t("auth.signIn.title")}
				body={t("auth.signIn.subtitle")}
				actionLabel={t("action.signIn")}
				onAction={() => router.push("/sign-in")}
			/>
		);
	}

	return children;
}
