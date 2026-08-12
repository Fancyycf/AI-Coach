export interface AnswerRecord {
  qId: number
  dimension: string
  topic: string
  question: string
  difficulty: number
  userAnswer: number | null
  correct: boolean
  timeSpentMs: number
}

export interface DiagnosisRequest {
  dimension: string
  score: number
  answers: AnswerRecord[]
}

export interface Weakness {
  topic: string
  evidence: string
  reason: string
  nextStep: string
}

export interface Diagnosis {
  summary: string
  weaknesses: Weakness[]
  challenge?: string
  encouragement: string
}

export interface LearningResource {
  title: string
  platform: string
  type: string
  minutes: number
  reason: string
  search: string
}

export interface ResourceRequest {
  dimension: string
  topic: string
}

const RESOURCE_TYPES = ['文章', '视频', '书', '课程']

interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export const LLM_NOT_CONFIGURED = 'LLM_NOT_CONFIGURED'

function getConfig(): LlmConfig {
  const win = (typeof window !== 'undefined' && (window as unknown as { __AI_PM_COACH_LLM__?: LlmConfig }).__AI_PM_COACH_LLM__)
  if (win) return win
  const env = (import.meta as unknown as { env?: Record<string, string> }).env || {}
  return {
    baseUrl: env.VITE_LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: env.VITE_LLM_API_KEY || '',
    model: env.VITE_LLM_MODEL || 'gpt-4o-mini',
  }
}

export function buildPrompt(req: DiagnosisRequest): string {
  const lines = req.answers.map(
    (a, i) =>
      `第${a.qId}题 | 考察点：${a.topic} | 难度：${a.difficulty}/5 | 结果：${a.correct ? '答对' : '答错'} | 题干：${a.question.slice(0, 80)}`
  )
  const mastery = req.score > 90 || req.answers.every((a) => a.correct)
  const section = mastery
    ? `【挑战方向】<用户在本维度没有答错的题（或得分超过 90），他已经掌握得很好：指出他可以挑战哪些更难的话题，并给一个具体动作>`
    : `【薄弱点1】\n考察点：<一句话概括考察点>\n答错证据：<必须引用真实题号，如"在第3题、第7题上"，并简述题干>\n原因：<基于他答错题的特征推测，不许凭空猜测>\n下一步：<一个具体、立刻能执行的动作，如"先读 OpenAI 官方 Evaluation Guide 文档第 3 章"，不许只说"多学习">\n（最多 3 个薄弱点，按影响排序；错几题就写几个）`

  return [
    '你是一位有 8 年经验的资深 AI 产品经理面试官，看过无数候选人的面试表现，非常清楚什么样的回答是好答案、什么样的回答是有缺陷的答案。',
    '你的任务：根据用户在某个维度的答题数据，生成一份针对性的能力诊断报告。',
    '你会收到以下数据：维度名、维度得分（0-100）、用户在这个维度答过的所有题（每题包括题号、考察点、难度 1-5、答对还是答错、题干摘要）。',
    '',
    `维度名：${req.dimension}`,
    `维度得分：${req.score}`,
    `答题记录：\n${lines.join('\n')}`,
    '',
    '输出要求：用结构化的中文段落输出。不要用 JSON，不要用代码格式，不要用 markdown 标题，就是自然语言段落。必须按以下模板输出，用【】标记段落（方便前端解析）：',
    '【一句话总结】30 字以内，犀利，直指问题本质。不要说"还有提升空间"这类圆滑的废话。',
    section,
    '【鼓励】必须引用用户答对的具体题目，如"你在第5题判断 Token 成本权衡时答得很好"。如果他没有答对的题，就针对他坚持完成测评本身给一句真诚的肯定，绝对不要编造答对的题。',
    '',
    '死规矩：',
    '1. 不许说"你在 X 方面有潜力但缺乏深度"这类正确的废话。',
    '2. 不许只说"建议多学习"，必须给可执行的具体动作（文档、练习、模板、复盘方式等）。',
    '3. 不许凭空推测原因，必须基于用户答错的题目特征来推测。',
    '4. 鼓励必须引用用户答对的具体题目，不能空洞。',
    '5. 答错证据和鼓励必须引用具体题号（如"在第3题上"），禁止用"你在部分题目上"这类泛指；至少引用 1 个真实题号。',
    '6. 分数超过 90 分或该维度没有答错的题时，不写薄弱点，改为【挑战方向】。',
  ].join('\n')
}

export function buildResourcePrompt(req: ResourceRequest): string {
  return [
    '你是一位 AI 产品经理学习教练，熟悉行业内的优质学习资源，知道哪些资源真正能补强某个能力短板。',
    '你的任务：根据用户的弱点维度和具体考察点，推荐 3-5 个学习资源帮他补强。',
    '你会收到以下输入：弱点维度名 + 具体考察点。',
    '',
    `弱点维度：${req.dimension}`,
    `具体考察点：${req.topic}`,
    '',
    '输出要求：用结构化的中文段落输出，不要用 JSON，不要用代码格式，不要用 markdown 标题。每条资源必须包含 6 个字段，按以下模板输出，用【】标记段落：',
    '【资源1】',
    '标题：<具体到能搜到的程度，如《Building LLM Applications》by Andrew Ng，而不是"Andrew Ng 的某门课">',
    '平台：<具体平台，如 DeepLearning.AI、OpenAI 官方博客、YouTube 上 Karpathy 的频道>',
    '类型：<只能是这四个字之一：文章、视频、书、课程，不要加任何其他字>',
    '时长：<只写数字分钟，如 60；不要写"约"、不要写"2 个月"这类模糊描述>',
    '理由：<一句话，说明为什么这个资源适合当前的考察点>',
    '搜索：<3-6 个关键词，用空格分隔，能定位到该资源>',
    '（共推荐 3-5 条，每条都按【资源N】的格式）',
    '',
    '死规矩：',
    '1. 绝对不许输出任何 URL。即使你记得某个链接，也不要输出；就算训练数据里有，也不许给。',
    '2. 只推荐稳定来源：优先知名作者（Andrew Ng、Karpathy、Chip Huyen 等）、大公司官方资源（OpenAI、Anthropic、Google AI 的官方文档）、经典书籍。不要推荐知乎、掘金、CSDN 上某篇具体文章，不要推荐不知名博主的某篇推文，不要推荐"昨天刚发"的最新文章。',
    '3. 搜索建议要可用：3-6 个词，足够具体能定位到资源，又不能长到没人会输入。',
    '4. 推荐理由必须结合当前考察点，不能是放之四海皆准的废话。',
  ].join('\n')
}

function extractSection(text: string, name: string): string {
  const re = new RegExp(`【${name}】([\\s\\S]*?)(?=【[^】]+】|$)`)
  const m = text.match(re)
  return m ? m[1].trim() : ''
}

function extractWeaknesses(text: string): Weakness[] {
  const blockRe = /【薄弱点\d+】([\s\S]*?)(?=【薄弱点\d+】|【鼓励】|$)/g
  const blocks = [...text.matchAll(blockRe)].map((m) => m[1])
  return blocks
    .map((block) => {
      const field = (label: string) => {
        const re = new RegExp(`(?:^|\\n)${label}：([\\s\\S]*?)(?=\\n(?:考察点|答错证据|原因|下一步)：|$)`)
        const m = block.match(re)
        return m ? m[1].trim() : ''
      }
      return {
        topic: field('考察点'),
        evidence: field('答错证据'),
        reason: field('原因'),
        nextStep: field('下一步'),
      }
    })
    .filter((w) => w.topic && w.evidence && w.reason && w.nextStep)
}

export function parseDiagnosis(text: string, score: number, wrongCount = 1): Diagnosis {
  const summary = extractSection(text, '一句话总结')
  const encouragement = extractSection(text, '鼓励')
  if (!summary || !encouragement) {
    throw new Error('diagnosis missing summary/encouragement')
  }
  if (score > 90 || wrongCount === 0) {
    const challenge = extractSection(text, '挑战方向')
    if (!challenge) throw new Error('diagnosis missing challenge section')
    return { summary, weaknesses: [], challenge, encouragement }
  }
  const weaknesses = extractWeaknesses(text)
  if (weaknesses.length === 0) {
    throw new Error('diagnosis missing weakness blocks')
  }
  return { summary, weaknesses, encouragement }
}

export function hasQuestionCitation(d: Diagnosis): boolean {
  const ref = /第\s*\d+\s*题/
  if (d.challenge) return ref.test(d.challenge + d.summary + d.encouragement)
  return d.weaknesses.some((w) => ref.test(w.evidence)) || ref.test(d.encouragement)
}

export function parseResources(text: string): LearningResource[] {
  if (/https?:\/\//.test(text)) throw new Error('resource output contains URL')
  const blockRe = /【资源\d+】([\s\S]*?)(?=【资源\d+】|$)/g
  const blocks = [...text.matchAll(blockRe)].map((m) => m[1])
  const normalizeType = (raw: string): string | null => {
    const t = raw.trim()
    for (const k of RESOURCE_TYPES) if (t.includes(k)) return k
    return null
  }
  const parseMinutes = (raw: string): number => {
    const m = raw.match(/(\d+(?:\.\d+)?)\s*(分钟|小时|天)/)
    if (m) {
      const v = Number(m[1])
      if (m[2] === '小时') return Math.round(v * 60)
      if (m[2] === '天') return Math.round(v * 1440)
      return Math.round(v)
    }
    const d = raw.match(/\d+/)
    return d ? Number(d[0]) : 0
  }
  const resources = blocks
    .map((block) => {
      const field = (label: string) => {
        const re = new RegExp(`(?:^|\\n)${label}：([\\s\\S]*?)(?=\\n(?:标题|平台|类型|时长|理由|搜索)：|$)`)
        const m = block.match(re)
        return m ? m[1].trim() : ''
      }
      const title = field('标题')
      const platform = field('平台')
      const type = normalizeType(field('类型'))
      const minutes = parseMinutes(field('时长'))
      const reason = field('理由')
      const search = field('搜索')
      const tokens = search.split(/\s+/).filter(Boolean)
      return { title, platform, type, minutes, reason, search, tokens }
    })
    .filter(
      (r) =>
        r.title && r.platform && r.type && r.minutes > 0 && r.reason &&
        r.tokens.length >= 2 && r.tokens.length <= 10
    )
    .map(({ tokens, ...r }) => r) as LearningResource[]
  if (resources.length < 3 || resources.length > 5) {
    throw new Error(`resource count out of range: ${resources.length}`)
  }
  return resources
}

async function callLLM(prompt: string): Promise<string> {
  const cfg = getConfig()
  if (!cfg.apiKey) throw new Error(LLM_NOT_CONFIGURED)
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: '请开始。' }],
      temperature: 0.4,
      max_tokens: 2000,
    }),
  })
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('LLM empty response')
  return text
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// 第一次失败等 1 秒重试，第二次失败等 3 秒重试，第三次失败抛错走降级
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  const delays = [1000, 3000]
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      return await run()
    } catch (err) {
      if ((err as Error).message === LLM_NOT_CONFIGURED) throw err
      console.warn(`[DIAG] 第 ${attempt + 1} 次调用失败:`, (err as Error).message)
      if (attempt < 2) await sleep(delays[attempt])
    }
  }
  throw new Error('LLM failed after 3 attempts')
}

export async function generateDiagnosis(req: DiagnosisRequest): Promise<Diagnosis> {
  const wrongCount = req.answers.filter((a) => !a.correct).length
  return withRetry(async () => parseDiagnosis(await callLLM(buildPrompt(req)), req.score, wrongCount))
}

export async function generateResources(req: ResourceRequest): Promise<LearningResource[]> {
  return withRetry(async () => parseResources(await callLLM(buildResourcePrompt(req))))
}

// ---------------- 降级文本：6 维度 × 4 分数段 ----------------
export type ScoreBand = 'low' | 'midLow' | 'midHigh' | 'high'

export function bandOf(score: number): ScoreBand {
  if (score < 40) return 'low'
  if (score < 60) return 'midLow'
  if (score < 80) return 'midHigh'
  return 'high'
}

const FALLBACKS: Record<string, Record<ScoreBand, Diagnosis>> = {
  'AI 产品思维': {
    low: {
      summary: '你判断 AI 场景靠直觉，说不出为什么值得做',
      weaknesses: [{
        topic: '场景价值判断',
        evidence: '综合你本次在该维度的答题情况，场景与价值类判断失误集中',
        reason: '缺乏从业务目标反推 AI 方案的框架，容易被技术名词带偏',
        nextStep: '选一个你熟悉的业务问题，用「用户痛点 → AI 能力 → 成本收益」三栏各写三行，再找同事挑战你的结论',
      }],
      encouragement: '你能识别明显的伪需求，说明基础直觉在线，把判断框架补齐后会明显改善。',
    },
    midLow: {
      summary: '你能识别场景，但说不清优先级和取舍依据',
      weaknesses: [{
        topic: '场景优先级与价值权衡',
        evidence: '综合你本次在该维度的答题情况，价值与优先级类题目出现偏差',
        reason: '判断停留在"能不能做"，缺少"值不值得现在做"的成本收益分析',
        nextStep: '把你手头三个候选需求按「价值 / 成本 / 风险」各打 1-5 分排个序，并写下排序理由',
      }],
      encouragement: '你在场景识别上的作答说明你有产品嗅觉，缺的是把直觉变成可论证的结构。',
    },
    midHigh: {
      summary: '你有判断框架，但边界条件考虑不全',
      weaknesses: [{
        topic: '场景可行性边界',
        evidence: '综合你本次在该维度的答题情况，可行性边界类题目出现偏差',
        reason: '对数据、成本、合规等负面条件的推演不足，容易高估方案可行性',
        nextStep: '针对你最近一个 AI 方案，专门列一页"什么情况下这个方案不成立"',
      }],
      encouragement: '你的框架意识已经在答题里体现出来，补上反例思维就能再上一个台阶。',
    },
    high: {
      summary: '你的场景判断接近面试官标准，缺的是体系化输出',
      weaknesses: [{
        topic: '方法论沉淀',
        evidence: '综合你本次在该维度的答题情况，方法论的体系化表达偏弱',
        reason: '判断快但没有沉淀成可复用的评估清单，团队复制不了你的思路',
        nextStep: '把你判断 AI 场景的 checklist 写成文档，下次评审直接用它',
      }],
      encouragement: '你在价值判断上的表现已经明显超过多数候选人，继续往方法论层走。',
    },
  },
  '技术理解': {
    low: {
      summary: '你对大模型技术缺乏选型框架，概念容易混',
      weaknesses: [{
        topic: '模型选型与能力边界',
        evidence: '综合你本次在该维度的答题情况，模型选型与能力边界类题目错误集中',
        reason: '可能没有实际选型经验，对参数、上下文、成本、延迟的关系停留在概念层',
        nextStep: '做一张对比表：5 个主流模型列出上下文长度、价格、延迟，并为 3 个场景各写一段选型理由',
      }],
      encouragement: '你在技术题中答对的部分说明你有基本直觉，选型框架补上后会明显改善。',
    },
    midLow: {
      summary: '你懂技术名词，但选型时给不出取舍依据',
      weaknesses: [{
        topic: '技术方案取舍',
        evidence: '综合你本次在该维度的答题情况，技术方案取舍类题目出现偏差',
        reason: '知道有什么技术，但说不清在什么约束下选哪个，缺 trade-off 练习',
        nextStep: '拿你负责过的功能，写下 RAG、长上下文、微调三种方案的取舍理由',
      }],
      encouragement: '你能用对术语，说明平时有积累，把取舍讲清楚就达标了。',
    },
    midHigh: {
      summary: '你的技术理解能应付常规题，深挖会露怯',
      weaknesses: [{
        topic: '技术细节深度',
        evidence: '综合你本次在该维度的答题情况，技术细节类题目出现偏差',
        reason: '对底层机制（如检索召回、上下文窗口影响）理解不深，被追问就含糊',
        nextStep: '选一个你常用的技术（如 RAG），读一篇官方文档并写出它的三个失败模式',
      }],
      encouragement: '你的技术储备在同龄 PM 里不弱，深度上再补一个点就够了。',
    },
    high: {
      summary: '你的技术理解已经够用，可以挑战架构级问题',
      weaknesses: [{
        topic: '系统架构权衡',
        evidence: '综合你本次在该维度的答题情况，端到端架构权衡展示偏少',
        reason: '单点技术没问题，但数据流、成本、评测的整体权衡讲得少',
        nextStep: '把你最熟的产品画一张端到端技术架构图，标出每个环节的瓶颈',
      }],
      encouragement: '你在技术题上的表现接近技术型 PM 的水平，往架构视角走会有明显优势。',
    },
  },
  '数据与评估': {
    low: {
      summary: '你不清楚评测体系怎么搭，指标停留在表面',
      weaknesses: [{
        topic: '评测集与指标体系',
        evidence: '综合你本次在该维度的答题情况，评测集构建与指标选择类题目失误集中',
        reason: '没实际建过评测集，不知道相关率、幻觉率、badcase 回流这些关键环节',
        nextStep: '为你的产品写一份评测方案：评测集来源、三类核心指标、badcase 回收流程',
      }],
      encouragement: '你能答对的部分说明你有数据意识，评测框架补上即可。',
    },
    midLow: {
      summary: '你认识常用指标，但说不清怎么组合使用',
      weaknesses: [{
        topic: '指标组合与评测设计',
        evidence: '综合你本次在该维度的答题情况，指标组合类题目出现偏差',
        reason: '把指标当名词在背，没有从业务目标推导指标组合的练习',
        nextStep: '用「业务目标 → 核心指标 → 辅助指标 → 坏例定义」四步重写你的产品评测方案',
      }],
      encouragement: '你记得住指标说明你接触过数据工作，把推导逻辑理顺就稳了。',
    },
    midHigh: {
      summary: '你的评测设计合格，但坏例分析和回流是短板',
      weaknesses: [{
        topic: 'badcase 分析与闭环',
        evidence: '综合你本次在该维度的答题情况，坏例分析与回流类题目出现偏差',
        reason: '评测有框架，但坏例分类和回流到训练或产品的闭环讲不具体',
        nextStep: '收集 20 个 badcase，按成因分类，并给每个类别写一条回流动作',
      }],
      encouragement: '你的评测框架在同题作答里算扎实的，补上闭环细节会更强。',
    },
    high: {
      summary: '你的评测能力接近专业水平，可挑战评测效率',
      weaknesses: [{
        topic: '评测自动化与成本',
        evidence: '综合你本次在该维度的答题情况，自动化评测类进阶问题展示偏少',
        reason: '评测方法论成熟，但自动化、小样本评测、成本控制讲得少',
        nextStep: '调研一种小样本或自动化评测方法（如 LLM-as-judge），并写清它的偏差风险',
      }],
      encouragement: '你的评测体系已经领先多数候选人，往自动化方向走就是加分项。',
    },
  },
  '交互与体验': {
    low: {
      summary: '你容易把 AI 产品设计成什么都能聊，缺兜底设计',
      weaknesses: [{
        topic: '对话交互的失败兜底',
        evidence: '综合你本次在该维度的答题情况，对话设计与兜底类题目失误集中',
        reason: '没经历过 AI 交互失败场景，缺少确认、纠错、降级这类流程意识',
        nextStep: '为你的助手写 5 个"答错时怎么办"的场景剧本，每个剧本写明兜底动作',
      }],
      encouragement: '你在交互题上答对的部分说明你有基本用户体验直觉，兜底设计是下一步。',
    },
    midLow: {
      summary: '你知道要防错，但设计不出具体兜底流程',
      weaknesses: [{
        topic: '纠错与降级流程设计',
        evidence: '综合你本次在该维度的答题情况，纠错与降级类题目出现偏差',
        reason: '停留在"应该加纠错"的层面，没设计过用户误解意图后的完整流程',
        nextStep: '画出用户连续两次误解意图时的状态流转图，标出每个节点的出口',
      }],
      encouragement: '你有防错意识已经超过不少 PM，把流程画出来就落地了。',
    },
    midHigh: {
      summary: '你的交互设计合格，但缺少人机边界思考',
      weaknesses: [{
        topic: '人机分工与边界',
        evidence: '综合你本次在该维度的答题情况，人机边界类题目出现偏差',
        reason: '关注了对话体验，但没想清楚哪些事该 AI 做、哪些该转人工',
        nextStep: '为你的场景写一份人机分工清单：AI 负责什么、转人工的触发条件',
      }],
      encouragement: '你的交互设计在同题作答里算好的，补上边界思考会更完整。',
    },
    high: {
      summary: '你的交互设计成熟，可挑战复杂协作场景',
      weaknesses: [{
        topic: '复杂人机协作架构',
        evidence: '综合你本次在该维度的答题情况，复杂协作场景展示偏少',
        reason: '单轮交互没问题，多智能体协作、长任务拆解这类场景没展示过',
        nextStep: '设计一个多角色协作的 AI 工作流，写明角色分工与冲突仲裁机制',
      }],
      encouragement: '你的交互题表现已经接近资深水平，复杂协作场景是下一步。',
    },
  },
  '规划与落地': {
    low: {
      summary: '你会把需求讲得很大，但拆不出执行路径',
      weaknesses: [{
        topic: '需求拆解与落地路径',
        evidence: '综合你本次在该维度的答题情况，落地拆解与排期类题目失误集中',
        reason: '习惯讲目标和方向，缺少把一句话需求拆成带验收标准任务链的练习',
        nextStep: '把你最近一个需求拆成三级任务，每级写清验收标准',
      }],
      encouragement: '你能讲清大方向，说明有产品全局感，拆解能力补上即可。',
    },
    midLow: {
      summary: '你能拆需求，但里程碑和资源规划含糊',
      weaknesses: [{
        topic: '里程碑与资源规划',
        evidence: '综合你本次在该维度的答题情况，里程碑与依赖类题目出现偏差',
        reason: '拆解停留在任务层面，没把数据依赖、模型验收节点、跨团队排期放进去',
        nextStep: '为你当前项目写一版带里程碑和依赖项的路线图',
      }],
      encouragement: '你的拆解意识已经建立，把依赖和节点补上就完整了。',
    },
    midHigh: {
      summary: '你的落地规划合格，但风险预案不足',
      weaknesses: [{
        topic: '交付风险与预案',
        evidence: '综合你本次在该维度的答题情况，风险预案类题目出现偏差',
        reason: '计划做得顺，但没考虑模型效果不达标、数据缺失时的 Plan B',
        nextStep: '为你项目写一页风险登记表：三个最大风险各配一个预案',
      }],
      encouragement: '你的路线图能力在同题作答里算强的，补上预案会更稳。',
    },
    high: {
      summary: '你的落地能力接近资深水平，可挑战规模化路径',
      weaknesses: [{
        topic: '从 MVP 到规模化',
        evidence: '综合你本次在该维度的答题情况，规模化路径展示偏少',
        reason: '单项目落地没问题，但多产品线、组织级规模化路径没展示过',
        nextStep: '写一份你产品从 MVP 到规模化的三阶段路径，标出每个阶段的验证指标',
      }],
      encouragement: '你的落地表现已经明显领先，规模化思考是下一个加分项。',
    },
  },
  '合规与风险': {
    low: {
      summary: '你对合规风险只有名词印象，不知道具体怎么防',
      weaknesses: [{
        topic: '风险识别与落地动作',
        evidence: '综合你本次在该维度的答题情况，隐私、安全、合规类题目失误集中',
        reason: '没实际做过风险评估，把风险当概念在背，说不出脱敏、权限、审计这些动作',
        nextStep: '为你的产品写一份风险清单：隐私、安全、内容合规各列三条具体措施',
      }],
      encouragement: '你能意识到合规的重要性，说明底线意识在，补上动作细节即可。',
    },
    midLow: {
      summary: '你知道要合规，但措施停留在原则层',
      weaknesses: [{
        topic: '合规措施落地',
        evidence: '综合你本次在该维度的答题情况，合规落地措施类题目出现偏差',
        reason: '能说出"要保护隐私"，但说不出脱敏方案、访问控制、数据保留策略怎么落地',
        nextStep: '把你产品涉及的数据列一张清单：每类数据的存储、脱敏、保留期、访问权限',
      }],
      encouragement: '你的合规意识是有的，把原则翻译成动作就达标了。',
    },
    midHigh: {
      summary: '你的风险框架合格，但应急和审计流程缺失',
      weaknesses: [{
        topic: '应急响应与审计',
        evidence: '综合你本次在该维度的答题情况，应急与审计类题目出现偏差',
        reason: '事前风险想得全，但事故响应、漏洞管理、合规性检查这类流程讲不细',
        nextStep: '为你的产品写一份事故响应手册：发现、定级、处置、复盘四步',
      }],
      encouragement: '你的风险框架在同题作答里算完整的，补上应急流程会更专业。',
    },
    high: {
      summary: '你的合规能力接近专业水平，可挑战治理体系',
      weaknesses: [{
        topic: 'AI 治理与责任机制',
        evidence: '综合你本次在该维度的答题情况，治理体系类进阶问题展示偏少',
        reason: '单点风险控制熟练，但组织级治理（责任归属、监管对接、审计体系）没展示过',
        nextStep: '写一份你产品的 AI 治理章程：谁负责、什么流程、如何审计',
      }],
      encouragement: '你的合规题表现已经接近专家水准，治理体系是下一步。',
    },
  },
}

export function fallbackDiagnosis(dimension: string, score: number, wrongCount?: number): Diagnosis {
  const band = wrongCount === 0 ? 'high' : bandOf(score)
  return FALLBACKS[dimension]?.[band] ?? {
    summary: '该维度暂无可用的诊断文本',
    weaknesses: [],
    encouragement: '可以稍后重试生成诊断。',
  }
}
