import type { TimetableDay } from '../shared/timetable.js'

const subjects = [
  ['Mathematik', 'Frau Kern', 'B204'],
  ['Wirtschaft', 'Herr Özdemir', 'A112'],
  ['Englisch', 'Frau Berger', 'C018'],
  ['Anwendungsentwicklung', 'Herr Wolff', 'D301'],
  ['Sport', 'Frau Peters', 'Sporthalle'],
  ['Deutsch', 'Herr Brandt', 'A207'],
] as const

export function demoWeek(startDate: string): TimetableDay[] {
  const monday = new Date(`${startDate}T12:00:00Z`)
  return Array.from({ length: 5 }, (_, dayIndex) => ({
    date: monday.toISOString().slice(0, 10),
    lessons: Array.from({ length: dayIndex === 4 ? 4 : 6 }, (_, periodIndex) => {
      const subject = subjects[(periodIndex + dayIndex) % subjects.length]
      return {
        period: periodIndex + 1,
        subject: subject[0],
        teacher: subject[1],
        room: subject[2],
        status: dayIndex === 1 && periodIndex === 3 ? 'changed' as const : dayIndex === 3 && periodIndex === 5 ? 'cancelled' as const : 'regular' as const,
      }
    }),
  })).map((day, index) => {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + index)
    return { ...day, date: date.toISOString().slice(0, 10) }
  })
}
