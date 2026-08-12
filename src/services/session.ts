import type { AnswerRecord } from './diagnosis'
import type { CatSnapshot } from './cat-engine'

export interface QuizSession {
  id: number
  startedAt: number
  dimensionOnly?: string
  total: number
  answers: AnswerRecord[]
  snapshot: CatSnapshot
}

const STORAGE_KEY = 'ai-pm-coach-session'

export function loadSession(): QuizSession | null {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return raw && Array.isArray(raw.answers) && raw.snapshot ? raw : null
  } catch {
    return null
  }
}

export function saveSession(session: QuizSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}
