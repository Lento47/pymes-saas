import type { ReactNode } from "react";
import { Link } from "wouter";
import { ApiError } from "./api";

// `request()` suffixes ApiError.message with " · Ticket #abc abierto" for the
// benefit of toast call sites that just print err.message. When a call site
// uses this helper instead, we render the ticket as a real <Link> to the
// support page, scoped to the case via ?case=<id>.
const TICKET_SUFFIX_RE = / · Ticket #[a-zA-Z0-9]+ abierto$/;

export function apiErrorDescription(err: unknown, fallback?: string): ReactNode {
  if (err instanceof ApiError && err.case_id) {
    const cleanMessage = err.message.replace(TICKET_SUFFIX_RE, "") || fallback || "Error";
    const shortId = err.case_id.slice(-6);
    return (
      <span>
        {cleanMessage}{" · "}
        <Link
          href={`/support?case=${err.case_id}`}
          className="underline underline-offset-2 hover:opacity-80"
        >
          Ticket #{shortId}
        </Link>
      </span>
    );
  }
  if (err instanceof Error) return err.message || fallback || "Error";
  if (typeof err === "string") return err;
  return fallback || "Ocurrió un error inesperado";
}
