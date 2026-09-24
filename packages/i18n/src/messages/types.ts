import type { es } from "./es/index";

/**
 * Every key the app can ask for, derived from the **Spanish** dictionary.
 *
 * Spanish is the source of truth because it is the language the product is written
 * in: the Spanish file is where a new string is added, and the build then refuses to
 * compile until English has it too. The reverse — English as the reference — would
 * make the reference locale the one nobody on the team reads fluently, and a typo in
 * a key would be caught by a translator rather than by us.
 */
export type MessageKey = keyof typeof es;

/**
 * What every locale must provide: all of the keys, and no others.
 *
 * The `no others` half matters. A key present in English and absent from Spanish is a
 * string that exists only for readers of one language, which is how a feature ships
 * translated in one direction — usually a leftover from a rename, where the old key
 * was kept "just in case" and the new one added beside it.
 */
export type Messages = Record<MessageKey, string>;
