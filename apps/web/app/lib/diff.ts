export type DiffLine = {
  type: "added" | "removed" | "unchanged";
  value: string;
  oldLineNumber?: number;
  newLineNumber?: number;
};

/**
 * Simple LCS-based line diff.
 * Produces diff hunks without external dependency.
 */
export function diffLines(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent === "" ? [] : oldContent.split("\n");
  const newLines = newContent === "" ? [] : newContent.split("\n");

  if (oldLines.length === 0 && newLines.length === 0) return [];
  if (oldLines.length === 0) {
    return newLines.map((v, i) => ({ type: "added" as const, value: v, newLineNumber: i + 1 }));
  }
  if (newLines.length === 0) {
    return oldLines.map((v, i) => ({ type: "removed" as const, value: v, oldLineNumber: i + 1 }));
  }

  // LCS DP — for moderate files (< ~5000 lines) this is fine.
  // For large files we fall back to naive added/removed.
  const MAX = 4000;
  if (oldLines.length > MAX || newLines.length > MAX) {
    // Fallback: removed all + added all
    const res: DiffLine[] = [];
    let ol = 1, nl = 1;
    for (const v of oldLines) res.push({ type: "removed", value: v, oldLineNumber: ol++ });
    for (const v of newLines) res.push({ type: "added", value: v, newLineNumber: nl++ });
    return res;
  }

  const m = oldLines.length;
  const n = newLines.length;

  // dp[i][j] = LCS length of old[0..i-1], new[0..j-1]
  // Use 2 rows to save memory then reconstruct via full matrix for simplicity if small
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const result: DiffLine[] = [];
  let i = m, j = n;
  const rev: DiffLine[] = [];
  // we need to walk correctly; easiest: produce reversed then assign numbers later
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      rev.push({ type: "unchanged", value: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rev.push({ type: "added", value: newLines[j - 1] });
      j--;
    } else if (i > 0) {
      rev.push({ type: "removed", value: oldLines[i - 1] });
      i--;
    }
  }
  rev.reverse();

  // Assign line numbers
  let o = 1, ne = 1;
  for (const line of rev) {
    if (line.type === "unchanged") {
      result.push({ ...line, oldLineNumber: o++, newLineNumber: ne++ });
    } else if (line.type === "removed") {
      result.push({ ...line, oldLineNumber: o++ });
    } else {
      result.push({ ...line, newLineNumber: ne++ });
    }
  }

  return result;
}
