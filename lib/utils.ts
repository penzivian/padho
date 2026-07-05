import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  return trimmed.length ? trimmed : null;
}

export function generateInviteCode(length = 7) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < length; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}
