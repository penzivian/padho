import { cn } from "@/lib/utils";

// Tiny pure-SVG trend line (no charting deps). Draw-in animation lives in globals.css
// (.sparkline-path) and is disabled under prefers-reduced-motion.
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;

  const width = 120;
  const height = 36;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) => [
    pad + (index * (width - 2 * pad)) / (values.length - 1),
    height - pad - ((value - min) / range) * (height - 2 * pad)
  ]);
  const path = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      aria-hidden="true"
      className={cn("text-primary", className)}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <path
        className="sparkline-path"
        d={path}
        fill="none"
        pathLength={100}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
      <circle cx={lastX} cy={lastY} fill="currentColor" r={2.5} />
    </svg>
  );
}
