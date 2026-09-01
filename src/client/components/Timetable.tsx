import { ArrowRight, DoorOpen, UserRound } from 'lucide-react'
import type { Lesson, TimetableDay, TimetableLabels } from '../../shared/timetable'
import { assessmentLabel, roomLabel, subjectLabel } from '../../shared/timetable-labels'

const periodTimes: Record<number, string> = { 1: '08:00', 2: '08:45', 3: '09:45', 4: '10:30', 5: '11:30', 6: '12:15', 7: '13:15', 8: '14:00', 9: '15:00', 10: '15:45' }

function lessonClass(subject: string): string {
  const choices = ['sage', 'sand', 'blue', 'plum', 'clay']
  const score = Array.from(subject).reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return choices[score % choices.length]
}

function changeLabel(lesson: Lesson): string {
  if (lesson.status === 'cancelled') return 'Entfall'
  if (lesson.previous?.teacher) return 'Vertretung'
  if (lesson.previous?.room && !lesson.previous.subject) return 'Raumwechsel'
  return 'Geändert'
}

function ChangeDetails({ lesson, labels }: { lesson: Lesson; labels: TimetableLabels }) {
  if (!lesson.previous || lesson.status === 'cancelled') return null
  const values = [
    lesson.previous.subject && `${subjectLabel(lesson.previous.subject, labels.subjects)} → ${subjectLabel(lesson.subject, labels.subjects)}`,
    lesson.previous.teacher && `${lesson.previous.teacher} → ${lesson.teacher}`,
    lesson.previous.room && `${roomLabel(lesson.previous.room, labels.rooms)} → ${roomLabel(lesson.room, labels.rooms)}`,
  ].filter((value): value is string => Boolean(value))
  return values.length ? <div className="change-details">Vorher: {values.join(' · ')}</div> : null
}

function LessonEntry({ lesson, labels }: { lesson: Lesson; labels: TimetableLabels }) {
  const expandedSubject = subjectLabel(lesson.subject, labels.subjects)
  const holiday = /ferien$/i.test(lesson.subject)
  return (
    <article className={`lesson-entry ${lessonClass(lesson.subject)} ${lesson.status}`}>
      {lesson.status !== 'regular' && <span className="status-label">{changeLabel(lesson)}</span>}
      {lesson.exam && <span className={`exam-label ${lesson.examStatus ?? ''}`}>{assessmentLabel(lesson.exam)}{lesson.examStatus === 'cancelled' ? ' entfällt' : ''}</span>}
      <h3>{expandedSubject || 'Unterricht'}{expandedSubject !== lesson.subject && <small>{lesson.subject}</small>}</h3>
      {lesson.exam && <p className={`exam-name ${lesson.examStatus ?? ''}`}>{lesson.exam}</p>}
      {!holiday && <div className="lesson-meta">
        {lesson.teacher && <span><UserRound size={13} />{lesson.teacher}</span>}
        {lesson.room && <span title={lesson.room}><DoorOpen size={13} />{roomLabel(lesson.room, labels.rooms)}</span>}
      </div>}
      {lesson.status === 'cancelled' && lesson.previous && <div className="cancelled-details">{[lesson.previous.subject, lesson.previous.teacher, lesson.previous.room].filter(Boolean).join(' · ')}</div>}
      <ChangeDetails lesson={lesson} labels={labels} />
      {lesson.note && <p className="change-note">{lesson.note}</p>}
    </article>
  )
}

const emptyLabels: TimetableLabels = { subjects: {}, rooms: {} }

export function Timetable({ days, labels = emptyLabels }: { days: TimetableDay[]; labels?: TimetableLabels }) {
  const allPeriods = days.flatMap((day) => day.lessons.map((lesson) => lesson.period))
  const firstPeriod = allPeriods.includes(0) ? 0 : 1
  const lastPeriod = Math.max(firstPeriod, ...allPeriods)
  const periods = Array.from({ length: lastPeriod - firstPeriod + 1 }, (_, index) => firstPeriod + index)

  return (
    <div className="timetable-scroll">
      <div className="timetable" style={{ '--day-count': days.length } as React.CSSProperties}>
        <div className="corner-cell">Stunde</div>
        {days.map((day) => {
          const date = new Date(`${day.date}T12:00:00`)
          const today = day.date === new Date().toLocaleDateString('sv-SE')
          return <div className={`day-heading ${today ? 'today' : ''}`} key={day.date}><strong>{date.toLocaleDateString('de-DE', { weekday: 'long' })}</strong><span>{date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>{today && <small>Heute</small>}</div>
        })}
        {periods.map((period) => (
          <div className="period-row" key={period}>
            <div className="period-label"><strong>{period}</strong><span>{periodTimes[period] ?? ''}</span></div>
            {days.map((day) => {
              const lessons = day.lessons.filter((entry) => entry.period === period)
              const today = day.date === new Date().toLocaleDateString('sv-SE')
              return <div className={`lesson-cell ${lessons.length > 1 ? 'parallel' : ''} ${today ? 'today-column' : ''}`} key={day.date}>{lessons.map((lesson, index) => <LessonEntry lesson={lesson} labels={labels} key={`${lesson.subject}-${lesson.teacher}-${index}`} />)}</div>
            })}
          </div>
        ))}
      </div>
      <div className="timetable-legend"><span><i className="legend-change" /> Änderung</span><span><i className="legend-cancelled" /> Entfall</span><span><ArrowRight size={14} /> vorher → neu</span></div>
    </div>
  )
}
