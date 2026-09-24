const { withAppBuildGradle } = require("@expo/config-plugins");

/**
 * Release signing for the Android build, written at prebuild.
 *
 * `apps/mobile/android` is prebuild output and `.gitignore` ignores it, so a signing config
 * typed into `android/app/build.gradle` is one that vanishes on the next `expo prebuild
 * --clean` — the same rule `app.config.ts` states for a MapLibre version or a Podfile line,
 * and for the same reason: the plugin is what writes them. This is that plugin.
 *
 * The template signs `release` with `signingConfigs.debug` and says so in its own comment
 * ("Caution! In production, you need to generate your own keystore file"), which is the one
 * thing standing between this project and a build it can actually ship. So the plugin does
 * two things and nothing else:
 *
 * 1. Adds a `release` signing config that reads the keystore from the **environment**, never
 *    from a value written here. A password baked into a generated Gradle file is a password
 *    sitting in a file on disk that nobody reads again — and `android/` is exactly the kind
 *    of directory that gets zipped into a support thread. The four names are documented in
 *    `.env.example` and declared in `turbo.json`'s `globalPassThroughEnv`, because a name
 *    Turborepo cannot see is a name the task never receives (`docs/environment.md`).
 * 2. Points the `release` build type at that config instead of at the debug one.
 *
 * **Unset is a debug build that still works and a release build that fails to sign.** That
 * direction is deliberate: `storeFile null` fails `bundleRelease` with Gradle's own "keystore
 * not found" rather than quietly shipping an app signed with the debug key, while
 * `assembleDebug` — what everybody runs all day — is untouched. The alternative, falling back
 * to the debug key, is how a store build ends up installable only over a debug one.
 *
 * A second `signingConfigs { … }` block is how the entry is added, and Gradle merges it into
 * the first: the block is a `NamedDomainObjectContainer` configure closure, so running it
 * twice adds and edits entries rather than replacing the container. That keeps this transform
 * two small substitutions on a template we do not own, instead of a rewrite of a file that is
 * regenerated under us.
 */

const SIGNING_BLOCK = `    signingConfigs {
        release {
            storeFile System.getenv("PYMESHUB_UPLOAD_STORE_FILE") ? file(System.getenv("PYMESHUB_UPLOAD_STORE_FILE")) : null
            storePassword System.getenv("PYMESHUB_UPLOAD_STORE_PASSWORD")
            keyAlias System.getenv("PYMESHUB_UPLOAD_KEY_ALIAS")
            keyPassword System.getenv("PYMESHUB_UPLOAD_KEY_PASSWORD")
        }
    }
`;

const withAndroidReleaseSigning = (config) =>
	withAppBuildGradle(config, (mod) => {
		if (mod.modResults.language !== "groovy") {
			throw new Error(
				"with-android-release-signing: expected a Groovy app/build.gradle",
			);
		}

		const contents = mod.modResults.contents;

		// Idempotent: prebuild can run over a project that already carries the block.
		if (contents.includes("signingConfigs.release")) return mod;

		// 1. The signing config, as a second (merged) container block, placed where the
		//    module's android configuration has its sections: before `buildTypes {`.
		if (!contents.includes("\n    buildTypes {")) {
			throw new Error(
				"with-android-release-signing: no `buildTypes {` in app/build.gradle — the template moved",
			);
		}
		mod.modResults.contents = contents.replace(
			"\n    buildTypes {",
			`\n${SIGNING_BLOCK}    buildTypes {`,
		);

		// 2. The release build type signs with it. The template's own comment sits between
		//    the block's brace and the line, so it is matched along with the line — that is
		//    what keeps this off the debug build type's identical `signingConfig` line.
		mod.modResults.contents = mod.modResults.contents.replace(
			"            signingConfig signingConfigs.debug\n            def enableShrinkResources",
			"            signingConfig signingConfigs.release\n            def enableShrinkResources",
		);

		if (
			!mod.modResults.contents.includes("signingConfig signingConfigs.release")
		) {
			throw new Error(
				"with-android-release-signing: could not retarget the release build type — the template moved",
			);
		}

		return mod;
	});

module.exports = withAndroidReleaseSigning;
