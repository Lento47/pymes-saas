/**
 * The in-app bell.
 *
 * A notification is a *record of something that happened*, written by the queue
 * consumer when an order moves and by a request when it has something to say
 * synchronously (a reply to a review). It is not a message queue of its own and it
 * is not a push token: the client reads this list, and what it does with the
 * unread count is its business.
 *
 * `kind` is a plain string rather than an enum on purpose — the set grows with the
 * product, and a client that receives an unknown kind should render the title and
 * body it was given rather than fail to parse the row. `data` is what the client
 * deep-links on, and it is nullable because not every notification points anywhere.
 *
 * `readAt` is a timestamp and not a boolean: "when did they see it" answers both
 * "is it unread" and the question somebody asks later.
 */

import { z } from "zod";

export const notificationSchema = z.object({
	id: z.string(),
	kind: z.string(),
	title: z.string(),
	body: z.string(),
	data: z.record(z.string(), z.unknown()).nullable(),
	readAt: z.date().nullable(),
	createdAt: z.date(),
});
export type Notification = z.infer<typeof notificationSchema>;
