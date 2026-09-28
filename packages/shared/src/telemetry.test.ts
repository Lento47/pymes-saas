import { describe, expect, test } from "bun:test";

import { scrubTelemetryPayload } from "./telemetry";

describe("scrubTelemetryPayload", () => {
	test("removes identity, exact movement and payment fields recursively", () => {
		const result: unknown = scrubTelemetryPayload({
			request: {
				authorization: "Bearer secret",
				url: "https://api.pymeshub.lat/orders?token=secret",
				data: {
					address: "Calle privada",
					courierLat: 9.93,
					courierLng: -84.08,
					paymentReference: "SINPE-123",
					statusCode: 500,
				},
			},
		});

		expect(result).toEqual({
			request: {
				authorization: "[Filtered]",
				url: "https://api.pymeshub.lat/orders",
				data: {
					address: "[Filtered]",
					courierLat: "[Filtered]",
					courierLng: "[Filtered]",
					paymentReference: "[Filtered]",
					statusCode: 500,
				},
			},
		});
	});

	/*
	 * The value pass, and the case the key filter structurally cannot reach.
	 *
	 * Everything above is a field this codebase names. These are personal data
	 * arriving inside a value no key name would catch — a customer's address quoted
	 * in an error message, a phone number in a support string. Under Ley 8968 that is
	 * still a treatment of their personal data, and `beforeSend` is the only thing
	 * standing between an error report and a US-hosted provider.
	 */
	test("redacts personal data out of free text the key filter cannot see", () => {
		const result: unknown = scrubTelemetryPayload({
			detail:
				"No se pudo entregar en la casa 5678. Escribile a ana.perez@correo.com o al 8712-3456.",
			context: {
				// The date is eight digits, so it goes. That is the known cost of an
				// 8-digit floor and it is left standing rather than special-cased,
				// because a compact date is not reliably distinguishable from a card
				// fragment and the two mistakes are not symmetric.
				note: "La clienta pidio reagendar para el 20260915",
				// The *key* matches, so this value never reaches the value pass at all.
				reference: "SINPE-4455-6677",
			},
			// A short digit run is an order id or a year. Redacting it would cost more
			// diagnosis than it protects, and the floor is asserted here so that stays
			// true rather than drifting down to every number.
			orderId: "4482",
			year: 2026,
		});

		expect(result).toEqual({
			detail:
				"No se pudo entregar en la casa 5678. Escribile a [Filtered] o al [Filtered].",
			context: {
				// A *name* is not matched, and `scrubStringValue`'s docblock says why:
				// there is no way to recognise one in free text without a name list,
				// which is precisely the customer database this module exists not to
				// become. Asserted so the limitation stays visible.
				note: "La clienta pidio reagendar para el [Filtered]",
				reference: "[Filtered]",
			},
			orderId: "4482",
			year: 2026,
		});
	});

	test("a CR phone number is redacted in every shape a person writes one", () => {
		// `PHONE_IN_TEXT` exists because the bare digit rule cannot span a separator:
		// `\b\d{8,}\b` does not match `8712-3456`, which is how the number is actually
		// written. Each shape below is one that has to be caught.
		expect(scrubTelemetryPayload({ a: "8712-3456" })).toEqual({
			a: "[Filtered]",
		});
		expect(scrubTelemetryPayload({ a: "+506 8712 3456" })).toEqual({
			a: "[Filtered]",
		});
		expect(scrubTelemetryPayload({ a: "50687123456" })).toEqual({
			a: "[Filtered]",
		});
		expect(scrubTelemetryPayload({ a: "87123456" })).toEqual({
			a: "[Filtered]",
		});
	});

	test("a url is reduced before the value pass, so a query-string email goes too", () => {
		const result: unknown = scrubTelemetryPayload({
			url: "https://api.pymeshub.lat/auth/verify?email=ana@correo.com&token=abc",
		});

		expect(result).toEqual({ url: "https://api.pymeshub.lat/auth/verify" });
	});

	test("leaves a six-digit run alone", () => {
		// The boundary is what makes the digit rule safe in both directions.
		const result: unknown = scrubTelemetryPayload({
			a: "casa 123456",
			b: "casa 12345678",
		});

		expect(result).toEqual({ a: "casa 123456", b: "casa [Filtered]" });
	});
});
