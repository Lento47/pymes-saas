import {
	createDb,
	type Db,
	pushDelivery as deliveryTable,
	devicePushToken as tokenTable,
} from "@pymeshub/db";
import { and, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";

import type { Env } from "./env";
import type { Logger } from "./logging";

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const BATCH_SIZE = 100;

type PushContent = {
	title: string;
	body: string;
	data: Record<string, unknown>;
};

type ExpoTicket = {
	status: "ok" | "error";
	id?: string;
	message?: string;
	details?: { error?: string };
};

type ExpoReceipt = {
	status: "ok" | "error";
	message?: string;
	details?: { error?: string };
};

function headers(env: Env): HeadersInit {
	return {
		accept: "application/json",
		"content-type": "application/json",
		...(env.EXPO_ACCESS_TOKEN
			? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
			: {}),
	};
}

function retryAt(attempts: number): Date {
	return new Date(Date.now() + Math.min(3_600_000, 30_000 * 2 ** attempts));
}

export async function enqueuePushes(
	db: Db,
	eventId: string,
	userIds: string[],
	content: PushContent,
): Promise<number> {
	if (userIds.length === 0) return 0;
	const tokens = await db
		.select({ token: tokenTable.token, userId: tokenTable.userId })
		.from(tokenTable)
		.where(inArray(tokenTable.userId, userIds));
	if (tokens.length === 0) return 0;

	const now = new Date();
	await db
		.insert(deliveryTable)
		.values(
			tokens.map((entry) => ({
				id: crypto.randomUUID(),
				eventId,
				userId: entry.userId,
				token: entry.token,
				title: content.title,
				body: content.body,
				data: content.data,
				status: "PENDING" as const,
				createdAt: now,
				updatedAt: now,
			})),
		)
		.onConflictDoNothing();
	return tokens.length;
}

export async function deliverPendingPushes(
	env: Env,
	logger: Logger,
	eventId?: string,
): Promise<void> {
	const db = createDb(env.DB);
	const now = new Date();
	const due = await db
		.select()
		.from(deliveryTable)
		.where(
			and(
				eq(deliveryTable.status, "PENDING"),
				or(
					lte(deliveryTable.nextAttemptAt, now),
					isNull(deliveryTable.nextAttemptAt),
				),
				...(eventId ? [eq(deliveryTable.eventId, eventId)] : []),
			),
		)
		.limit(BATCH_SIZE);
	if (due.length === 0) return;

	let response: Response;
	try {
		response = await fetch(SEND_URL, {
			method: "POST",
			headers: headers(env),
			body: JSON.stringify(
				due.map((row) => ({
					to: row.token,
					title: row.title,
					body: row.body,
					data: row.data ?? {},
					sound: "default",
					priority: "high",
					channelId: "orders",
				})),
			),
		});
		if (!response.ok) throw new Error(`Expo push HTTP ${response.status}`);
	} catch (error) {
		await Promise.all(
			due.map((row) =>
				db
					.update(deliveryTable)
					.set({
						attempts: row.attempts + 1,
						lastError: "transport",
						nextAttemptAt: retryAt(row.attempts + 1),
						updatedAt: now,
					})
					.where(eq(deliveryTable.id, row.id)),
			),
		);
		logger.error("push send failed", {
			count: due.length,
			cause: error instanceof Error ? error.message : String(error),
		});
		return;
	}

	const payload = (await response.json()) as {
		data?: ExpoTicket[] | ExpoTicket;
	};
	const tickets = Array.isArray(payload.data)
		? payload.data
		: payload.data
			? [payload.data]
			: [];
	let failed = 0;
	for (const [index, row] of due.entries()) {
		const ticket = tickets[index];
		if (ticket?.status === "ok" && ticket.id) {
			await db
				.update(deliveryTable)
				.set({
					status: "TICKETED",
					receiptId: ticket.id,
					attempts: row.attempts + 1,
					lastError: null,
					nextAttemptAt: null,
					updatedAt: now,
				})
				.where(eq(deliveryTable.id, row.id));
			continue;
		}

		failed += 1;
		const terminal = ticket?.details?.error === "DeviceNotRegistered";
		await db
			.update(deliveryTable)
			.set({
				status: terminal ? "FAILED" : "PENDING",
				attempts: row.attempts + 1,
				lastError:
					ticket?.details?.error ?? ticket?.message ?? "missing_ticket",
				nextAttemptAt: terminal ? null : retryAt(row.attempts + 1),
				updatedAt: now,
			})
			.where(eq(deliveryTable.id, row.id));
		if (terminal)
			await db.delete(tokenTable).where(eq(tokenTable.token, row.token));
	}

	logger.info("push tickets processed", {
		requested: due.length,
		failed,
	});
}

export async function processPushReceipts(
	env: Env,
	logger: Logger,
): Promise<void> {
	const db = createDb(env.DB);
	const rows = await db
		.select()
		.from(deliveryTable)
		.where(
			and(
				eq(deliveryTable.status, "TICKETED"),
				isNotNull(deliveryTable.receiptId),
			),
		)
		.limit(BATCH_SIZE);
	if (rows.length === 0) return;

	let response: Response;
	try {
		response = await fetch(RECEIPTS_URL, {
			method: "POST",
			headers: headers(env),
			body: JSON.stringify({ ids: rows.map((row) => row.receiptId) }),
		});
		if (!response.ok) throw new Error(`Expo receipts HTTP ${response.status}`);
	} catch (error) {
		logger.error("push receipt check failed", {
			count: rows.length,
			cause: error instanceof Error ? error.message : String(error),
		});
		return;
	}

	const payload = (await response.json()) as {
		data?: Record<string, ExpoReceipt>;
	};
	const now = new Date();
	let failed = 0;
	for (const row of rows) {
		if (!row.receiptId) continue;
		const receipt = payload.data?.[row.receiptId];
		if (!receipt) continue;
		const delivered = receipt.status === "ok";
		if (!delivered) failed += 1;
		await db
			.update(deliveryTable)
			.set({
				status: delivered ? "DELIVERED" : "FAILED",
				lastError: delivered
					? null
					: (receipt.details?.error ?? receipt.message ?? "receipt_error"),
				updatedAt: now,
			})
			.where(eq(deliveryTable.id, row.id));
		if (receipt.details?.error === "DeviceNotRegistered")
			await db.delete(tokenTable).where(eq(tokenTable.token, row.token));
	}
	logger.info("push receipts processed", { checked: rows.length, failed });
}
