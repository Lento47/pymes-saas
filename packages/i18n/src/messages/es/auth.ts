/**
 * Spanish — signing in, and the account.
 *
 * The messages here are load-bearing in a way most copy is not. Sign-in is where a
 * customer decides whether the app is trustworthy, and the two failures that matter —
 * *wrong password* and *no account with that email* — are exactly the pair a login
 * form must **not** distinguish, because telling them apart is an account-existence
 * oracle. The shared wording below is a security decision, not laziness.
 */
export const auth = {
	"auth.signIn.title": "Entra a tu cuenta",
	"auth.signIn.subtitle":
		"Tus pedidos, tus direcciones y tus favoritos, en cualquier dispositivo.",
	"auth.signIn.submit": "Entrar",
	"auth.signIn.noAccount": "¿No tienes cuenta?",
	"auth.signIn.forgot": "Olvidé mi contraseña",

	"auth.signUp.title": "Crea tu cuenta",
	"auth.signUp.subtitle": "Toma menos de un minuto.",
	"auth.signUp.submit": "Crear cuenta",
	"auth.signUp.hasAccount": "¿Ya tienes cuenta?",

	"auth.signUp.business.title": "Registra tu negocio",
	"auth.signUp.business.subtitle": "Crea una cuenta para abrir tu tienda.",
	"auth.signUp.delivery.title": "Regístrate como repartidor",
	"auth.signUp.delivery.subtitle": "Crea una cuenta para aceptar entregas.",
	"auth.signUp.notCustomer": "¿No eres cliente?",
	"auth.signUp.businessOption": "Regístrate como negocio",
	"auth.signUp.courierOption": "Regístrate como repartidor",

	"auth.field.email": "Correo",
	"auth.field.email.placeholder": "tu@correo.com",
	"auth.field.password": "Contraseña",
	"auth.field.password.placeholder": "Al menos 12 caracteres",
	"auth.field.name": "Nombre",
	"auth.field.name.placeholder": "Cómo te llamamos",
	"auth.field.phone": "Teléfono",
	"auth.field.phone.placeholder": "8888 8888",
	"auth.field.phone.help":
		"El negocio te llama a este número si algo pasa con tu pedido.",
	"auth.field.confirmPassword": "Repite la contraseña",
	"auth.field.currentPassword": "Contraseña actual",

	"auth.or": "o",

	/**
	 * La identificación del repartidor, en la entrada y no después. El repartidor es un
	 * uso dedicado — esta cuenta existe para aceptar y entregar — y la pregunta se hace
	 * aquí, donde se crea la sesión, en vez de en un ajuste que descubrir después.
	 */
	"auth.role.label": "¿Para qué entras?",
	"auth.role.customer": "Cliente",
	"auth.role.delivery": "Repartidor",
	"auth.role.deliveryHelp": "Solo para aceptar y entregar pedidos.",

	/**
	 * One message for both failure modes, deliberately. See the note at the top of
	 * this file: `auth.error.invalidCredentials` covering "no such account" and "wrong
	 * password" is what stops the form from answering "does this person shop here".
	 */
	"auth.error.invalidCredentials": "Correo o contraseña incorrectos",
	"auth.error.emailInUse": "Ya existe una cuenta con este correo",
	// The number is Better Auth's `minPasswordLength` (`apps/api/src/auth.ts`), restated
	// rather than re-decided: copy that disagreed with the server would be the form lying
	// about the one requirement it actually enforces.
	"auth.error.weakPassword":
		"La contraseña es muy corta. Usa al menos 12 caracteres.",
	"auth.error.passwordsDiffer": "Las contraseñas no coinciden",
	"auth.error.emailNotConfirmed":
		"Confirma tu correo para continuar. Te enviamos un enlace.",
	"auth.error.rateLimited": "Demasiados intentos seguidos. Espera un minuto.",
	"auth.error.suspended":
		"Esta cuenta está suspendida. Escríbenos para revisarlo.",
	"auth.error.notConfigured":
		"Este sitio todavía no tiene el inicio de sesión configurado.",
	"auth.error.generic": "No pudimos completar el inicio de sesión",

	"auth.reset.title": "Recupera tu contraseña",
	"auth.reset.subtitle": "Te enviamos un enlace para crear una nueva.",
	"auth.reset.submit": "Enviar enlace",
	"auth.reset.sent":
		"Si existe una cuenta con ese correo, el enlace va en camino.",

	"auth.signOut.confirm": "¿Cerrar sesión?",
	"auth.signOut.body": "Tendrás que volver a entrar para ver tus pedidos.",

	"auth.session.expired": "Tu sesión venció. Entra de nuevo para continuar.",
	"auth.session.refreshing": "Renovando tu sesión…",

	"account.title": "Tu cuenta",
	"account.profile.title": "Perfil",
	"account.profile.name": "Nombre",
	"account.profile.email": "Correo",
	"account.profile.phone": "Teléfono",
	"account.profile.emailLocked": "Tu correo no se cambia desde aquí",
	"account.addresses.title": "Direcciones",
	"account.addresses.add": "Agregar dirección",
	"account.addresses.empty": "Todavía no tienes direcciones guardadas",
	"account.addresses.default": "Predeterminada",
	"account.addresses.makeDefault": "Usar como predeterminada",
	"account.addresses.deleteConfirm": "¿Eliminar esta dirección?",
	"account.addresses.inUse":
		"No puedes eliminar una dirección que un pedido activo está usando",
	"account.addresses.edit": "Editar",
	"account.addresses.form.title": "Nueva dirección",
	"account.addresses.form.editTitle": "Editar dirección",
	// The label is what the customer sees in the checkout's chip row, so the example is
	// worth showing: "Casa" tells them what the field is *for*, which the word "Etiqueta"
	// does not.
	"account.addresses.field.label": "Nombre corto",
	"account.addresses.field.label.placeholder": "Casa, Oficina, Casa de mamá",
	"account.addresses.field.line1": "Dirección exacta",
	"account.addresses.field.line1.placeholder":
		"Calle, número, señas de dónde es",
	"account.addresses.field.line2": "Apartamento o local",
	"account.addresses.field.city": "Ciudad",
	"account.addresses.field.region": "Provincia",
	"account.addresses.field.postalCode": "Código postal",
	"account.addresses.field.instructions": "Indicaciones para el repartidor",
	"account.addresses.field.instructions.placeholder":
		"Portón negro, tocar el timbre dos veces",
	"account.addresses.saved": "Dirección guardada",
	/*
	 * The address form's failure. It had no key of its own, so the screen drew the save
	 * refusal under `state.error.title` — "No pudimos cargar esto" — which names the wrong
	 * verb: nothing was being loaded, the customer had just pressed Guardar and the API said
	 * no. The sentence is deliberately parallel to `state.error.*`'s shape and not to it as a
	 * key: a failed *read* and a failed *write* are two different events and the reader can
	 * act on only one of them.
	 */
	"account.addresses.saveFailed": "No pudimos guardar la dirección",
	"account.profile.saved": "Perfil guardado",
	/*
	 * The profile screen's quiet line, and the other half of a pair that was one key doing two
	 * jobs. `account.profile.saved` is an event: it is announced when a save succeeds. The
	 * screen also used it to describe a state — a profile with nothing missing — so a customer
	 * who had changed nothing was told "Perfil guardado", a save that had not happened, and
	 * then told it a second time after they really did save. This states the state.
	 */
	"account.profile.complete": "Tu perfil está completo",
	"account.profile.emailInvalid": "Revisa el correo, le falta algo",
	"account.password.title": "Cambiar contraseña",
	"account.password.saved": "Contraseña actualizada",
	"account.sessions.revoke": "Cerrar sesión en otros dispositivos",
	"account.sessions.revokeBody":
		"Los demás teléfonos y navegadores tendrán que entrar de nuevo.",
	"account.sessions.revoked": "Sesiones cerradas en otros dispositivos",
	"account.signOut": "Cerrar sesión",
} as const;
