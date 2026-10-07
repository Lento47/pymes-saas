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
 * 3. Points the `debug` build type at that release config **when the keystore is present**, so a
 *    local `expo run:android` and an EAS build are the same signed application.
 *
 * **(3) exists because of `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.** Android identifies an app by
 * package *and* signing certificate, so installing over a different certificate is refused
 * outright — it is not an update, it is a different app that happens to share a name. `expo
 * run:android` produces a debug-signed `app.pymeshub.lat`, while the `apk` and `production` EAS
 * profiles produce one signed with the upload keystore; whichever is installed second is
 * rejected. The usual remedy is `applicationIdSuffix '.debug'`, and that remedy is unavailable
 * here: `android/app/build.gradle` applies `com.google.gms.google-services` to every variant, and
 * that plugin **fails the build** when a variant's package name matches no client in the JSON —
 * so a debug variant would first have to be registered as a second Android app in Firebase.
 * Signing both variants with one key costs that second app nothing and makes the two
 * interchangeable.
 *
 * **Unset is a debug build that still works and a release build that fails to sign.** That
 * direction is deliberate and unchanged by (3): `storeFile null` fails `bundleRelease` with
 * Gradle's own "keystore not found" rather than quietly shipping an app signed with the debug
 * key, and `assembleDebug` — what everybody runs on a machine that has no keystore — falls back
 * to the template's debug config rather than failing. Failing debug too is how a contributor
 * without the keystore ends up unable to build the app at all.
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

		// Idempotent per step, not once for the whole transform: prebuild runs repeatedly over
		// a project that already carries an earlier version of this output, and a single
		// early return keyed on the release config would skip a step added by a later version
		// of the plugin — the case where the keystore block is present and the debug build type
		// is not yet retargeted, which is exactly the state this repo is in today.
		//
		// So each step guards itself, and each read is taken from `mod.modResults.contents`
		// rather than from a `contents` captured before the first write.
		if (!mod.modResults.contents.includes("signingConfigs.release")) {
			// 1. The signing config, as a second (merged) container block, placed where the
			//    module's android configuration has its sections: before `buildTypes {`.
			if (!mod.modResults.contents.includes("\n    buildTypes {")) {
				throw new Error(
					"with-android-release-signing: no `buildTypes {` in app/build.gradle — the template moved",
				);
			}
			mod.modResults.contents = mod.modResults.contents.replace(
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
				!mod.modResults.contents.includes(
					"signingConfig signingConfigs.release",
				)
			) {
				throw new Error(
					"with-android-release-signing: could not retarget the release build type — the template moved",
				);
			}
		}

		// 3. And so does the debug build type, but only where the keystore is actually there.
		//
		//    The condition is `PYMESHUB_UPLOAD_STORE_FILE`, the same variable the release config
		//    reads, and it is written as a **Gradle expression** rather than decided here in the
		//    plugin on purpose: the plugin runs on the machine that runs `expo prebuild`, and
		//    that machine is not always the machine that runs Gradle. Deferring to Gradle means
		//    the one generated file is correct in both places — with a keystore in the
		//    environment it signs debug with it, without one it does not. Deciding in the
		//    plugin bakes one machine's environment into a file that `prebuild --clean`
		//    regenerates somewhere else and gets wrong there.
		//
		//    Both arms name a config rather than one arm being `null`, and those are not the
		//    same thing: `null` means "inherit", which lands on `signingConfigs.debug` only by
		//    accident of ordering. Naming it keeps a keystore-less machine on the template's own
		//    debug config, which is what worked there before.
		//
		//    `storeFile` rather than the other three names is the test, because it is the one
		//    that decides whether Gradle can sign at all: a `storePassword` set with no keystore
		//    beside it still fails, and a keystore path set is the only state in which signing
		//    succeeds. A ternary, not an `if`, because `signingConfig` takes a `SigningConfig`
		//    and a bare name would be a property lookup against the android extension.
		const DEBUG_SIGNING_LINE =
			'            signingConfig System.getenv("PYMESHUB_UPLOAD_STORE_FILE") ? signingConfigs.release : signingConfigs.debug';

		if (mod.modResults.contents.includes(DEBUG_SIGNING_LINE)) return mod;

		mod.modResults.contents = mod.modResults.contents.replace(
			"        debug {\n            signingConfig signingConfigs.debug\n        }",
			`        debug {\n${DEBUG_SIGNING_LINE}\n        }`,
		);

		if (!mod.modResults.contents.includes(DEBUG_SIGNING_LINE)) {
			throw new Error(
				"with-android-release-signing: could not retarget the debug build type — the template moved",
			);
		}

		return mod;
	});

module.exports = withAndroidReleaseSigning;
