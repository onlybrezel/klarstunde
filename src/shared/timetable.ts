export type LessonStatus = 'regular' | 'changed' | 'cancelled'

export interface Lesson {
  period: number
  subject: string
  teacher: string
  room: string
  exam?: string
  examStatus?: LessonStatus
  previous?: {
    subject?: string
    teacher?: string
    room?: string
  }
  note?: string
  status: LessonStatus
}

export interface TimetableDay {
  date: string
  lessons: Lesson[]
}

export interface TimetableResponse {
  days: TimetableDay[]
  source: 'live' | 'demo'
  labels?: TimetableLabels
}

export interface TimetableLabels {
  subjects: Record<string, string>
  rooms: Record<string, string>
}
