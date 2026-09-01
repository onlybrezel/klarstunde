import { useEffect, useState } from 'react'
import { IdCard, QrCode, ShieldCheck } from 'lucide-react'
import type { StudentCardPage as CardPage } from '../../shared/school'
import { getStudentCard } from '../api'

function cardText(page: CardPage): string {
  const title = page.title.trim()
  const text = page.text.trim()
  return text.toLocaleLowerCase('de-DE').startsWith(title.toLocaleLowerCase('de-DE'))
    ? text.slice(title.length).trim()
    : text
}

function primaryPageIndex(pages: CardPage[]): number {
  const index = pages.findIndex((page) => /schülerausweis|bbs-id/i.test(`${page.title} ${page.text}`))
  return index >= 0 ? index : 0
}

export function StudentCardPage() {
  const [pages, setPages] = useState<CardPage[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStudentCard()
      .then((value) => setPages(value.pages))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Der Ausweis konnte nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [])

  const mainIndex = primaryPageIndex(pages)
  const mainPage = pages[mainIndex]
  const verificationPages = pages.filter((_, index) => index !== mainIndex)

  return <div className="content-area">
    <div className="area-heading"><p className="eyebrow">Digital</p><h1>Schülerausweis</h1><p>Ausweisdaten und Prüfcodes aus deinem Schulkonto.</p></div>
    <aside className="area-note"><strong>Beim Vorzeigen</strong><p>Prüfcodes enthalten persönliche Daten. Zeige sie nur, wenn ein Nachweis benötigt wird.</p></aside>

    {loading && <div className="area-loading">Ausweis wird geladen …</div>}
    {error && <div className="state-card error-state"><strong>Nicht verfügbar</strong><p>{error}</p></div>}
    {!loading && !error && !mainPage && <div className="empty-area"><strong>Kein Ausweis hinterlegt</strong><p>Für dieses Konto wurde kein digitaler Schülerausweis freigegeben.</p></div>}

    {!loading && !error && mainPage && <div className="student-pass-layout">
      <section className="student-pass" aria-labelledby="student-pass-title">
        <header className="student-pass-header">
          <span className="student-pass-icon"><IdCard size={20} /></span>
          <span>Digitaler Schülerausweis</span>
          <small>Daten aus deinem Schulkonto</small>
        </header>
        <div className="student-pass-body">
          <div className="student-pass-copy">
            <p className="student-pass-kicker">Schülernachweis</p>
            <h2 id="student-pass-title">{mainPage.title}</h2>
            <p>{cardText(mainPage)}</p>
          </div>
          {mainPage.images.length > 0 && <div className="student-pass-images">{mainPage.images.map((image, imageIndex) => <img src={image.source} alt={image.alt || 'Ausweisabbildung'} key={imageIndex} />)}</div>}
        </div>
        <footer className="student-pass-footer"><span><ShieldCheck size={17} />Digital bereitgestellt</span><span className="student-pass-mark">K</span></footer>
      </section>

      {verificationPages.length > 0 && <section className="verification-panel">
        <div className="verification-heading"><span><QrCode size={20} /></span><div><h2>Prüfnachweise</h2><p>Weitere Angaben zum Ausweis</p></div></div>
        <div className="verification-list">{verificationPages.map((page, index) => <article key={`${page.title}-${index}`}>
          <div className="verification-copy"><strong>{page.title}</strong><p>{cardText(page)}</p></div>
          {page.images.length > 0 && <div className="verification-images">{page.images.map((image, imageIndex) => <img src={image.source} alt={image.alt || 'Prüfcode'} key={imageIndex} />)}</div>}
        </article>)}</div>
      </section>}
    </div>}
  </div>
}
