import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ChevronDown, IdCard, Maximize2, QrCode, RotateCcw, UserRound, X } from 'lucide-react'
import type { StudentCardPage as CardPage } from '../../shared/school'
import { getStudentCard } from '../api'
import { keepDialogFocus } from '../dialog'

function cardText(page: CardPage): string {
  const title = page.title.trim()
  const text = page.text.trim()
  return text.toLocaleLowerCase('de-DE').startsWith(title.toLocaleLowerCase('de-DE'))
    ? text.slice(title.length).trim() : text
}

const demoPages: CardPage[] = [{
  title: 'Schülerausweis', kind: 'identity', text: 'Beispieldaten – kein gültiger Nachweis',
  schoolName: 'Beispielschule', status: 'DEMO',
  fields: [{ label: 'Name', value: 'Alex Beispiel' }, { label: 'Geburtsdatum', value: '01.01.2008' }, { label: 'Schuljahr - Klasse', value: '2026/27 · Beispielklasse' }],
  images: [],
}, { title: 'Prüfcode', kind: 'verification', text: 'Im Schulkonto wird hier der unveränderte Prüfcode des Originalportals angezeigt.', images: [] }]

export function StudentCardView({ pages, demo = false }: { pages: CardPage[]; demo?: boolean }) {
  const [reverse, setReverse] = useState(false)
  const presentation = useRef<HTMLDialogElement>(null)
  const mainPage = pages.find((page) => page.kind === 'identity')
    ?? pages.find((page) => /schülerausweis|bbs-id/i.test(`${page.title} ${page.text}`)) ?? pages[0]
  if (!mainPage) return <div className="empty-area"><strong>Kein Ausweis hinterlegt</strong><p>Für dieses Konto wurde kein digitaler Schülerausweis freigegeben.</p></div>
  const school = mainPage.schoolName ?? pages.find((page) => page.kind === 'school')?.schoolName
  const nameField = mainPage.fields?.find((field) => /^Name$/i.test(field.label))
  const fields = mainPage.fields?.filter((field) => field !== nameField) ?? []
  const photo = mainPage.images.find((image) => image.role === 'photo' || /^(?:photo|foto|passbild)$/i.test(image.alt))
  const codePage = pages.find((page) => page.kind === 'verification')
    ?? pages.find((page) => page !== mainPage && page.images.some((image) => /qr/i.test(image.alt) && !/guid/i.test(image.alt)))
  const codes = codePage?.images.filter((image) => image.role === 'code' || /qr/i.test(image.alt)) ?? []
  const extraPages = pages.filter((page) => page !== mainPage && page !== codePage)
  const unplacedImages = [...mainPage.images.filter((image) => image !== photo), ...(codePage?.images.filter((image) => !codes.includes(image)) ?? [])]
  const hasReverse = codes.length > 0 || (demo && Boolean(codePage))

  const card = <article className={`student-id-card ${reverse ? 'student-id-reverse' : ''} ${demo ? 'student-id-demo' : ''}`} aria-label={reverse ? 'Rückseite mit Prüfcode' : 'Vorderseite des Schülerausweises'}>
        <header className="credential-header">
          <div className="credential-school"><span>Schule</span><strong>{school || 'Schülerausweis'}</strong></div>
          <span className="credential-type"><IdCard size={18} /><span>Schülerausweis</span></span>
        </header>
        {reverse ? <div className="credential-code-body">
          {demo ? <div className="credential-demo-code"><QrCode size={70} strokeWidth={1} /><strong>Demo-Prüfcode</strong><span>Kein scannbarer Nachweis</span></div>
            : codes.map((image, index) => <img className="credential-qr" src={image.source} alt={image.alt || 'Prüfcode aus dem Originalportal'} key={index} />)}
          <p>{demo ? 'Beispielansicht' : codePage ? cardText(codePage) : 'Prüfcode aus dem Originalportal'}</p>
        </div> : <div className="credential-body">
          <div className={`credential-portrait ${photo ? '' : 'credential-portrait-empty'}`}>
            {photo ? <img src={photo.source} alt="Ausweisfoto" /> : <><UserRound size={45} strokeWidth={1} /><span>{demo ? 'Beispielfoto' : 'Kein Foto'}</span></>}
          </div>
          <div className="credential-person">
            <span className="credential-name-label">{nameField?.label || 'Ausweisdaten'}</span>
            <h2>{nameField?.value || mainPage.title}</h2>
            {fields.length > 0 ? <dl className="credential-fields">{fields.map((field, index) => <div key={index}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
              : <p className="credential-fallback">{cardText(mainPage)}</p>}
          </div>
        </div>}
        <footer className="credential-footer">
          <span>{demo ? 'Beispieldaten · kein gültiger Nachweis' : 'Anzeige in Klarstunde'}</span>
          {mainPage.status && <span className="credential-status" data-validity={/^gültig$/i.test(mainPage.status) ? 'valid' : /^(?:ungültig|abgelaufen)$/i.test(mainPage.status) ? 'expired' : 'unknown'}><span>{demo ? 'Beispiel' : 'Status laut Portal'}</span><strong>{mainPage.status}</strong></span>}
        </footer>
      </article>

  return <div className="student-card-content">
    <div className="student-card-stage">
      <div className="student-card-toolbar">
        <div className="card-view-switch" role="group" aria-label="Ausweisansicht">
          <button aria-pressed={!reverse} onClick={() => setReverse(false)}>Vorderseite</button>
          {hasReverse && <button aria-pressed={reverse} onClick={() => setReverse(true)}><QrCode size={14} />Prüfcode</button>}
        </div>
        <button className="card-present-button" onClick={() => presentation.current?.showModal()}><Maximize2 size={16} />Großansicht</button>
      </div>
      {card}
      {hasReverse && <button className="card-turn-button" onClick={() => setReverse((value) => !value)}><RotateCcw size={15} />{reverse ? 'Vorderseite anzeigen' : 'Prüfcode anzeigen'}</button>}
    </div>
    <dialog ref={presentation} className="card-presentation" aria-label="Schülerausweis in Großansicht" onKeyDown={keepDialogFocus} onClick={(event) => { if (event.target === event.currentTarget) presentation.current?.close() }}>
      <div className="presentation-content"><div className="presentation-toolbar"><strong>Schülerausweis{demo ? " · Demo" : ""}</strong><button autoFocus aria-label="Großansicht schließen" onClick={() => presentation.current?.close()}><X /></button></div>
      {card}
      {hasReverse && <button className="card-turn-button" onClick={() => setReverse((value) => !value)}><RotateCcw size={15} />{reverse ? "Vorderseite anzeigen" : "Prüfcode anzeigen"}</button>}
      <p className="presentation-note">{demo ? "Beispieldaten · kein gültiger Nachweis" : "Darstellung aus dem Originalportal · Anerkennung durch die prüfende Stelle"}</p></div>
    </dialog>
    <div className="student-card-notes"><p><QrCode size={16} />Zeige deinen Prüfcode nur, wenn ein Nachweis benötigt wird.</p><a href="https://virtueller-stundenplan.org/page2/page-22/" target="_blank" rel="noreferrer">Ausweis im Originalportal<ArrowUpRight size={15} /></a></div>
    {(extraPages.length > 0 || unplacedImages.length > 0 || (!hasReverse && codePage)) && <details className="student-card-details">
      <summary>Weitere Angaben und Nachweise<ChevronDown size={16} /></summary>
      <div className="student-details-grid">{[...extraPages, ...(!hasReverse && codePage ? [codePage] : [])].map((page, index) => <section key={index}>
        <h3>{page.kind === 'school' ? 'Schulanschrift' : page.title}</h3>
        {page.fields?.length ? <><p>{page.schoolName}</p><dl>{page.fields.map((field, fieldIndex) => <div key={fieldIndex}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl></> : <p>{cardText(page)}</p>}
        {page.images.length > 0 && <div className="student-detail-images">{page.images.map((image, imageIndex) => <img src={image.source} alt={image.alt || 'Weitere Ausweisangabe'} key={imageIndex} />)}</div>}
      </section>)}
      {unplacedImages.length > 0 && <section><h3>Weitere Ausweisabbildungen</h3><div className="student-detail-images">{unplacedImages.map((image, index) => <img src={image.source} alt={image.alt || 'Ausweisabbildung'} key={index} />)}</div></section>}
      </div>
    </details>}
  </div>
}

export function StudentCardPage({ demo = false }: { demo?: boolean }) {
  const [pages, setPages] = useState<CardPage[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const pending = demo ? Promise.resolve({ pages: demoPages }) : getStudentCard()
    pending.then((value) => { if (active) setPages(value.pages) })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Der Ausweis konnte nicht geladen werden.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demo, reload])

  return <div className="content-area student-card-page">
    <div className="area-heading"><p className="eyebrow">Dein Schulkonto</p><h1>Schülerausweis<span className="heading-dot" aria-hidden="true">.</span></h1><p>Dein Ausweis und der zugehörige Prüfcode.</p></div>
    {loading && <div className="area-loading" role="status">Ausweis wird geladen …</div>}
    {error && <div className="state-card error-state" role="alert"><strong>Nicht verfügbar</strong><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>Erneut versuchen</button></div>}
    {!loading && !error && <StudentCardView pages={pages} demo={demo} />}
  </div>
}
