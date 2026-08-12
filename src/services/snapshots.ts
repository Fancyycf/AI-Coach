export interface Snapshot {
  date: string
  scores: Record<string, number>
  total: number
  answered: number
  correct: number
}

export interface Comparison {
  hasPrevious: boolean
  prev?: Snapshot
  change?: number
  days?: number
  biggestGain?: { name: string; gain: number }
  weakest?: { name: string; change: number } | null
  case: 'celebrate-total' | 'celebrate-dim' | 'decline' | 'stable' | 'mild-gain' | 'none'
}

const STORAGE_KEY = 'ai-pm-coach-snapshots'

export function loadSnapshots(): Snapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveSnapshot(snapshot: Snapshot): void {
  const all = loadSnapshots()
  all.push(snapshot)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function daysBetween(dateISO: string, from = new Date()): number {
  const diff = from.getTime() - new Date(dateISO).getTime()
  return Math.max(0, Math.round(diff / 86400000))
}

export function buildComparison(prev: Snapshot, current: Snapshot): Comparison {
  const change = current.total - prev.total
  const days = daysBetween(prev.date, new Date(current.date))
  const gains = Object.keys(current.scores).map((name) => ({
    name,
    change: (current.scores[name] ?? 0) - (prev.scores[name] ?? 0),
  }))
  const biggestGain = gains
    .filter((g) => g.change > 0)
    .sort((a, b) => b.change - a.change)[0]
  const weakest = gains
    .filter((g) => g.change <= 0)
    .sort((a, b) => a.change - b.change)[0]

  let caseKind: Comparison['case'] = 'none'
  if (change >= 10) caseKind = 'celebrate-total'
  else if (biggestGain && biggestGain.change >= 15) caseKind = 'celebrate-dim'
  else if (change < -5) caseKind = 'decline'
  else caseKind = 'stable' // -5 ~ +5
  if (caseKind === 'stable' && change > 5) caseKind = 'mild-gain'

  return {
    hasPrevious: true,
    prev,
    change,
    days,
    biggestGain: biggestGain ? { name: biggestGain.name, gain: biggestGain.change } : undefined,
    weakest: weakest ?? null,
    case: caseKind,
  }
}
