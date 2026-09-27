/**
 * Metro's asset modules, typed the way the bundler hands them over.
 *
 * `import chime from "../assets/sounds/new-order.wav"` resolves to a **number** — the id
 * Metro registers the asset under — and not to a URI string. `expo-audio`'s `createAudioPlayer`
 * accepts that number and walks it through `expo-asset`'s `Asset.fromModule`, which is the
 * whole reason `expo-asset` is a dependency of this app rather than a transitive detail.
 *
 * Nothing in the tree declared `*.wav` before this file: `expo/types/global.d.ts` covers CSS
 * modules only, and the one asset declaration in the workspace (`maplibre`'s `*.png`) is
 * private to that package. The shape is that one's, because it is the same answer — a
 * registered asset is an id, and a URL would be a different thing.
 */
declare module "*.wav" {
	const content: number;
	export default content;
}
