/**
 * English — signing in, and the account. Same keys as Spanish.
 *
 * `auth.error.invalidCredentials` covers "no such account" and "wrong password" with
 * one sentence, and that is a security decision rather than a translation shortcut:
 * two messages would make the form an oracle for whether a given email shops here.
 */
export const auth = {
	"auth.signIn.title": "Sign in to your account",
	"auth.signIn.subtitle":
		"Your orders, addresses and favorites, on any device.",
	"auth.signIn.submit": "Sign in",
	"auth.signIn.noAccount": "Don't have an account?",
	"auth.signIn.forgot": "I forgot my password",

	"auth.signUp.title": "Create your account",
	"auth.signUp.subtitle": "It takes less than a minute.",
	"auth.signUp.submit": "Create account",
	"auth.signUp.hasAccount": "Already have an account?",

	"auth.signUp.business.title": "Register your business",
	"auth.signUp.business.subtitle": "Create an account to open your shop.",
	"auth.signUp.delivery.title": "Register as a courier",
	"auth.signUp.delivery.subtitle": "Create an account to accept deliveries.",
	"auth.signUp.notCustomer": "Not a customer?",
	"auth.signUp.businessOption": "Register as a business",
	"auth.signUp.courierOption": "Register as a courier",

	"auth.field.email": "Email",
	"auth.field.email.placeholder": "you@example.com",
	"auth.field.password": "Password",
	"auth.field.password.placeholder": "At least 12 characters",
	"auth.field.name": "Name",
	"auth.field.name.placeholder": "What we should call you",
	"auth.field.phone": "Phone",
	"auth.field.phone.placeholder": "8888 8888",
	"auth.field.phone.help":
		"The business calls this number if something happens with your order.",
	"auth.field.confirmPassword": "Repeat your password",
	"auth.field.currentPassword": "Current password",

	"auth.or": "or",

	/**
	 * The courier's identification, at the door and not later. A courier is a dedicated
	 * use — this account exists to accept and deliver — and the question is asked here,
	 * where the session is made, rather than in a setting found afterwards.
	 */
	"auth.role.label": "What are you here for?",
	"auth.role.customer": "Customer",
	"auth.role.delivery": "Courier",
	"auth.role.deliveryHelp": "Only for accepting and delivering orders.",

	"auth.error.invalidCredentials": "Wrong email or password",
	"auth.error.emailInUse": "An account already exists with this email",
	// The number is Better Auth's `minPasswordLength` (`apps/api/src/auth.ts`), restated
	// rather than re-decided: copy that disagreed with the server would be the form lying
	// about the one requirement it actually enforces.
	"auth.error.weakPassword":
		"That password is too short. Use at least 12 characters.",
	"auth.error.passwordsDiffer": "The passwords don't match",
	"auth.error.emailNotConfirmed":
		"Confirm your email to continue. We sent you a link.",
	"auth.error.rateLimited": "Too many attempts in a row. Wait a minute.",
	"auth.error.suspended":
		"This account is suspended. Write to us and we'll take a look.",
	"auth.error.notConfigured": "This site doesn't have sign-in configured yet.",
	"auth.error.generic": "We couldn't complete the sign-in",

	"auth.reset.title": "Reset your password",
	"auth.reset.subtitle": "We'll send you a link to set a new one.",
	"auth.reset.submit": "Send link",
	"auth.reset.sent":
		"If an account exists with that email, the link is on its way.",

	"auth.signOut.confirm": "Sign out?",
	"auth.signOut.body": "You'll need to sign in again to see your orders.",

	"auth.session.expired": "Your session expired. Sign in again to continue.",
	"auth.session.refreshing": "Refreshing your session…",

	"account.title": "Your account",
	"account.profile.title": "Profile",
	"account.profile.name": "Name",
	"account.profile.email": "Email",
	"account.profile.phone": "Phone",
	"account.profile.emailLocked": "Your email isn't changed from here",
	"account.addresses.title": "Addresses",
	"account.addresses.add": "Add address",
	"account.addresses.empty": "You don't have any saved addresses yet",
	"account.addresses.default": "Default",
	"account.addresses.makeDefault": "Use as default",
	"account.addresses.deleteConfirm": "Delete this address?",
	"account.addresses.inUse":
		"You can't delete an address an active order is using",
	"account.addresses.edit": "Edit",
	"account.addresses.form.title": "New address",
	"account.addresses.form.editTitle": "Edit address",
	"account.addresses.field.label": "Short name",
	"account.addresses.field.label.placeholder": "Home, Office, Mom's place",
	"account.addresses.field.line1": "Street address",
	"account.addresses.field.line1.placeholder":
		"Street, number, landmarks that find it",
	"account.addresses.field.line2": "Apartment or unit",
	"account.addresses.field.city": "City",
	"account.addresses.field.region": "Province",
	"account.addresses.field.postalCode": "Postal code",
	"account.addresses.field.instructions": "Directions for the driver",
	"account.addresses.field.instructions.placeholder":
		"Black gate, ring the bell twice",
	"account.addresses.saved": "Address saved",
	/* The address form's own failure — see the Spanish file's note. */
	"account.addresses.saveFailed": "We couldn't save the address",
	"account.profile.saved": "Profile saved",
	/* The state, as opposed to the event above — see the Spanish file's note. */
	"account.profile.complete": "Your profile is complete",
	"account.profile.emailInvalid": "Check the email, something's missing",
	"account.password.title": "Change password",
	"account.password.saved": "Password updated",
	"account.sessions.revoke": "Sign out on other devices",
	"account.sessions.revokeBody":
		"Other phones and browsers will have to sign in again.",
	"account.sessions.revoked": "Signed out on other devices",
	"account.signOut": "Sign out",
} as const;
