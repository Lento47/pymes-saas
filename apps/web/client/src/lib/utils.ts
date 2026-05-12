import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: unknown, currency = "USD") {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getErrorMessage(err: any) {
  return err?.message ?? "Ocurrió un error inesperado";
}

export function formatCRC(n: number): string {
  return n === 0 ? "₡0" : `₡${n.toLocaleString("es-CR")}`;
}
