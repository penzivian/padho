import { getTeacherNavCounts } from "@/lib/nav-counts";

// Streamed inside the Tests nav link — the shell paints first, this fills in.
export async function NavTeacherBadge({ teacherId }: { teacherId: string }) {
  const { toGrade } = await getTeacherNavCounts(teacherId);
  if (!toGrade) return null;

  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">
      {toGrade}
    </span>
  );
}
