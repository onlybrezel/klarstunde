export interface SchoolTable {
  title: string
  columns: string[]
  rows: string[][]
  links?: Array<Array<SchoolTableLink | null>>
}

export interface SchoolTableLink {
  label: string
  href: string
}

export interface SchoolOption {
  value: string
  label: string
}

export interface Notice {
  title: string
  body: string
}

export interface SchoolFilter {
  name: string
  options: SchoolOption[]
}

export interface SharedFile {
  area: string
  name: string
  description: string
  downloadHref: string
}

export interface StudentCardPage {
  title: string
  text: string
  images: Array<{ alt: string; source: string }>
}

export interface SchoolAreaResponse {
  tables: SchoolTable[]
  notices: Notice[]
  filters: SchoolFilter[]
}
