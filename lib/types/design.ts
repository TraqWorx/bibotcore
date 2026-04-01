export interface DesignTheme {
  primaryColor: string
  secondaryColor: string
  companyName: string
  logoText: string
  logoUrl?: string
}

export interface TagCategory {
  label: string
  tag: string
  color: string
}

export interface DesignModules {
  dashboard?:      { enabled: boolean; config?: { tagCategories?: TagCategory[] } }
  contacts?:       { enabled: boolean }
  conversations?:  { enabled: boolean }
  pipeline?:       { enabled: boolean }
  calendar?:       { enabled: boolean }
  ai?:             { enabled: boolean }
  automations?:    { enabled: boolean }
  portal?:         { enabled: boolean }
  settings?:       { enabled: boolean }
}

export const DEFAULT_THEME: DesignTheme = {
  primaryColor: '#2A00CC',
  secondaryColor: '#00F0FF',
  companyName: 'Bibot Core',
  logoText: 'Bi',
}

export const DEFAULT_MODULES: DesignModules = {
  dashboard:      { enabled: true },
  contacts:       { enabled: true },
  conversations:  { enabled: true },
  pipeline:       { enabled: true },
  calendar:       { enabled: true },
  ai:             { enabled: true },
  automations:    { enabled: true },
  settings:       { enabled: true },
}

export const DEFAULT_TAG_CATEGORIES: TagCategory[] = [
  { label: 'Telefonia',       tag: 'telefonia',       color: 'blue'   },
  { label: 'Energia',         tag: 'energia',         color: 'amber'  },
  { label: 'Connettività',    tag: 'connettivita',    color: 'green'  },
  { label: 'Intrattenimento', tag: 'intrattenimento', color: 'purple' },
]
