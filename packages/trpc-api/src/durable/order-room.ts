/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";

import type { Env } from "../env";

/**
 * One live order, and the socket it serves.
 *
 * Nobody is watching that socket yet. No client opens it — web polls `orders.byId` and
 * `orders.track`, and the apps poll `orders.byId` — so the room currently fans out to
 * nobody. This said "the socket somebody is watching it on", which described the shape
 * this was built for rather than the one it is in: the upgrade is session-verified and
 * the room sends the last event on connect, and nothing connects.
 *
 * Why a Durable Object rather than polling: an order changes four or five times in
 * twenty minutes, and the customer is looking at the screen for all of them. Polling
 * costs a request every ten seconds per watcher and still shows the customer a state
 * that is up to ten seconds old — long enough for "en camino" to appear after the
 * courier has knocked. A DO gives one coordination point per order, which is exactly
 * the cardinality of the thing being watched.
 *
 * **The DO is a fan-out, not a source of truth.** It holds the last event and the set
 * of sockets; the order's history is `order_event` in D1. That matters because a DO
 * can be evicted, and one that owned the timeline would lose an order's history to a
 * deploy. A socket that connects after an eviction gets the last event from D1 (the
 * caller passes it in the query string) and then follows this room.
 *
 * `acceptWebSocket` (the hibernation API) rather than holding the sockets in a field:
 * a Worker only bills while it is running, and a customer watching a pizza for twenty
 * minutes should not keep an isolate awake for twenty minutes. Hibernation wakes the
 * object on a message and lets it sleep in between.
 */

export type OrderRoomEvent = {
	orderId: string;
	/** `ORDER_STATUS_CHANGED` and friends — the same vocabulary as the queue. */
	type: string;
	/** The order's new status, when the event has one. */
	status?: string;
	/** ISO string: this crosses a socket, where a `Date` would arrive as something else. */
	at: string;
	note?: string;
};

export class OrderRoom extends DurableObject<Env> {
	/**
	 * Told about a new event, and fans it out.
	 *
	 * Called by the API's request path — `orders.advance` — over RPC. Not by the queue
	 * consumer: a queue delivery can lag by seconds, and the customer who just tapped
	 * "confirmar" is looking at the screen now. The queue still gets the event, for the
	 * notification write and anything that must not be lost.
	 */
	async publish(event: OrderRoomEvent): Promise<void> {
		await this.ctx.storage.put("last", event);

		const message = JSON.stringify(event);
		for (const socket of this.ctx.getWebSockets()) {
			try {
				socket.send(message);
			} catch {
				// A socket that throws is already gone; the hibernation API removes it.
				// Closing here would be redundant, and logging it would be noise on every
				// customer who closes the app mid-order.
			}
		}
	}

	/** The last event, for a client that reconnected between two of them. */
	async last(): Promise<OrderRoomEvent | null> {
		return (await this.ctx.storage.get<OrderRoomEvent>("last")) ?? null;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/live")) {
			if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
				return new Response("Expected a WebSocket upgrade", { status: 426 });
			}

			const pair = new WebSocketPair();
			const [client, server] = [pair[0], pair[1]];

			// The order's *identity* is checked before this room is ever reached — the
			// API resolves the token, loads the order and refuses a stranger, and only
			// then forwards the upgrade here. A DO cannot verify a session: it is
			// handed no bindings for the auth tables and no way to read `membership`.
			//
			// `["order"]` is the hibernation tag set: it is how a socket is found again
			// after the object has slept.
			this.ctx.acceptWebSocket(server, ["order"]);

			const last = await this.ctx.storage.get<OrderRoomEvent>("last");
			// Sent on connect so a reconnecting client is current immediately, rather
			// than sitting on a stale screen until the *next* status change — which for
			// a delivered order would be never.
			if (last) server.send(JSON.stringify(last));

			return new Response(null, { status: 101, webSocket: client });
		}

		if (url.pathname.endsWith("/publish") && request.method === "POST") {
			const event = (await request.json()) as OrderRoomEvent;
			await this.publish(event);
			return Response.json({ ok: true });
		}

		return new Response("Not found", { status: 404 });
	}

	/** A message from a client. Nothing is expected — this stream is one-way. */
	async webSocketMessage(
		socket: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		if (typeof message !== "string") return;
		// A `ping` keeps some mobile networks from reaping an idle socket. Answered
		// explicitly because a phone on a moving connection cannot distinguish a
		// silent stream from a dead one.
		if (message === "ping") socket.send(JSON.stringify({ type: "pong" }));
	}

	async webSocketClose(
		socket: WebSocket,
		code: number,
		reason: string,
	): Promise<void> {
		// `close` with the same code echoes the peer's own close back at it, which some
		// clients surface as an error. 1000 is what a normal teardown looks like.
		socket.close(code === 1006 ? 1000 : code, reason);
	}

	async webSocketError(socket: WebSocket): Promise<void> {
		socket.close(1011, "error");
	}
}
