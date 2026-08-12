import { useCallback, useEffect, useRef, useState } from 'react'
import { DIMENSIONS, TOTAL_QUESTIONS, levelFor } from './data.js'
import { QUESTIONS } from './questions.js'
import { createCatEngine } from './services/cat-engine'
import { LLM_NOT_CONFIGURED, fallbackDiagnosis, generateDiagnosis, generateResources, hasQuestionCitation } from './services/diagnosis'
import { buildComparison, daysBetween, loadSnapshots, saveSnapshot } from './services/snapshots'
import { clearSession, loadSession, saveSession } from './services/session'

const PAGE = { HOME: 'home', INTRO: 'intro', QUIZ: 'quiz', RESULT: 'result', COMPARE: 'compare', GROWTH: 'growth' }
const DIMENSION_MAP = Object.fromEntries(DIMENSIONS.map((d) => [d.name, d]))
const STORAGE_KEY = 'ai-pm-coach-attempts'

function loadAttempts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

export default function App() {
  const [page, setPage] = useState(PAGE.HOME)
  const [result, setResult] = useState(null)
  const [resumeSession, setResumeSession] = useState(null)
  const [dimRetest, setDimRetest] = useState(null)

  const startQuiz = () => {
    setResumeSession(null)
    setDimRetest(null)
    setPage(PAGE.QUIZ)
  }

  return (
    <div className="min-h-screen bg-paper text-slate-800">
      {page === PAGE.HOME && (
        <Home
          onStart={() => {
            setResumeSession(null)
            setDimRetest(null)
            setPage(PAGE.INTRO)
          }}
          onCompare={() => setPage(PAGE.COMPARE)}
          onContinue={() => {
            setDimRetest(null)
            setResumeSession(loadSession())
            setPage(PAGE.QUIZ)
          }}
          onRestart={() => {
            clearSession()
            setResumeSession(null)
            setDimRetest(null)
            setPage(PAGE.QUIZ)
          }}
        />
      )}
      {page === PAGE.INTRO && (
        <Intro onBack={() => setPage(PAGE.HOME)} onStart={startQuiz} />
      )}
      {page === PAGE.QUIZ && (
        <Quiz
          resumeSession={resumeSession}
          dimensionOnly={dimRetest}
          onBack={() => setPage(PAGE.COMPARE)}
          onFinish={(r) => {
            setResumeSession(null)
            setResult(r)
            setPage(PAGE.RESULT)
          }}
          onDimDone={() => {
            setResumeSession(null)
            setDimRetest(null)
            setPage(PAGE.HOME)
          }}
        />
      )}
      {page === PAGE.GROWTH && <GrowthView snapshots={loadSnapshots()} onBack={() => setPage(PAGE.COMPARE)} />}
      {page === PAGE.COMPARE && (
        <ComparePage
          snapshots={loadSnapshots()}
          hasResult={Boolean(result)}
          onBackToResult={() => setPage(PAGE.RESULT)}
          onHome={() => setPage(PAGE.HOME)}
          onGrowth={() => setPage(PAGE.GROWTH)}
          onRetest={startQuiz}
        />
      )}
      {page === PAGE.RESULT && result && (
        <Result
          scores={result.scores}
          total={result.total}
          answers={result.answers}
          comparison={result.comparison}
          onBack={() => setPage(PAGE.COMPARE)}
          onRetest={startQuiz}
          onHome={() => setPage(PAGE.HOME)}
          onRetestDim={(name) => {
            setResumeSession(null)
            setDimRetest(name)
            setPage(PAGE.QUIZ)
          }}
        />
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="w-full max-w-5xl mx-auto px-6 py-6">
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">
        AI PM Coach
      </span>
    </header>
  )
}

function Home({ onStart, onCompare, onContinue, onRestart }) {
  const snapshots = loadSnapshots()
  const pending = loadSession()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full max-w-5xl mx-auto px-6 py-6">
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">
          AI PM Coach
        </span>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-6">
        {pending && <ResumeCard onContinue={onContinue} onRestart={onRestart} />}
        <FirstTimeHero onStart={onStart} snapshotsCount={snapshots.length} onCompare={onCompare} />
      </main>
    </div>
  )
}

function ResumeCard({ onContinue, onRestart }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-brand/40 bg-[#eef3fa] p-5 sm:flex-row">
      <div>
        <p className="font-semibold text-slate-900">你有一次未完成的测评，继续作答？</p>
        <p className="mt-1 text-sm text-slate-500">答题进度已自动保存，可以接着上次继续。</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          onClick={onContinue}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          继续
        </button>
        <button
          onClick={onRestart}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
        >
          放弃重来
        </button>
      </div>
    </div>
  )
}

function FirstTimeHero({ onStart, snapshotsCount, onCompare }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="max-w-2xl text-4xl md:text-[52px] font-bold tracking-tight text-slate-900 leading-tight">
        测出你的 AI PM 能力短板
      </h1>
      <p className="mt-5 text-lg text-slate-500">
        15 分钟，6 个维度，告诉你该补什么
      </p>
      <button
        onClick={onStart}
        className="mt-10 rounded-xl bg-brand px-10 py-4 text-lg font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
      >
        开始测评
      </button>
      {snapshotsCount > 0 && (
        <button
          onClick={onCompare}
          className="mt-4 rounded-lg border border-brand/30 px-5 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
        >
          查看测评对比 →
        </button>
      )}
      <p className="mt-8 text-sm text-slate-400">已有 1234 人完成测评</p>
    </div>
  )
}

function RetestButton({ days, onRetest }) {
  const state = days < 3 ? 'soon' : days <= 14 ? 'normal' : 'late'
  const text =
    state === 'soon'
      ? '建议再过几天复测，让学习有时间发挥作用。'
      : state === 'normal'
        ? `距离上次测评 ${days} 天，来复测一次看看进步。`
        : `已经 ${days} 天没测评了，回来看看自己的水平吧。`
  const cls =
    state === 'soon'
      ? 'bg-slate-200 text-slate-500'
      : 'bg-brand text-white hover:bg-brand-dark'
  return (
    <div className="text-center">
      <button
        onClick={onRetest}
        className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${state === 'late' ? 'shadow-lg ring-2 ring-brand/30 ' : ''}${cls}`}
      >
        立即复测
      </button>
      <p className="mt-1.5 text-xs text-slate-400">{text}</p>
    </div>
  )
}

function SingleSnapshotView({ snapshot, onRetest }) {
  const dims = DIMENSIONS.map((d) => ({ ...d, score: snapshot.scores[d.name] ?? 0 }))
  return (
    <div className="py-10 text-center">
      <h1 className="text-2xl font-bold text-slate-900">你的能力雷达</h1>
      <div className="mt-6">
        <RadarChart dims={dims} />
      </div>
      <p className="mx-auto mt-6 max-w-md text-slate-500">
        完成下一次测评后，你可以看到自己的进步对比。
      </p>
    </div>
  )
}

function computeCompare(snapshots) {
  const prev = snapshots[snapshots.length - 2]
  const curr = snapshots[snapshots.length - 1]
  const change = curr.total - prev.total
  const gains = DIMENSIONS.map((d) => ({
    name: d.name,
    change: (curr.scores[d.name] ?? 0) - (prev.scores[d.name] ?? 0),
  }))
  const biggest = gains.filter((g) => g.change > 0).sort((a, b) => b.change - a.change)[0]
  const weakest = gains.filter((g) => g.change <= 0).sort((a, b) => a.change - b.change)[0]
  return { prev, curr, change, gains, biggest, weakest }
}

function ComparePage({ snapshots, hasResult, onBackToResult, onHome, onGrowth, onRetest }) {
  const last = snapshots[snapshots.length - 1]
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between gap-4">
        <button
          onClick={onBackToResult}
          disabled={!hasResult}
          className="text-sm text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← 返回测评结果
        </button>
        <button
          onClick={onHome}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
        >
          返回首页
        </button>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pb-10">
        {snapshots.length === 0 ? (
          <div className="py-16">
            <RadarChart dims={[]} onStart={onRetest} />
          </div>
        ) : snapshots.length === 1 ? (
          <SingleSnapshotView snapshot={last} onRetest={onRetest} />
        ) : (
          <CompareContent snapshots={snapshots} onGrowth={onGrowth} />
        )}
        {last && (
          <div className="mt-12 text-center">
            <RetestButton days={daysBetween(last.date)} onRetest={onRetest} />
          </div>
        )}
      </main>
    </div>
  )
}

function CompareContent({ snapshots, onGrowth }) {
  const { prev, curr, change, biggest, weakest } = computeCompare(snapshots)
  const prevDims = DIMENSIONS.map((d) => ({ ...d, score: prev.scores[d.name] ?? 0 }))
  const currDims = DIMENSIONS.map((d) => ({ ...d, score: curr.scores[d.name] ?? 0 }))
  return (
    <div className="py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">两次测评对比</h1>
      </div>
      <div className="mt-6 grid items-center gap-10 lg:grid-cols-2">
        <CompareRadar prev={prevDims} curr={currDims} />
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">总分变化</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              上次 {prev.total} 分 → 本次 {curr.total} 分{' '}
              <ChangeBadge change={change} />
            </p>
          </div>
          {biggest && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">提升最大的维度</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {biggest.name} 提升了{' '}
                <span className="text-[#4e9d68]">{biggest.change} 分</span>
              </p>
            </div>
          )}
          {weakest && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">仍需加强</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {weakest.name} 仍是你的弱项
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {weakest.change >= 0 ? '（持平）' : `（较上次 ${weakest.change}）`}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
      {snapshots.length >= 2 && (
        <div className="mt-12 text-center">
          <button
            onClick={onGrowth}
            className="rounded-xl bg-brand px-8 py-3.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
          >
            查看完整成长曲线
          </button>
        </div>
      )}
    </div>
  )
}

function ChangeBadge({ change }) {
  if (change > 0) return <span className="text-[#4e9d68]">（+{change}）</span>
  if (change < 0) return <span className="text-[#d9824b]">（{change}）</span>
  return <span className="text-slate-400">（持平）</span>
}

function CompareRadar({ prev, curr }) {
  if (!prev?.length || !curr?.length) {
    return (
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-500">完成测评后查看你的能力雷达图</p>
      </div>
    )
  }
  const cx = 200
  const cy = 200
  const r = 112
  const angle = (i) => ((-90 + i * 60) * Math.PI) / 180
  const pt = (i, ratio) => [
    cx + r * ratio * Math.cos(angle(i)),
    cy + r * ratio * Math.sin(angle(i)),
  ]
  const grid = [0.25, 0.5, 0.75, 1].map((f) =>
    curr.map((_, i) => pt(i, f).join(',')).join(' ')
  )
  const prevPoly = prev.map((d, i) => pt(i, d.score / 100).join(',')).join(' ')
  const currPoly = curr.map((d, i) => pt(i, d.score / 100).join(',')).join(' ')
  return (
    <svg
      viewBox="0 0 400 400"
      className="mx-auto w-full max-w-[400px]"
      role="img"
      aria-label="两次测评对比雷达图"
    >
      {grid.map((p) => (
        <polygon key={p} points={p} fill="none" stroke="#e3ded6" strokeWidth={1} />
      ))}
      {curr.map((d, i) => {
        const [x, y] = pt(i, 1)
        const [lx, ly] = pt(i, 1.38)
        const anchor = x > cx + 10 ? 'start' : x < cx - 10 ? 'end' : 'middle'
        const dy = anchor === 'middle' ? 8 : 4
        return (
          <g key={d.name}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#e3ded6" strokeWidth={1} />
            <text
              x={lx}
              y={ly - dy}
              textAnchor={anchor}
              fontSize={11.5}
              fontWeight={600}
              fill="#9a948b"
            >
              {d.name}
            </text>
            <text x={lx} y={ly - dy + 13} textAnchor={anchor} fontSize={10.5} fill="#8b857c">
              {d.score} 分
            </text>
          </g>
        )
      })}
      <polygon
        points={prevPoly}
        fill="none"
        stroke="#c3bfb8"
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      <polygon
        points={currPoly}
        fill="rgba(31, 58, 95, 0.3)"
        stroke="#1f3a5f"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Intro({ onBack, onStart }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full max-w-5xl mx-auto px-6 pt-6">
        <button
          onClick={onBack}
          className="text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          ← 返回首页
        </button>
      </div>
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            测评介绍
          </h1>
          <p className="mt-4 text-slate-500 leading-relaxed">
            测评覆盖 AI 产品经理最常被问到的 6 个维度。完成后，你会清楚自己的短板在哪、该从哪里补起。
          </p>
          <p className="mt-3 text-sm font-medium text-slate-600">
            约 15 分钟 · 6 个维度
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIMENSIONS.map((d, i) => (
            <div
              key={d.name}
              className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="text-sm font-semibold text-brand">{String(i + 1).padStart(2, '0')}</div>
              <h2 className="mt-1.5 font-semibold text-slate-900">{d.name}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{d.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <button
            onClick={onStart}
            className="rounded-xl bg-brand px-10 py-4 text-lg font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
          >
            开始
          </button>
          <p className="text-sm text-slate-400">预计需要 15 分钟，请准备好不被打扰的时间</p>
        </div>
      </main>
    </div>
  )
}

function Quiz({ onFinish, onBack, onDimDone, resumeSession, dimensionOnly }) {
  // 题库守卫：题库为空或某维度题目少于 3 道时禁止启动测评
  const [bankError] = useState(() => {
    if (!QUESTIONS || QUESTIONS.length === 0) return true
    const counts = {}
    for (const q of QUESTIONS) counts[q.dimension] = (counts[q.dimension] || 0) + 1
    return DIMENSIONS.some((d) => (counts[d.name] || 0) < 3)
  })
  if (bankError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-slate-900">题库未就绪，请联系管理员</p>
          <button
            onClick={onBack}
            className="mt-4 rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
          >
            返回测评对比
          </button>
        </div>
      </div>
    )
  }

  const dimOnly = resumeSession?.dimensionOnly ?? dimensionOnly ?? null
  const total = resumeSession?.total ?? (dimOnly ? 5 : TOTAL_QUESTIONS)
  const [session] = useState(() => {
    const seen = new Set(
      loadAttempts().flatMap((a) => a.answers.map((x) => x.qId))
    )
    if (resumeSession) resumeSession.answers.forEach((a) => seen.add(a.qId))
    const engine = createCatEngine(
      QUESTIONS,
      total,
      dimOnly ? [dimOnly] : DIMENSIONS.map((d) => d.name),
      {
        avoidIds: seen,
        restore: resumeSession?.snapshot,
        maxPerDim: dimOnly ? 5 : 3,
      }
    )
    return { engine, first: engine.next(), answers: resumeSession?.answers ?? [] }
  })
  const { engine } = session
  const [q, setQ] = useState(session.first)
  const [index, setIndex] = useState(session.answers.length)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState(session.answers)
  const shownAt = useRef(Date.now())
  const attemptId = useRef(null)
  const sessionId = useRef(resumeSession?.id ?? Date.now())
  const sessionStarted = useRef(resumeSession?.startedAt ?? Date.now())
  const lockRef = useRef(false)
  const dim = DIMENSION_MAP[q.question.dimension]

  useEffect(() => {
    shownAt.current = Date.now()
    lockRef.current = false
  }, [index])

  const persistAttempt = (next, done, result) => {
    const attempts = loadAttempts()
    if (attemptId.current === null) attemptId.current = Date.now()
    let attempt = attempts.find((a) => a.id === attemptId.current)
    if (!attempt) {
      attempt = {
        id: attemptId.current,
        startedAt: attemptId.current,
        complete: false,
        answers: [],
      }
      attempts.push(attempt)
    }
    attempt.answers = next
    if (done) {
      attempt.complete = true
      attempt.finishedAt = Date.now()
      attempt.scores = result.scores
      attempt.total = result.total
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts))
  }

  const persistSession = (next) => {
    saveSession({
      id: sessionId.current,
      startedAt: sessionStarted.current,
      dimensionOnly: dimOnly,
      total,
      answers: next,
      snapshot: engine.snapshot(),
    })
  }

  const goNext = (skipped) => {
    if (lockRef.current) return
    lockRef.current = true
    const correct = !skipped && selected === q.question.answer
    engine.answer(correct)
    const record = {
      qId: q.question.id,
      dimension: q.question.dimension,
      topic: q.question.topic,
      question: q.question.text,
      difficulty: q.question.difficulty,
      userAnswer: skipped ? null : selected,
      correct,
      timeSpentMs: Date.now() - shownAt.current,
    }
    const next = [...answers, record]
    setAnswers(next)
    if (engine.done) {
      clearSession()
      if (dimOnly) {
        const result = engine.result()
        const snapshots = loadSnapshots()
        const last = snapshots[snapshots.length - 1]
        if (last) {
          last.scores[dimOnly] = result.scores[dimOnly]
          last.total = Math.round(
            DIMENSIONS.reduce((s, d) => s + (last.scores[d.name] ?? 0), 0) / DIMENSIONS.length
          )
          localStorage.setItem('ai-pm-coach-snapshots', JSON.stringify(snapshots))
        }
        onDimDone()
        return
      }
      const result = engine.result()
      persistAttempt(next, true, result)
      const snapshot = {
        date: new Date().toISOString(),
        scores: result.scores,
        total: result.total,
        answered: next.length,
        correct: next.filter((a) => a.correct).length,
      }
      const allSnapshots = loadSnapshots()
      const prev = allSnapshots[allSnapshots.length - 1]
      const comparison = prev ? buildComparison(prev, snapshot) : { hasPrevious: false, case: 'none' }
      saveSnapshot(snapshot)
      onFinish({ ...result, answers: next, comparison })
    } else {
      persistSession(next)
      persistAttempt(next, false)
      setQ(engine.next())
      setIndex(index + 1)
      setSelected(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full max-w-2xl mx-auto px-6 pt-8">
        <p className="text-sm text-slate-500">
          第 {index + 1} 题 / 共 {total} 题
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-[#ece8e0]">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-slate-200 bg-[#fffefb] p-7 shadow-sm">
          <p className="text-sm text-slate-400">
            {`#${q.question.id} · `}
            <span className="font-medium" style={{ color: dim.color }}>
              {q.question.dimension}
            </span>
          </p>
          <h1 className="mt-3 text-[19px] font-medium leading-[1.6] text-slate-900">
            {q.question.text}
          </h1>
          <div className="mt-6 space-y-3">
            {q.question.options.map((opt, i) => (
              <button
                key={opt}
                onClick={() => setSelected(i)}
                className={`w-full rounded-lg border px-4 py-3.5 text-left text-[15px] leading-relaxed transition-colors ${
                  selected === i
                    ? 'border-brand bg-[#eaf1fa] text-slate-900'
                    : 'border-[#e4e0d8] bg-white text-slate-600 hover:border-brand'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => goNext(false)}
            disabled={selected === null}
            className={`rounded-xl px-8 py-3 text-base font-medium transition-colors ${
              selected === null
                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                : 'bg-brand text-white hover:bg-brand-dark'
            }`}
          >
            下一题
          </button>
          <button
            onClick={() => goNext(true)}
            className="text-sm text-slate-400 transition-colors hover:text-slate-600"
          >
            跳过本题
          </button>
        </div>
      </main>
    </div>
  )
}

function scoreColor(score) {
  if (score < 60) return '#d9824b'
  if (score > 80) return '#4e9d68'
  return '#1f3a5f'
}

const TYPE_BADGE = {
  文章: 'bg-blue-50 text-blue-700',
  视频: 'bg-purple-50 text-purple-700',
  书: 'bg-amber-50 text-amber-700',
  课程: 'bg-green-50 text-green-700',
}

function Result({ scores, total, answers, comparison, onBack, onRetest, onRetestDim, onHome }) {
  const dims = DIMENSIONS.map((d) => ({ ...d, score: scores[d.name] ?? 0 }))
  // 最弱维度：优先选「答题数据足够（>=3 题）的维度」中分数最低的，避免自动生成撞上数据不足的维度
  const diagnosable = dims.filter(
    (d) => answers.filter((a) => a.dimension === d.name).length >= 3
  )
  const weakest = diagnosable.reduce((a, b) => (b.score < a.score ? b : a), diagnosable[0])
  const [showMistakes, setShowMistakes] = useState(false)
  const [scoreDim, setScoreDim] = useState(null)
  const mistakes = answers.filter((a) => !a.correct)
  const scrollToDiagnosis = () => {
    document.getElementById('diagnosis')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <main className="min-h-screen w-full max-w-5xl mx-auto px-6 py-12">
      <button
        onClick={onBack}
        className="text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        ← 返回测评对比
      </button>
      <FeedbackCard
        comparison={comparison}
        dims={dims}
        weakest={weakest}
        showMistakes={showMistakes}
        setShowMistakes={setShowMistakes}
        mistakes={mistakes}
      />
      <div className="mt-6">
        <button
          onClick={() => setShowMistakes(!showMistakes)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
        >
          查看本次错题（{mistakes.length} 道）{showMistakes ? ' · 收起' : ''}
        </button>
        {showMistakes && (
          <div className="mt-3">
            <MistakeList mistakes={mistakes} />
          </div>
        )}
      </div>
      <header className="text-center">
        <p className="text-[15px] text-slate-500">你的 AI PM 综合能力</p>
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <span className="text-[48px] font-bold leading-none tracking-tight text-slate-900">
            {total}
          </span>
          <span className="text-lg text-slate-500">
            分 · {levelFor(total)}
          </span>
        </div>
      </header>

      <div className="mt-10 grid items-center gap-12 lg:grid-cols-2">
        <RadarChart dims={dims} onStart={onRetest} onScoreClick={setScoreDim} />
        <ul className="space-y-3">
          {dims.map((d) => (
            <li key={d.name}>
              <button
                onClick={() => setScoreDim(d.name)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
              >
              <span
                className="size-3 shrink-0 rounded-[3px]"
                style={{ backgroundColor: d.color }}
              />
              <span className="font-semibold text-slate-900">{d.name}</span>
              <span
                className="ml-auto font-medium"
                style={{ color: scoreColor(d.score) }}
              >
                {d.score} 分
              </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div id="diagnosis" className="mt-12 space-y-5">
        {dims.map((d) => (
          <DiagnosisCard
            key={d.name}
            dim={d}
            answers={answers}
            auto={d.name === weakest.name}
          />
        ))}
      </div>

      <div className="mt-14 flex flex-col items-center gap-4">
        <button
          onClick={scrollToDiagnosis}
          className="rounded-xl bg-brand px-8 py-3.5 text-base font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
        >
          开始你的学习计划
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onRetest}
            className="rounded-lg border border-brand/40 px-5 py-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
          >
            立即复测
          </button>
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
          >
            测评对比
          </button>
          <button
            onClick={onHome}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400"
          >
            返回首页
          </button>
        </div>
      </div>
      {scoreDim && (
        <ScoreModal
          dim={dims.find((d) => d.name === scoreDim)}
          answers={answers}
          onClose={() => setScoreDim(null)}
          onRetestDim={() => {
            const name = scoreDim
            setScoreDim(null)
            onRetestDim(name)
          }}
        />
      )}
    </main>
  )
}

function DiagnosisCard({ dim, answers, auto }) {
  const dimAnswers = answers.filter((a) => a.dimension === dim.name)
  const insufficient = dimAnswers.length < 3
  const [state, setState] = useState(auto && !insufficient ? 'loading' : 'collapsed')
  const [diag, setDiag] = useState(null)
  const [isFallback, setIsFallback] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    return () => {
      alive.current = false
    }
  }, [])

  const generate = useCallback(async () => {
    setState('loading')
    try {
      const d = await generateDiagnosis({
        dimension: dim.name,
        score: dim.score,
        answers: dimAnswers,
      })
      if (!alive.current) return
      setDiag(d)
      setIsFallback(false)
      setState(hasQuestionCitation(d) ? 'done' : 'nocite')
    } catch {
      if (!alive.current) return
      setDiag(fallbackDiagnosis(dim.name, dim.score, dimAnswers.filter((a) => !a.correct).length))
      setIsFallback(true)
      setState('done')
    }
  }, [dim.name, dim.score, dimAnswers])

  useEffect(() => {
    if (auto && !insufficient) generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-lg font-bold text-slate-900">{dim.name}</h3>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold leading-none" style={{ color: scoreColor(dim.score) }}>
          {dim.score}
        </span>
        <span className="text-sm text-slate-400">分</span>
        {isFallback && <span className="ml-1 text-[11px] text-slate-300">（基础诊断）</span>}
      </div>
    </div>
  )

  if (insufficient) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {header}
        <p className="mt-3 text-sm text-slate-500">
          答题数据不足，无法生成针对性诊断
        </p>
      </section>
    )
  }

  if (state === 'collapsed') {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {header}
        <button
          onClick={generate}
          className="mt-3 rounded-lg border border-brand/30 px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
        >
          展开查看诊断
        </button>
      </section>
    )
  }

  if (state === 'loading') {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {header}
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-500">
          <span className="size-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
          AI 正在为你生成针对性诊断（约 3 秒）
        </div>
      </section>
    )
  }

  if (state === 'done' || state === 'nocite') {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {header}
        {state === 'nocite' && (
          <div className="mt-3 rounded-lg border border-[#d9824b]/50 bg-[#fdf3ec] px-4 py-3 text-sm text-slate-700">
            本次诊断未引用具体题号，可能不够精准。
            <button onClick={generate} className="ml-2 font-medium text-[#c9733d] hover:underline">
              重新生成
            </button>
          </div>
        )}
        <p className="mt-4 text-xl font-bold leading-snug text-brand">{diag.summary}</p>
      {diag.challenge ? (
        <div className="mt-4">
          <p className="font-semibold text-slate-900">可以挑战的方向</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{diag.challenge}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {diag.weaknesses.map((w, i) => (
            <div key={i} className="rounded-lg bg-[#faf9f6] p-4">
              <p className="font-semibold text-slate-900">{w.topic}</p>
              <p className="mt-1.5 rounded-md bg-[#f0eee9] px-3 py-2 text-[13px] leading-relaxed text-slate-600">
                {w.evidence}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{w.reason}</p>
              <p className="mt-2 text-sm font-semibold text-brand">→ {w.nextStep}</p>
              <ResourceSection dimension={dim.name} topic={w.topic} />
            </div>
          ))}
        </div>
      )}
      <div className="mt-5 rounded-lg border border-[#4e9d68]/40 bg-[#f2f8f3] p-4 text-sm leading-relaxed text-slate-700">
        {diag.encouragement}
      </div>
      </section>
    )
  }
}

function ResourceSection({ dimension, topic }) {
  const [state, setState] = useState('idle')
  const [resources, setResources] = useState(null)
  const alive = useRef(true)

  useEffect(() => {
    return () => {
      alive.current = false
    }
  }, [])

  const generate = useCallback(async () => {
    setState('loading')
    try {
      const rs = await generateResources({ dimension, topic })
      if (!alive.current) return
      setResources(rs)
      setState('done')
    } catch (err) {
      if (!alive.current) return
      setState(err?.message === LLM_NOT_CONFIGURED ? 'config' : 'error')
    }
  }, [dimension, topic])

  if (state === 'idle') {
    return (
      <button
        onClick={generate}
        className="mt-2.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand hover:text-brand"
      >
        查看推荐资源
      </button>
    )
  }
  if (state === 'loading') {
    return (
      <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500">
        <span className="size-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
        正在为你推荐学习资源…
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-500">
        资源推荐生成失败，请稍后重试
        <button onClick={generate} className="font-medium text-brand hover:underline">
          重试
        </button>
      </div>
    )
  }
  if (state === 'config') {
    return (
      <p className="mt-2.5 text-xs text-slate-400">
        尚未配置 AI 服务：把 .env.example 复制为 .env 并填写 VITE_LLM_API_KEY，然后重启开发服务器即可生成资源推荐。
      </p>
    )
  }
  return (
    <div className="mt-3 space-y-3">
      {resources.map((r, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-slate-900">{r.title}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[r.type] || 'bg-slate-100 text-slate-600'}`}
            >
              {r.type}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {r.platform} · {r.minutes} 分钟
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{r.reason}</p>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(r.search)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 inline-block rounded-md bg-[#f3f1ec] px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-brand hover:text-white"
          >
            用这个关键词搜索 → {r.search}
          </a>
        </div>
      ))}
    </div>
  )
}

function FeedbackCard({ comparison, dims, weakest, showMistakes, setShowMistakes, mistakes }) {
  if (!comparison || !comparison.hasPrevious) return null
  const { case: c, change, days, biggestGain } = comparison

  if (c === 'celebrate-total') {
    return (
      <div className="mt-6 rounded-xl bg-brand px-6 py-5 text-center text-white">
        <p className="text-xl font-bold">
          你在 {days > 0 ? `${days} 天里` : '复测中'}提升了 {change} 分！
        </p>
      </div>
    )
  }
  if (c === 'celebrate-dim') {
    return (
      <div className="mt-6 rounded-xl bg-brand px-6 py-5 text-center text-white">
        <p className="text-xl font-bold">
          你的【{biggestGain.name}】维度突破了！
          <span className="ml-2 text-sm font-normal text-white/80">（+{biggestGain.gain} 分）</span>
        </p>
      </div>
    )
  }
  if (c === 'decline') {
    return (
      <div className="mt-6 rounded-xl border border-[#d9824b]/50 bg-[#fdf3ec] px-6 py-5">
        <p className="font-semibold text-slate-800">今天的表现可能不在最佳状态。</p>
        <p className="mt-1 text-sm text-slate-600">
          我们一起回顾这次答错的题，看看是哪里出了问题。
        </p>
        <button
          onClick={() => setShowMistakes(!showMistakes)}
          className="mt-3 rounded-lg bg-[#d9824b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c9733d]"
        >
          查看本次错题
        </button>
      </div>
    )
  }
  if (c === 'stable') {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-5">
        <p className="font-medium text-slate-700">
          本次表现稳定。建议针对【{weakest.name}】做专项练习，下次会有突破。
        </p>
      </div>
    )
  }
  if (c === 'mild-gain') {
    return (
      <div className="mt-6 rounded-xl border border-[#4e9d68]/40 bg-[#f2f8f3] px-6 py-5">
        <p className="font-medium text-slate-700">
          本次比上次提升 {change} 分，保持节奏，继续针对弱项练习。
        </p>
      </div>
    )
  }
  return null
}

function ScoreModal({ dim, answers, onClose, onRetestDim }) {
  const dimAnswers = answers.filter((a) => a.dimension === dim.name)
  const high = dimAnswers.filter((a) => a.difficulty >= 4).length
  const correct = dimAnswers.filter((a) => a.correct).length
  const wrong = dimAnswers.length - correct
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold text-slate-900">{dim.name}</h3>
          <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600">
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-2 text-sm leading-relaxed text-slate-600">
          <p>你在这个维度答了 {dimAnswers.length} 道（其中 {high} 道高难度题）</p>
          <p>答对 {correct} 道，答错 {wrong} 道</p>
          <p>分数计算：初始分 50，每答一题按「新分 = 旧分 × 0.7 + 本题贡献 × 0.3」更新</p>
          <p className="pt-1 text-lg font-bold text-slate-900">当前分数：{dim.score}</p>
        </div>
        <button
          onClick={onRetestDim}
          className="mt-5 w-full rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          重测这个维度
        </button>
      </div>
    </div>
  )
}

function MistakeList({ mistakes }) {
  if (mistakes.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">本次没有答错的题。</p>
  }
  return (
    <ul className="mt-3 space-y-3">
      {mistakes.map((m) => {
        const q = QUESTIONS.find((x) => x.id === m.qId)
        return (
          <li key={m.qId} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-800">
              #{m.qId} {m.topic}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.question}</p>
            <p className="mt-2 text-xs text-slate-500">
              你的答案：{m.userAnswer === null ? '（跳过）' : q?.options[m.userAnswer] ?? '—'}
            </p>
            <p className="mt-0.5 text-xs text-[#d9824b]">
              正确答案：{q?.options[q.answer] ?? '—'}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function GrowthView({ snapshots, onBack }) {
  const W = 640
  const H = 280
  const padL = 36
  const padR = 16
  const padT = 16
  const padB = 30
  const x = (i) => padL + (i / Math.max(1, snapshots.length - 1)) * (W - padL - padR)
  const y = (v) => padT + (1 - v / 100) * (H - padT - padB)
  return (
    <div className="min-h-screen">
      <div className="w-full max-w-4xl mx-auto px-6 pt-6">
        <button onClick={onBack} className="text-sm text-slate-500 transition-colors hover:text-slate-900">
          ← 返回测评对比
        </button>
      </div>
      <main className="w-full max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900">完整成长曲线</h1>
        <p className="mt-1 text-sm text-slate-500">共 {snapshots.length} 次测评</p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="维度得分成长曲线">
            {[0, 25, 50, 75, 100].map((v) => (
              <g key={v}>
                <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#ece8e0" strokeWidth={1} />
                <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#b7b1a7">
                  {v}
                </text>
              </g>
            ))}
            {DIMENSIONS.map((d) => (
              <g key={d.name}>
                <polyline
                  points={snapshots.map((s, i) => `${x(i)},${y(s.scores[d.name] ?? 0)}`).join(' ')}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={2}
                />
                {snapshots.map((s, i) => (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(s.scores[d.name] ?? 0)}
                    r={3}
                    fill={d.color}
                  />
                ))}
              </g>
            ))}
            {snapshots.map((s, i) => (
              <text key={s.date} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="#9a948b">
                {formatDate(s.date)}
              </text>
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {DIMENSIONS.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-8 space-y-4">
          {[...snapshots].reverse().map((s, idx) => (
            <div key={s.date + idx} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-slate-900">{formatDate(s.date)}</p>
                <p className="text-sm text-slate-500">
                  总分 {s.total} · 答对 {s.correct}/{s.answered}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                {DIMENSIONS.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-medium text-slate-800">{s.scores[d.name] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function RadarChart({ dims, onStart, onScoreClick }) {
  const hasData = dims?.length > 0 && dims.some((d) => typeof d.score === 'number')
  if (!hasData) {
    return (
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-500">完成测评后查看你的能力雷达图</p>
        {onStart && (
          <button
            onClick={onStart}
            className="mt-4 rounded-xl bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            开始测评
          </button>
        )}
      </div>
    )
  }
  const cx = 200
  const cy = 200
  const r = 112
  const angle = (i) => ((-90 + i * 60) * Math.PI) / 180
  const pt = (i, ratio) => [
    cx + r * ratio * Math.cos(angle(i)),
    cy + r * ratio * Math.sin(angle(i)),
  ]
  const grid = [0.25, 0.5, 0.75, 1].map((f) =>
    dims.map((_, i) => pt(i, f).join(',')).join(' ')
  )
  const data = dims.map((d, i) => pt(i, d.score / 100).join(',')).join(' ')

  return (
    <svg
      viewBox="0 0 400 400"
      className="mx-auto w-full max-w-[400px]"
      role="img"
      aria-label="六维度能力雷达图"
    >
      {grid.map((p) => (
        <polygon key={p} points={p} fill="none" stroke="#e3ded6" strokeWidth={1} />
      ))}
      {dims.map((d, i) => {
        const [x, y] = pt(i, 1)
        const [vx, vy] = pt(i, d.score / 100)
        const axisColor =
          d.score >= 80 ? '#4e9d68' : d.score < 60 ? '#d9824b' : d.color
        const [lx, ly] = pt(i, 1.38)
        const anchor = x > cx + 10 ? 'start' : x < cx - 10 ? 'end' : 'middle'
        const dy = anchor === 'middle' ? 8 : 4
        return (
          <g key={d.name}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={axisColor} strokeWidth={1.3} />
            <circle cx={vx} cy={vy} r={4} fill={d.color} stroke="#fff" strokeWidth={1.5} />
            <text
              x={lx}
              y={ly - dy}
              textAnchor={anchor}
              fontSize={11.5}
              fontWeight={600}
              fill={d.color}
            >
              {d.name}
            </text>
            <text
              x={lx}
              y={ly - dy + 13}
              textAnchor={anchor}
              fontSize={10.5}
              fill="#8b857c"
              className={onScoreClick ? 'cursor-pointer' : undefined}
              onClick={onScoreClick ? () => onScoreClick(d.name) : undefined}
            >
              {d.score} 分
            </text>
          </g>
        )
      })}
      <polygon
        points={data}
        fill="rgba(31, 58, 95, 0.10)"
        stroke="#1f3a5f"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  )
}
