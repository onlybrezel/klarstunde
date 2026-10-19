import { isoDate } from './date'

export interface PlanSettings {
  date: string
  view: 'day' | 'week'
  effective: boolean
  compact: boolean
  compare: boolean
}

export const DISPLAY_STORAGE_KEY = 'klarstunde.display.v1'
type DisplayPreferences = Pick<PlanSettings, 'view' | 'compact' | 'effective' | 'compare'>

export function readDisplayPreferences(value: string | null): Partial<DisplayPreferences> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || parsed.version !== 1) return {}
    const record = parsed as Record<string, unknown>
    const result: Partial<DisplayPreferences> = {}
    if ('view' in parsed && (parsed.view === 'day' || parsed.view === 'week')) result.view = parsed.view
    for (const key of ['compact', 'effective', 'compare'] as const) {
      if (typeof record[key] === 'boolean') result[key] = record[key]
    }
    return result
  } catch { return {} }
}

export function saveDisplayPreferences(settings: PlanSettings): boolean {
  try {
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify({ version: 1, view: settings.view, compact: settings.compact, effective: settings.effective, compare: settings.compare }))
    return true
  } catch { return false }
}

export function resetDisplayPreferences(): { settings: PlanSettings; removed: boolean } {
  let removed = true
  try { window.localStorage.removeItem(DISPLAY_STORAGE_KEY) } catch { removed = false }
  return { settings: defaultPlanSettings(), removed }
}

function defaultPlanSettings(): PlanSettings {
  return { date: isoDate(new Date()), view: window.matchMedia('(max-width: 600px)').matches ? 'day' : 'week', effective: false, compact: false, compare: false }
}

export function initialPlanSettings(): PlanSettings {
  const defaults = defaultPlanSettings()
  try { return { ...defaults, ...readDisplayPreferences(window.localStorage.getItem(DISPLAY_STORAGE_KEY)) } }
  catch { return defaults }
}
