export interface Question {
  id: number
  dimension: string
  topic: string
  text: string
  options: string[]
  answer: number
  difficulty: number
}

export interface CatLogEntry {
  step: number
  dimension: string
  difficulty: number
  questionId: number
  correct: boolean
  contribution: number
  before: number
  after: number
}

export interface CatResult {
  scores: Record<string, number>
  total: number
  log: CatLogEntry[]
}

// 贡献分映射（确定性）：答对 低1=50 低2=60 中3=75 高4=90 高5=100；答错 低1=20 低2=30 中3=45 高4=50 高5=60
export function contributionFor(correct: boolean, difficulty: number): number {
  const table: Record<number, [number, number]> = {
    1: [50, 20],
    2: [60, 30],
    3: [75, 45],
    4: [90, 50],
    5: [100, 60],
  }
  const [right, wrong] = table[difficulty] ?? table[3]
  return correct ? right : wrong
}

export interface CatEngine {
  readonly done: boolean
  next(): { question: Question; dimension: string; difficulty: number }
  answer(correct: boolean): void
  snapshot(): CatSnapshot
  result(): CatResult
}

export interface CatSnapshot {
  difficulties: Record<string, number>
  scores: Record<string, number>
  counts: Record<string, number>
  askedIds: number[]
  cursor: number
}

export function createCatEngine(
  questions: Question[],
  total: number,
  dimensions: string[],
  options?: { avoidIds?: Set<number>; restore?: CatSnapshot; maxPerDim?: number }
): CatEngine {
  const byDim = new Map<string, Question[]>()
  for (const q of questions) {
    if (!byDim.has(q.dimension)) byDim.set(q.dimension, [])
    byDim.get(q.dimension)!.push(q)
  }

  const restore = options?.restore
  const difficulty = new Map(dimensions.map((d) => [d, restore?.difficulties?.[d] ?? 3]))
  const score = new Map(dimensions.map((d) => [d, restore?.scores?.[d] ?? 50]))
  const count = new Map(dimensions.map((d) => [d, restore?.counts?.[d] ?? 0]))
  const asked = new Set<number>(restore?.askedIds ?? [])
  const log: CatLogEntry[] = []
  let step = restore ? restore.askedIds.length : 0
  let cursor = restore?.cursor ?? -1
  let current: Question | null = null

  // 轮询：从上次选中维度的下一个开始，找还没测够 3 题的维度
  function nextDimension(): string | null {
    const limit = options?.maxPerDim ?? 3
    for (let i = 1; i <= dimensions.length; i++) {
      const d = dimensions[(cursor + i) % dimensions.length]
      if ((count.get(d) ?? 0) < limit) {
        cursor = (cursor + i) % dimensions.length
        return d
      }
    }
    return null
  }

  // 在该维度内按当前难度档随机选题；该档抽完则回退到该维度剩余题
  function pick(dim: string): Question | null {
    const remaining = (byDim.get(dim) ?? []).filter((q) => !asked.has(q.id))
    if (remaining.length === 0) return null
    // 复测避题：优先抽用户从未答过的题；该维度未答过的不够时，放开限制用旧题
    let pool = remaining
    if (options?.avoidIds?.size) {
      const fresh = remaining.filter((q) => !options.avoidIds!.has(q.id))
      if (fresh.length > 0) pool = fresh
    }
    const target = difficulty.get(dim)!
    const bucket = pool.filter((q) => q.difficulty === target)
    const candidates = bucket.length > 0 ? bucket : pool
    return candidates[Math.floor(Math.random() * candidates.length)]
  }

  return {
    get done() {
      return step >= total
    },
    next() {
      const dim = nextDimension()
      if (!dim) throw new Error('CAT: no dimension available')
      const question = pick(dim)
      if (!question) throw new Error('CAT: no question available')
      asked.add(question.id)
      count.set(dim, (count.get(dim) ?? 0) + 1)
      step++
      const d = difficulty.get(dim)!
      const bucketLeft = (byDim.get(dim) ?? []).filter(
        (q) => q.difficulty === d && !asked.has(q.id)
      ).length
      current = question
      console.log(
        `[CAT] 第${step}题 抽题: 维度=${dim} 难度=${d} 该难度剩余候选=${bucketLeft} -> 题#${question.id}`
      )
      return { question, dimension: dim, difficulty: d }
    },
    answer(correct: boolean) {
      if (!current) throw new Error('CAT: no current question')
      const dim = current.dimension
      const d = difficulty.get(dim)!
      const c = contributionFor(correct, d)
      const before = score.get(dim)!
      const after = before * 0.7 + c * 0.3
      score.set(dim, after)
      difficulty.set(dim, Math.min(5, Math.max(1, d + (correct ? 1 : -1))))
      log.push({
        step,
        dimension: dim,
        difficulty: d,
        questionId: current.id,
        correct,
        contribution: c,
        before,
        after,
      })
      console.log(
        `[CAT] 第${step}题 作答: 维度=${dim} 难度=${d} ${correct ? '答对' : '答错'} 贡献=${c} 分数 ${before.toFixed(1)} -> ${after.toFixed(1)}`
      )
      current = null
    },
    snapshot() {
      const difficulties: Record<string, number> = {}
      const scores: Record<string, number> = {}
      const counts: Record<string, number> = {}
      for (const d of dimensions) {
        difficulties[d] = difficulty.get(d)!
        scores[d] = score.get(d)!
        counts[d] = count.get(d)!
      }
      return {
        difficulties,
        scores,
        counts,
        askedIds: [...asked],
        cursor,
      }
    },
    result() {
      const scores: Record<string, number> = {}
      for (const d of dimensions) scores[d] = Math.round(score.get(d)!)
      const total = Math.round(
        dimensions.reduce((s, d) => s + score.get(d)!, 0) / dimensions.length
      )
      return { scores, total, log }
    },
  }
}
