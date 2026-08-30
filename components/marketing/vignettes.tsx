// Decorative product vignettes for the landing page.
//
// These are faithful, static illustrations of interfaces that actually exist — the CBT question
// palette and a paper-builder question with option diagrams — drawn with the same tokens the
// real screens use, so they stay correct in both themes. They are aria-hidden: the surrounding
// copy carries the meaning, and a screen reader gains nothing from a picture of a UI.
//
// Nothing here asserts usage or traction. Illustrating a feature is fair; inventing a number is
// not, which is the line the competitor's "3,210 active streaks" (against a live counter of 14)
// falls the wrong side of.

// Lifted from components/student/cbt-shell.tsx so the vignette cannot drift from the real thing.
const TILE = {
  answered: "bg-primary text-primary-foreground border-primary",
  marked: "bg-violet-600/25 text-violet-900 border-violet-600/50 dark:text-violet-200",
  visited: "bg-[#c98a3c]/25 text-[#8a5a1f] border-[#c98a3c]/60 dark:text-[#e5b878]",
  not_visited: "bg-muted text-muted-foreground border-border"
} as const;

type TileState = keyof typeof TILE;

const PALETTE: TileState[] = [
  "answered", "answered", "visited", "answered", "marked",
  "answered", "answered", "answered", "visited", "answered",
  "marked", "answered", "not_visited", "not_visited", "answered",
  "not_visited", "not_visited", "not_visited", "not_visited", "not_visited"
];

const LEGEND: { state: TileState; label: string; count: number }[] = [
  { state: "answered", label: "Answered", count: 9 },
  { state: "visited", label: "Not answered", count: 3 },
  { state: "marked", label: "Marked for review", count: 2 },
  { state: "not_visited", label: "Not visited", count: 6 }
];

export function PaletteVignette() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(23,33,31,.04),0_24px_48px_-24px_rgba(23,33,31,.25)]"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-base font-semibold">Question palette</p>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">42:16 left</span>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {PALETTE.map((state, index) => (
          <span
            key={index}
            className={`flex h-9 items-center justify-center rounded-md border text-sm font-medium ${TILE[state]}`}
          >
            {index + 1}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid gap-1.5 text-xs">
        {LEGEND.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className={`h-3 w-3 shrink-0 rounded-sm border ${TILE[row.state]}`} />
            <dt className="flex-1 text-muted-foreground">{row.label}</dt>
            <dd className="font-mono tabular-nums">{row.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Four small graphs standing in for four answer options — the shape a JEE question takes when
// the choices are curves rather than sentences. currentColor so they invert with the theme.
function MiniGraph({ variant }: { variant: 0 | 1 | 2 | 3 }) {
  const paths = [
    "M4 28 L32 6", // linear
    "M4 28 Q18 28 32 6", // accelerating
    "M4 6 L32 28", // negative
    "M4 17 L14 17 L14 8 L32 8" // step
  ];
  return (
    <svg viewBox="0 0 36 34" className="h-9 w-10 shrink-0" role="presentation">
      <path d="M4 2 V30 H34" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.5" />
      <path
        d={paths[variant]}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OptionDiagramVignette() {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border bg-card p-5 shadow-[0_1px_2px_rgba(23,33,31,.04),0_24px_48px_-24px_rgba(23,33,31,.25)]"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Question 12
        </span>
        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground">
          +4 / −1
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed">
        Which graph shows the velocity of a body under uniform acceleration?
      </p>

      <div className="mt-4 grid gap-2">
        {[0, 1, 2, 3].map((variant) => (
          <div
            key={variant}
            className={`flex items-center gap-3 rounded-lg border p-2 ${
              variant === 1 ? "border-primary bg-secondary/50" : ""
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-serif text-xs font-semibold">
              {String.fromCharCode(65 + variant)}
            </span>
            <span className="text-primary">
              <MiniGraph variant={variant as 0 | 1 | 2 | 3} />
            </span>
            {variant === 1 ? (
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-primary">
                key
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// A topic-strength bar in the same teal / muted-teal / ochre language the real result pages use.
export function TopicStrengthVignette() {
  const topics = [
    { name: "Kinematics", percent: 84, tone: "bg-primary" },
    { name: "Rotational motion", percent: 51, tone: "bg-[#c98a3c]" },
    { name: "Thermodynamics", percent: 68, tone: "bg-primary/50" }
  ];
  return (
    <div aria-hidden="true" className="grid gap-2.5">
      {topics.map((topic) => (
        <div key={topic.name} className="grid gap-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">{topic.name}</span>
            <span className="font-mono tabular-nums">{topic.percent}%</span>
          </div>
          <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <span className={`h-full ${topic.tone}`} style={{ width: `${topic.percent}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
