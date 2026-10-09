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

	/**
	 * The two assertions, and the sentence for when one is missing.
	 *
	 * Two controls and not one because they are two different claims. Accepting the
	 * terms is agreeing to a contract; confirming an age is asserting something about
	 * the person, which under Ley 8968 Art. 5 is what makes the agreement the
	 * agreement — a minor's consent needs a representative. Collapsing them into one
	 * checkbox would make the second one unprovable after the fact.
	 */
	"auth.signUp.termsLabel": "Acepto los Términos de Servicio.",
	"auth.signUp.ageLabel": "Confirmo que tengo 18 años o más.",
	"auth.signUp.consentRequired":
		"Acepta los términos y confirma tu edad para continuar.",
	"auth.signUp.termsLink": "Ver Términos",

	"auth.signUp.business.title": "Registra tu negocio",
	"auth.signUp.business.subtitle": "Crea una cuenta para abrir tu tienda.",
	"auth.signUp.delivery.title": "Regístrate como repartidor",
	"auth.signUp.delivery.subtitle": "Crea una cuenta para aceptar entregas.",
	/**
	 * La pareja del cliente, que leen tanto el título del registro como el grupo de tipo. Las
	 * dos frases de negocio y reparto existen porque esos dos modos cambian para qué *es* el
	 * formulario; el cliente es el caso llano, así que su frase está escrita en vez de vacía
	 * — o elegirlo dejaría sin contenido la línea que el grupo imprime bajo su encabezado.
	 */
	"auth.signUp.customer.subtitle":
		"Crea una cuenta para tener tus pedidos en un solo lugar.",
	"auth.signUp.notCustomer": "¿No eres cliente?",
	"auth.signUp.businessOption": "Regístrate como negocio",
	"auth.signUp.courierOption": "Regístrate como repartidor",

	/**
	 * Para qué es la cuenta, una línea por tipo. Cada una es una promesa del tipo, y la
	 * tarjeta que la lleva es la razón de que la puerta del registro sean tarjetas y no
	 * un segmento — ver `apps/mobile/app/(auth)/sign-in.tsx`.
	 */
	"auth.signUp.typeLabel": "Tipo de cuenta",
	"auth.signUp.type.businessHelp":
		"Vende, gestiona tus pedidos y haz crecer tu negocio.",
	"auth.signUp.type.customerHelp": "Compra a tus negocios favoritos.",
	"auth.signUp.type.deliveryHelp": "Realiza entregas y confirma pedidos.",

	/**
	 * La portada del grupo de autenticación: qué es esta app y las dos formas de entrar.
	 * Es el destino del índice del grupo, no el arranque en frío de la app — el mercado
	 * le responde completo a quien no ha iniciado sesión, y una pared delante de eso le
	 * costaría el embudo que existen para alimentar las páginas públicas.
	 */
	"auth.welcome.title": "Tu negocio en movimiento.",
	"auth.welcome.subtitle":
		"Gestiona ventas, entregas y pagos desde un solo lugar.",
	"auth.welcome.signUp": "Crear una cuenta",
	/**
	 * La segunda puerta, dicha como una frase con la acción dentro y no como un segundo
	 * botón: un solo control relleno en esta pantalla, y quien ya tiene cuenta llega igual
	 * en un toque. La palabra de la acción es `action.signIn`, compartida con el cambio de
	 * formulario, para que el mismo acto no tenga dos nombres.
	 */
	"auth.welcome.hasAccount": "¿Ya tienes cuenta?",

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
	"auth.role.business": "Negocio",
	"auth.role.delivery": "Repartidor",
	"auth.role.deliveryHelp": "Solo para aceptar y entregar pedidos.",
	"auth.role.businessHelp": "Para administering tu tienda y recibir pedidos.",

	"auth.provider.label": "Entrar con",
	"auth.provider.marketplace": "Marketplace",
	"auth.provider.supabase": "Supabase",

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
	// The panel's own two states, and the only sign-out strings that are *about the
	// session* rather than about a tree. The question and its consequence stay with the
	// tree that asks it — `biz.more.signOut*` for a merchant, the two keys above for a
	// courier — because "to see your orders" and "to manage your business" are different
	// sentences about the same act.
	"auth.signOut.busy": "Cerrando sesión…",
	"auth.signOut.failed": "No pudimos cerrar tu sesión. Inténtalo de nuevo.",

	"auth.session.expired": "Tu sesión venció. Entra de nuevo para continuar.",
	"auth.session.refreshing": "Renovando tu sesión…",

	"account.title": "Tu cuenta",
	"account.profile.title": "Perfil",
	"account.profile.name": "Nombre",
	"account.profile.email": "Correo",
	"account.profile.phone": "Teléfono",
	/*
	 * The picture, and the sentence under it. The help is the same wording
	 * `biz.products.photo.help` carries because it is the same two acts on the same
	 * kind of control; the key lives here because the thing being pictured is the
	 * reader rather than a product.
	 */
	"account.profile.photo": "Foto de perfil",
	"account.profile.photo.help":
		"Elige una de tu galería o toma una con la cámara.",
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
	"account.addresses.homeLabel": "Casa",
	"account.addresses.findingAddress": "Buscando la dirección del pin…",
	"account.addresses.checkAddress":
		"Revisa la dirección y completa los datos que falten.",
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
