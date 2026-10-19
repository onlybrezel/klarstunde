import { isoDate } from './date'

export interface PlanSettings {
  date: string
  view: 'day' | 'week'
  effective: boolean
  compact: boolean
  compare: boolean
}

export function initialPlanSettings(): PlanSettings {
  return { date: isoDate(new Date()), view: window.matchMedia('(max-width: 600px)').matches ? 'day' : 'week', effective: false, compact: false, compare: false }
}
