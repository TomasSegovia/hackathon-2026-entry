export type GraphItem = { id: string; prerequisites: string[] }

/**
 * Keeps only valid, acyclic prerequisites and drops redundant edges
 * (if A -> B -> C, the direct edge A -> C is implied).
 */
export function sanitizePrerequisites(items: GraphItem[]): Map<string, string[]> {
  const ids = new Set(items.map((item) => item.id))
  const accepted = new Map<string, string[]>(items.map((item) => [item.id, []]))
  const dependents = new Map<string, string[]>(items.map((item) => [item.id, []]))

  const reaches = (start: string, target: string) => {
    const stack = [start]
    const seen = new Set<string>()
    while (stack.length > 0) {
      const node = stack.pop() as string
      if (node === target) return true
      if (seen.has(node)) continue
      seen.add(node)
      stack.push(...(dependents.get(node) ?? []))
    }
    return false
  }

  for (const item of items) {
    for (const prerequisite of new Set(item.prerequisites)) {
      if (prerequisite === item.id || !ids.has(prerequisite)) continue
      if (reaches(item.id, prerequisite)) continue
      accepted.get(item.id)?.push(prerequisite)
      dependents.get(prerequisite)?.push(item.id)
    }
  }

  const result = new Map<string, string[]>()
  for (const [itemId, prerequisites] of accepted) {
    result.set(
      itemId,
      prerequisites.filter(
        (candidate) =>
          !prerequisites.some((other) => other !== candidate && reaches(candidate, other)),
      ),
    )
  }
  return result
}
