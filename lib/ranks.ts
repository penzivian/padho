// Pure rank computation for a test's submissions. Ranks are always computed on read —
// never stored — because they shift as grading completes.

export type RankInput = {
  studentId: string;
  name: string;
  awarded: number;
  max: number;
  graded: boolean;
};

export type RankedRow = {
  studentId: string;
  name: string;
  awarded: number;
  max: number;
  /** 1 decimal place */
  percentage: number;
  /** Standard competition ranking: ties share a rank, the next rank skips. */
  rank: number;
  /** "top N%": ceil(rank / total * 100). */
  percentile: number;
};

export function computeRankList(rows: RankInput[]): {
  ranked: RankedRow[];
  pending: { studentId: string; name: string }[];
} {
  const pending = rows
    .filter((row) => !row.graded)
    .map(({ studentId, name }) => ({ studentId, name }));

  const graded = rows
    .filter((row) => row.graded)
    .map((row) => ({
      ...row,
      percentage: row.max > 0 ? Math.round((row.awarded / row.max) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.percentage - a.percentage || a.name.localeCompare(b.name));

  const total = graded.length;
  const ranked: RankedRow[] = [];

  graded.forEach((row, index) => {
    const rank =
      index > 0 && row.percentage === graded[index - 1].percentage
        ? ranked[index - 1].rank
        : index + 1;
    ranked.push({ ...row, rank, percentile: Math.ceil((rank / total) * 100) });
  });

  return { ranked, pending };
}
