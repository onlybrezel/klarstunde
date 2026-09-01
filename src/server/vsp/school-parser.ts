import * as cheerio from 'cheerio'
import type { Notice, SchoolFilter, SchoolOption, SchoolTable, SharedFile, StudentCardPage } from '../../shared/school.js'

const whitespace = /\s+/g

function clean(value: string): string {
  return value.replace(whitespace, ' ').trim()
}

export function parseTables(html: string): SchoolTable[] {
  const $ = cheerio.load(html)
  return $('table').map((index, table) => {
    const columns = $(table).find('thead th').map((_, heading) => clean($(heading).text())).get()
    const fallbackColumns = columns.length > 0 ? columns : $(table).find('tr').first().find('th').map((_, heading) => clean($(heading).text())).get()
    const rows = $(table).find('tbody tr').length > 0 ? $(table).find('tbody tr') : $(table).find('tr').slice(fallbackColumns.length > 0 ? 1 : 0)
    const parsedRows = rows.map((_, row) => {
      const cells = $(row).find('th,td')
      return {
        values: cells.map((__, cell) => clean($(cell).text())).get(),
        links: cells.toArray().map((cell) => {
          const link = $(cell).find('a[href]').first()
          const href = link.attr('href')
          return href && /(?:^|\/)code-3\/(?:\?|$)/.test(href) ? { label: clean(link.text()), href } : null
        }),
      }
    }).get().filter((row) => row.values.some(Boolean))
    const titledParent = $(table).closest('[data-title], .card')
    const title = clean(titledParent.attr('data-title') ?? titledParent.find('h2,h3,h4').first().text()) || `Übersicht ${index + 1}`
    const links = parsedRows.map((row) => row.links)
    return {
      title,
      columns: fallbackColumns,
      rows: parsedRows.map((row) => row.values),
      ...(links.some((row) => row.some(Boolean)) ? { links } : {}),
    }
  }).get().filter((table) => table.columns.length > 0 || table.rows.length > 0)
}

export function parseNotices(html: string): Notice[] {
  const $ = cheerio.load(html)
  return $('.alert, article.message, .message-card').map((_, element) => {
    const title = clean($(element).find('h2,h3,h4,strong').first().text()) || 'Mitteilung'
    const body = clean($(element).text()).replace(title, '').trim()
    return { title, body }
  }).get().filter((notice) => notice.body && notice.body !== 'Daten aktuell')
}

export function parseOptions(html: string, selectName: string): SchoolOption[] {
  const $ = cheerio.load(html)
  return $(`select[name="${selectName}"] option`).map((_, option) => ({
    value: $(option).attr('value') ?? '',
    label: clean($(option).text()),
  })).get().filter((option) => option.value && !option.label.toLowerCase().includes('bitte auswählen'))
}

export function parseFilters(html: string): SchoolFilter[] {
  const $ = cheerio.load(html)
  return $('form select[name]').map((_, select) => ({
    name: $(select).attr('name') ?? '',
    options: $(select).find('option').map((__, option) => ({
      value: $(option).attr('value') ?? '',
      label: clean($(option).text()),
    })).get().filter((option) => option.label),
  })).get().filter((filter) => filter.name && filter.options.length > 1)
}

export function parseSharedFiles(html: string): SharedFile[] {
  const $ = cheerio.load(html)
  return $('#main-table tr').slice(1).map((_, row) => {
    const cells = $(row).find('td')
    const link = cells.eq(1).find('a').first()
    return {
      area: clean(cells.eq(0).text()),
      name: clean(link.text()) || clean(cells.eq(1).text()),
      description: clean(cells.eq(2).text()),
      downloadHref: link.attr('href') ?? '',
    }
  }).get().filter((file) => file.name && file.downloadHref)
}

export function parseStudentCard(html: string): StudentCardPage[] {
  const $ = cheerio.load(html)
  return $('section.page').map((index, section) => {
    const article = $(section).find('article').first()
    const textContent = article.clone()
    textContent.find('img,script,style,button').remove()
    textContent.find('h1,h2,h3,h4,p,div,span,dt,dd,li,br').append(' ')
    const text = clean(textContent.text())
    const heading = clean(article.find('h1,h2,h3,.eyebrow').first().text())
    const title = heading
      || (text.includes('BBS-ID') ? 'Schülerausweis'
        : text.includes('Zum Über') ? 'Prüfcode'
          : text.includes('GUID') ? 'Technischer Prüfcode'
            : text.includes('ZERTIFIKAT') ? 'Zertifikat'
              : `Ausweis ${index + 1}`)
    const images = article.find('img[src^="data:image/"]').map((_, image) => ({
      alt: $(image).attr('alt') ?? '',
      source: $(image).attr('src') ?? '',
    })).get()
    return { title, text, images }
  }).get()
}
