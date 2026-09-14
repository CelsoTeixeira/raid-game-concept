export type GridPoint = { c: number; r: number };

export function inBounds(c: number, r: number, cols: number, rows: number): boolean {
  return c >= 0 && r >= 0 && c < cols && r < rows;
}

export function findPath(
  blocked: boolean[][],
  start: GridPoint,
  goal: GridPoint,
): GridPoint[] {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  if (!inBounds(start.c, start.r, cols, rows) || !inBounds(goal.c, goal.r, cols, rows)) {
    return [];
  }
  if (blocked[goal.r][goal.c] || blocked[start.r][start.c]) {
    return [];
  }
  if (start.c === goal.c && start.r === goal.r) {
    return [];
  }

  const key = (c: number, r: number) => `${c},${r}`;
  const open: GridPoint[] = [start];
  const came = new Map<string, GridPoint>();
  const g = new Map<string, number>([[key(start.c, start.r), 0]]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const h = (c: number, r: number) => Math.abs(c - goal.c) + Math.abs(r - goal.r);

  while (open.length > 0) {
    open.sort((a, b) => {
      const fa = (g.get(key(a.c, a.r)) ?? 1e9) + h(a.c, a.r);
      const fb = (g.get(key(b.c, b.r)) ?? 1e9) + h(b.c, b.r);
      return fa - fb;
    });
    const cur = open.shift()!;
    if (cur.c === goal.c && cur.r === goal.r) {
      const path: GridPoint[] = [cur];
      let k = key(cur.c, cur.r);
      while (came.has(k)) {
        const prev = came.get(k)!;
        path.push(prev);
        k = key(prev.c, prev.r);
      }
      path.reverse();
      path.shift();
      return path;
    }
    for (const [dc, dr] of dirs) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (!inBounds(nc, nr, cols, rows) || blocked[nr][nc]) continue;
      const nk = key(nc, nr);
      const ng = (g.get(key(cur.c, cur.r)) ?? 1e9) + 1;
      if (ng < (g.get(nk) ?? 1e9)) {
        g.set(nk, ng);
        came.set(nk, cur);
        if (!open.some((p) => p.c === nc && p.r === nr)) {
          open.push({ c: nc, r: nr });
        }
      }
    }
  }
  return [];
}

export function nearestOpen(
  blocked: boolean[][],
  from: GridPoint,
  isTaken: (c: number, r: number) => boolean,
): GridPoint | null {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  if (!inBounds(from.c, from.r, cols, rows)) return null;
  const seen = new Set<string>([`${from.c},${from.r}`]);
  const q: GridPoint[] = [from];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length > 0) {
    const cur = q.shift()!;
    if (!blocked[cur.r][cur.c] && !isTaken(cur.c, cur.r)) return cur;
    for (const [dc, dr] of dirs) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      const k = `${nc},${nr}`;
      if (!inBounds(nc, nr, cols, rows) || seen.has(k)) continue;
      seen.add(k);
      q.push({ c: nc, r: nr });
    }
  }
  return null;
}
