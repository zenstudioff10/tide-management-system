/** Fractional indexing. Reordering writes one number on one task; it never
 *  renumbers the list. `before`/`after` are the neighbours' order values. */
export function between(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return 0
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

export const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order
