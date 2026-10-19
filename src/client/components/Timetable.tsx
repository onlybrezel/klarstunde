import { ArrowRight, DoorOpen, UserRound } from 'lucide-react'
import type { Lesson, TimetableDay, TimetableLabels } from '../../shared/timetable'
import { assessmentLabel, roomLabel, subjectLabel } from '../../shared/timetable-labels'
import { EmptyState } from './PageState'

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

export function Timetable({ days, labels = emptyLabels, classDays, compact = false }: { days: TimetableDay[]; labels?: TimetableLabels; classDays?: TimetableDay[]; compact?: boolean }) {
  const comparison = Boolean(classDays)
  const visibleClassDays = classDays?.filter((day) => days.some((personal) => personal.date === day.date)) ?? []
  const allPeriods = [...days, ...visibleClassDays].flatMap((day) => day.lessons.map((lesson) => lesson.period))
  const firstPeriod = allPeriods.includes(0) ? 0 : 1
  const lastPeriod = Math.max(firstPeriod, ...allPeriods)
  const periods = Array.from({ length: lastPeriod - firstPeriod + 1 }, (_, index) => firstPeriod + index)

  function entries(day: TimetableDay | undefined, period: number, first: boolean) {
    if (!day) return <p className="day-notice">Keine Vergleichsdaten</p>
    if (day.notice) return first ? <p className="day-notice">{day.notice}</p> : null
    if (day.lessons.length === 0) return first ? <p className="day-notice">Keine Einträge</p> : null
    return day.lessons.filter((lesson) => lesson.period === period).map((lesson, index) => <LessonEntry lesson={lesson} labels={labels} key={`${lesson.subject}-${lesson.teacher}-${index}`} />)
  }

  if (days.length === 0) return <EmptyState title="Keine Plandaten geliefert" message="Für die gewählte Ansicht wurden keine Tage geliefert. Prüfe die Auswahl und bei Bedarf das Originalportal." />

  return (
    <div className={`timetable-scroll ${compact ? 'compact-plan' : ''} ${comparison ? 'comparison-plan' : ''} ${days.length === 1 ? 'daily-plan' : ''}`} role="region" aria-label="Stundenplan, bei Bedarf seitlich und nach unten scrollen" tabIndex={0}>
      <div className="timetable" style={{ '--day-count': days.length } as React.CSSProperties} role="table" aria-label="Stundenplan">
        <div className="period-row" role="row">
          <div className="corner-cell" role="columnheader">Stunde</div>
          {days.map((day) => {
            const date = new Date(`${day.date}T12:00:00`)
            const today = day.date === new Date().toLocaleDateString('sv-SE')
            return <div className={`day-heading ${today ? 'today' : ''}`} role="columnheader" key={day.date}><strong>{date.toLocaleDateString('de-DE', { weekday: 'long' })}</strong><span>{date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>{today && <small>Heute</small>}</div>
          })}
        </div>
        {periods.map((period, periodIndex) => (
          <div className="period-row" role="row" key={period}>
            <div className="period-label" role="rowheader"><strong>{allPeriods.length ? period : '–'}</strong></div>
            {days.map((day) => {
              const today = day.date === new Date().toLocaleDateString('sv-SE')
              const classDay = visibleClassDays.find((entry) => entry.date === day.date)
              return <div className={`lesson-cell ${today ? 'today-column' : ''}`} role="cell" key={day.date}>
                {comparison ? <div className="comparison-lanes">
                  <section aria-label="Mein Plan">{periodIndex === 0 && <h2 className="lane-label">Mein Plan</h2>}{entries(day, period, periodIndex === 0)}</section>
                  <section aria-label="Klassenplan">{periodIndex === 0 && <h2 className="lane-label">Klassenplan</h2>}{entries(classDay, period, periodIndex === 0)}</section>
                </div> : entries(day, period, periodIndex === 0)}
              </div>
            })}
          </div>
        ))}
      </div>
      <div className="timetable-legend"><span><i className="legend-change" /> Änderung</span><span><i className="legend-cancelled" /> Entfall</span><span><ArrowRight size={14} /> vorher → neu</span></div>
    </div>
  )
}
