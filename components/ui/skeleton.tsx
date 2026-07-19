import { cn } from "@/lib/utils";

/** Pulsing placeholder block. Respects prefers-reduced-motion (see globals.css). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md bg-muted", className)} />;
}
