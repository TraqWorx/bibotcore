import type { DesignTheme } from '@/lib/types/design'

export const demoTheme: DesignTheme = {
  primaryColor: '#151411',
  secondaryColor: '#8BC53F',
  companyName: 'Apulia Power',
  logoText: 'Si',
  logoUrl: '/brands/simfonia-logo.png',
}

export const demoDashboardData = {
  totalContacts: 128,
  targetAnnuale: 1900,
  switchOutTotal: 9,
  isAdmin: true,
  closedDays: [],
  gareRows: [
    { categoria: 'telefonia', obiettivo: 640, tag: 'telefonia' },
    { categoria: 'energia', obiettivo: 520, tag: 'energia' },
    { categoria: 'connettivita', obiettivo: 410, tag: 'connettivita' },
    { categoria: 'intrattenimento', obiettivo: 330, tag: 'intrattenimento' },
  ],
  categoryData: [
    {
      slug: 'telefonia',
      label: 'Telefonia',
      total: 46,
      switchOutCount: 3,
      providers: [
        { provider: 'TIM Business', count: 18 },
        { provider: 'Vodafone', count: 14 },
        { provider: 'WindTre', count: 9 },
      ],
    },
    {
      slug: 'energia',
      label: 'Energia',
      total: 31,
      switchOutCount: 2,
      providers: [
        { provider: 'Enel', count: 12 },
        { provider: 'A2A', count: 10 },
        { provider: 'Edison', count: 6 },
      ],
    },
    {
      slug: 'connettivita',
      label: 'Connettivita',
      total: 29,
      switchOutCount: 1,
      providers: [
        { provider: 'FiberCop', count: 11 },
        { provider: 'Open Fiber', count: 9 },
        { provider: 'Fastweb', count: 6 },
      ],
    },
    {
      slug: 'intrattenimento',
      label: 'Intrattenimento',
      total: 22,
      switchOutCount: 0,
      providers: [
        { provider: 'Sky', count: 9 },
        { provider: 'DAZN', count: 7 },
        { provider: 'Netflix', count: 4 },
      ],
    },
  ],
  contactsTrend: [
    { date: '2026-04-01', count: 2 },
    { date: '2026-04-02', count: 3 },
    { date: '2026-04-03', count: 4 },
    { date: '2026-04-04', count: 3 },
    { date: '2026-04-05', count: 5 },
    { date: '2026-04-06', count: 4 },
    { date: '2026-04-07', count: 6 },
    { date: '2026-04-08', count: 5 },
    { date: '2026-04-09', count: 4 },
    { date: '2026-04-10', count: 7 },
    { date: '2026-04-11', count: 6 },
    { date: '2026-04-12', count: 5 },
    { date: '2026-04-13', count: 8 },
    { date: '2026-04-14', count: 7 },
    { date: '2026-04-15', count: 6 },
    { date: '2026-04-16', count: 9 },
    { date: '2026-04-17', count: 8 },
    { date: '2026-04-18', count: 7 },
    { date: '2026-04-19', count: 10 },
    { date: '2026-04-20', count: 9 },
    { date: '2026-04-21', count: 8 },
    { date: '2026-04-22', count: 11 },
    { date: '2026-04-23', count: 10 },
    { date: '2026-04-24', count: 9 },
    { date: '2026-04-25', count: 12 },
    { date: '2026-04-26', count: 11 },
    { date: '2026-04-27', count: 10 },
    { date: '2026-04-28', count: 13 },
    { date: '2026-04-29', count: 12 },
    { date: '2026-04-30', count: 10 },
  ],
  appointmentPreview: [
    {
      id: 'appt-1',
      title: 'Lead review',
      startTime: '2026-04-05T08:30:00+02:00',
      status: 'confirmed',
      contactName: 'Chiara Rossi',
    },
    {
      id: 'appt-2',
      title: 'Client strategy call',
      startTime: '2026-04-05T10:00:00+02:00',
      status: 'confirmed',
      contactName: 'Luca Marino',
    },
    {
      id: 'appt-3',
      title: 'Nuovo onboarding',
      startTime: '2026-04-05T12:30:00+02:00',
      status: 'confirmed',
      contactName: 'Sara Vitale',
    },
    {
      id: 'appt-4',
      title: 'Renewal follow-up',
      startTime: '2026-04-05T15:00:00+02:00',
      status: 'confirmed',
      contactName: 'Marco De Luca',
    },
  ],
}

export const demoContacts = [
  {
    id: 'c-1',
    contactName: 'Chiara Rossi',
    phone: '+39 347 102 4441',
    email: 'chiara.rossi@apuliademo.it',
    companyName: 'Apulia Energia',
    dateAdded: '2026-04-03T10:00:00+02:00',
    lastActivity: '2026-04-05T09:15:00+02:00',
    tags: ['fibra', 'telefonia'],
    customFields: [{ id: 'cf-categoria', value: 'Telefonia' }],
  },
  {
    id: 'c-2',
    contactName: 'Luca Marino',
    phone: '+39 348 812 0091',
    email: 'luca.marino@apuliademo.it',
    companyName: 'Marino Office',
    dateAdded: '2026-04-02T11:30:00+02:00',
    lastActivity: '2026-04-05T08:00:00+02:00',
    tags: ['energia'],
    customFields: [{ id: 'cf-categoria', value: 'Energia' }],
  },
  {
    id: 'c-3',
    contactName: 'Elena Costa',
    phone: '+39 345 882 1134',
    email: 'elena.costa@apuliademo.it',
    companyName: 'Costa Retail',
    dateAdded: '2026-04-01T14:00:00+02:00',
    lastActivity: '2026-04-04T16:20:00+02:00',
    tags: ['connettivita'],
    customFields: [{ id: 'cf-categoria', value: 'Connettivita' }],
  },
  {
    id: 'c-4',
    contactName: 'Davide Leone',
    phone: '+39 333 210 7788',
    email: 'davide.leone@apuliademo.it',
    companyName: 'Leone Media',
    dateAdded: '2026-03-30T09:45:00+02:00',
    lastActivity: '2026-04-03T18:10:00+02:00',
    tags: ['tv'],
    customFields: [{ id: 'cf-categoria', value: 'Intrattenimento' }],
  },
]

export const demoContactColumns = [
  { key: 'contactName', label: 'Contact Name', type: 'standard' as const },
  { key: 'phone', label: 'Phone', type: 'standard' as const },
  { key: 'email', label: 'Email', type: 'standard' as const },
  { key: 'companyName', label: 'Business Name', type: 'standard' as const },
  { key: 'dateAdded', label: 'Created', type: 'standard' as const },
  { key: 'tags', label: 'Tags', type: 'standard' as const },
]

export const demoContactCustomFields = [
  {
    id: 'cf-categoria',
    name: 'Categoria',
    fieldKey: 'categoria',
    dataType: 'SINGLE_OPTIONS',
    picklistOptions: ['Telefonia', 'Energia', 'Connettivita', 'Intrattenimento'],
  },
]

export const demoCategories = [
  { slug: 'telefonia', label: 'Telefonia' },
  { slug: 'energia', label: 'Energia' },
  { slug: 'connettivita', label: 'Connettivita' },
  { slug: 'intrattenimento', label: 'Intrattenimento' },
]

export const demoConversations = [
  {
    id: 'conv-1',
    contactId: 'c-1',
    contactName: 'Chiara Rossi',
    type: 'TYPE_WHATSAPP',
    lastMessageBody: 'Perfetto, fissiamo per lunedi.',
    lastMessageDate: '2026-04-05T09:14:00+02:00',
    lastMessageDirection: 'inbound',
    unreadCount: 2,
    assignedTo: 'u-1',
  },
  {
    id: 'conv-2',
    contactId: 'c-2',
    contactName: 'Luca Marino',
    type: 'TYPE_EMAIL',
    lastMessageBody: 'Ho ricevuto la proposta, grazie.',
    lastMessageDate: '2026-04-05T08:31:00+02:00',
    lastMessageDirection: 'inbound',
    unreadCount: 0,
    assignedTo: 'u-2',
  },
  {
    id: 'conv-3',
    contactId: 'c-3',
    contactName: 'Elena Costa',
    type: 'TYPE_SMS',
    lastMessageBody: 'Potete richiamarmi dopo le 15?',
    lastMessageDate: '2026-04-04T16:10:00+02:00',
    lastMessageDirection: 'inbound',
    unreadCount: 1,
    assignedTo: 'u-3',
  },
]

export const demoPipeline = [
  {
    stage: 'Nuovo lead',
    total: 12,
    value: '€24.000',
    deals: [
      { title: 'Fornitura business Bari', amount: '€3.200', contact: 'Chiara Rossi' },
      { title: 'Migrazione rete ufficio', amount: '€1.850', contact: 'Luca Marino' },
    ],
  },
  {
    stage: 'Qualificato',
    total: 8,
    value: '€41.000',
    deals: [
      { title: 'Pacchetto energia retail', amount: '€5.600', contact: 'Elena Costa' },
      { title: 'Switch multi-sede', amount: '€4.300', contact: 'Davide Leone' },
    ],
  },
  {
    stage: 'Proposta',
    total: 5,
    value: '€28.000',
    deals: [
      { title: 'Connettivita premium', amount: '€6.900', contact: 'Sara Vitale' },
    ],
  },
]

export const demoCalendarDays = [
  { day: 'Lun 6', title: 'Lead review', time: '08:30' },
  { day: 'Mar 7', title: 'Client strategy call', time: '10:00' },
  { day: 'Gio 9', title: 'Onboarding cliente', time: '12:30' },
  { day: 'Ven 10', title: 'Renewal follow-up', time: '15:00' },
]

export const demoAutomations = [
  { name: 'Nuovo lead > task sales', status: 'Attiva', note: 'Crea task e notifica team in meno di 10s' },
  { name: 'Contatto qualificato > proposta', status: 'Attiva', note: 'Genera checklist e aggiorna pipeline' },
  { name: 'Mancata risposta > follow-up', status: 'Bozza', note: 'Invia reminder dopo 48h' },
]

export const demoSettings = [
  { label: 'Colore primario', value: '#151411' },
  { label: 'Colore secondario', value: '#8BC53F' },
  { label: 'Logo', value: '/brands/simfonia-logo.png' },
]

export const demoConversationUsers = [
  { id: 'u-1', name: 'Giulia Ferri', email: 'giulia@apuliapower.demo' },
  { id: 'u-2', name: 'Marco Santoro', email: 'marco@apuliapower.demo' },
  { id: 'u-3', name: 'Sara Vitale', email: 'sara@apuliapower.demo' },
]

export const demoCurrentUserEmail = 'giulia@apuliapower.demo'

export const demoConversationMessages: Record<string, {
  id: string
  body: string
  direction: string
  type?: string | number
  dateAdded: string
  status?: string
}[]> = {
  'conv-1': [
    { id: 'm-1', body: 'Buongiorno, possiamo sentirci oggi?', direction: 'inbound', dateAdded: '2026-04-05T08:42:00+02:00', type: 'TYPE_WHATSAPP' },
    { id: 'm-2', body: 'Certo, alle 10:00 va bene.', direction: 'outbound', dateAdded: '2026-04-05T08:47:00+02:00', type: 'TYPE_WHATSAPP', status: 'delivered' },
    { id: 'm-3', body: 'Perfetto, grazie.', direction: 'inbound', dateAdded: '2026-04-05T08:48:00+02:00', type: 'TYPE_WHATSAPP' },
  ],
  'conv-2': [
    { id: 'm-4', body: 'Ti ho inviato la proposta aggiornata.', direction: 'outbound', dateAdded: '2026-04-05T07:55:00+02:00', type: 'TYPE_EMAIL', status: 'sent' },
    { id: 'm-5', body: 'Ricevuta, la controllo in mattinata.', direction: 'inbound', dateAdded: '2026-04-05T08:31:00+02:00', type: 'TYPE_EMAIL' },
  ],
  'conv-3': [
    { id: 'm-6', body: 'Potete richiamarmi dopo le 15?', direction: 'inbound', dateAdded: '2026-04-04T16:10:00+02:00', type: 'TYPE_SMS' },
  ],
}

export const demoContactNotesByContact: Record<string, {
  id: string
  body: string
  dateAdded: string
  createdBy?: string
}[]> = {
  'c-1': [
    {
      id: 'n-1',
      body: 'Cliente interessata alla migrazione completa entro fine mese.',
      dateAdded: '2026-04-05T09:05:00+02:00',
      createdBy: 'u-1',
    },
  ],
  'c-2': [
    {
      id: 'n-2',
      body: 'Ha chiesto confronto tra piano attuale e proposta Bibot.',
      dateAdded: '2026-04-05T08:40:00+02:00',
      createdBy: 'u-2',
    },
  ],
}

export const demoPipelines = [
  {
    id: 'pipe-1',
    name: 'Commerciale B2B',
    stages: [
      { id: 'stage-1', name: 'Nuovo lead' },
      { id: 'stage-2', name: 'Qualificato' },
      { id: 'stage-3', name: 'Proposta inviata' },
      { id: 'stage-4', name: 'Chiusura' },
    ],
  },
]

export const demoOpportunities = [
  {
    id: 'opp-1',
    name: 'Migrazione rete ufficio',
    pipelineId: 'pipe-1',
    pipelineStageId: 'stage-1',
    monetaryValue: 3200,
    status: 'open',
    assignedTo: 'Giulia Ferri',
    contact: {
      name: 'Chiara Rossi',
      email: 'chiara.rossi@apuliademo.it',
      company: 'Apulia Energia',
      tags: ['fibra', 'telefonia'],
    },
  },
  {
    id: 'opp-2',
    name: 'Switch energia multisede',
    pipelineId: 'pipe-1',
    pipelineStageId: 'stage-2',
    monetaryValue: 5600,
    status: 'open',
    assignedTo: 'Marco Santoro',
    contact: {
      name: 'Luca Marino',
      email: 'luca.marino@apuliademo.it',
      company: 'Marino Office',
      tags: ['energia'],
    },
  },
  {
    id: 'opp-3',
    name: 'Connettività premium retail',
    pipelineId: 'pipe-1',
    pipelineStageId: 'stage-3',
    monetaryValue: 6900,
    status: 'open',
    assignedTo: 'Sara Vitale',
    contact: {
      name: 'Elena Costa',
      email: 'elena.costa@apuliademo.it',
      company: 'Costa Retail',
      tags: ['connettivita'],
    },
  },
  {
    id: 'opp-4',
    name: 'Rinnovo centralino',
    pipelineId: 'pipe-1',
    pipelineStageId: 'stage-4',
    monetaryValue: 4100,
    status: 'open',
    assignedTo: 'Giulia Ferri',
    contact: {
      name: 'Davide Leone',
      email: 'davide.leone@apuliademo.it',
      company: 'Leone Media',
      tags: ['telefonia'],
    },
  },
]

export const demoCalendarUsers = [
  { id: 'u-1', name: 'Giulia Ferri' },
  { id: 'u-2', name: 'Marco Santoro' },
  { id: 'u-3', name: 'Sara Vitale' },
]

export const demoCalendarEvents = [
  {
    id: 'evt-1',
    title: 'Lead review',
    startTime: '2026-04-06T08:30:00+02:00',
    endTime: '2026-04-06T09:00:00+02:00',
    appointmentStatus: 'confirmed',
    assignedUserId: 'u-1',
    contactName: 'Chiara Rossi',
    contactEmail: 'chiara.rossi@apuliademo.it',
    contactPhone: '+39 347 102 4441',
  },
  {
    id: 'evt-2',
    title: 'Client strategy call',
    startTime: '2026-04-07T10:00:00+02:00',
    endTime: '2026-04-07T11:00:00+02:00',
    appointmentStatus: 'confirmed',
    assignedUserId: 'u-2',
    contactName: 'Luca Marino',
    contactEmail: 'luca.marino@apuliademo.it',
    contactPhone: '+39 348 812 0091',
  },
  {
    id: 'evt-3',
    title: 'Nuovo onboarding',
    startTime: '2026-04-09T12:00:00+02:00',
    endTime: '2026-04-09T13:00:00+02:00',
    appointmentStatus: 'new',
    assignedUserId: 'u-3',
    contactName: 'Elena Costa',
    contactEmail: 'elena.costa@apuliademo.it',
    contactPhone: '+39 345 882 1134',
  },
  {
    id: 'evt-4',
    title: 'Renewal follow-up',
    startTime: '2026-04-10T15:00:00+02:00',
    endTime: '2026-04-10T15:30:00+02:00',
    appointmentStatus: 'confirmed',
    assignedUserId: 'u-1',
    contactName: 'Davide Leone',
    contactEmail: 'davide.leone@apuliademo.it',
    contactPhone: '+39 333 210 7788',
  },
]

export const demoWorkflows = [
  { id: 'wf-1', name: 'Nuovo lead > task sales', status: 'active', version: 4 },
  { id: 'wf-2', name: 'Contatto qualificato > proposta', status: 'active', version: 2 },
  { id: 'wf-3', name: 'Mancata risposta > follow-up', status: 'draft', version: 1 },
]

// ─── Apulia Tourism Demo Data ─────────────────────────────────────────────

export const apuliaTourismDemoTheme: DesignTheme = {
  primaryColor: '#0f2b46',
  secondaryColor: '#e6853e',
  companyName: 'Apulia Tourism',
  logoText: 'AT',
  logoUrl: '',
}

export const apuliaTourismDemoDashboard = {
  totalContacts: 84,
  targetAnnuale: 500,
  switchOutTotal: 3,
  isAdmin: true,
  closedDays: [],
  gareRows: [
    { categoria: 'hotel', obiettivo: 200, tag: 'hotel' },
    { categoria: 'tour-operator', obiettivo: 150, tag: 'tour-operator' },
    { categoria: 'restaurant', obiettivo: 100, tag: 'restaurant' },
    { categoria: 'b&b', obiettivo: 50, tag: 'b&b' },
  ],
  categoryData: [
    {
      slug: 'hotel',
      label: 'Hotel',
      total: 32,
      switchOutCount: 1,
      providers: [
        { provider: 'Booking.com', count: 14 },
        { provider: 'Expedia', count: 10 },
        { provider: 'Direct', count: 8 },
      ],
    },
    {
      slug: 'tour-operator',
      label: 'Tour Operator',
      total: 24,
      switchOutCount: 1,
      providers: [
        { provider: 'Viator', count: 10 },
        { provider: 'GetYourGuide', count: 8 },
        { provider: 'Local', count: 6 },
      ],
    },
    {
      slug: 'restaurant',
      label: 'Restaurant',
      total: 18,
      switchOutCount: 1,
      providers: [
        { provider: 'TheFork', count: 9 },
        { provider: 'TripAdvisor', count: 6 },
        { provider: 'Google', count: 3 },
      ],
    },
    {
      slug: 'b&b',
      label: 'B&B',
      total: 10,
      switchOutCount: 0,
      providers: [
        { provider: 'Airbnb', count: 5 },
        { provider: 'Booking.com', count: 3 },
        { provider: 'Direct', count: 2 },
      ],
    },
  ],
  contactsTrend: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, '0')}`,
    count: Math.floor(Math.random() * 5) + 1,
  })),
  appointmentPreview: [
    { id: 'at-1', title: 'Hotel onboarding', startTime: '2026-04-24T09:00:00+02:00', status: 'confirmed', contactName: 'Maria Bianchi' },
    { id: 'at-2', title: 'Tour package review', startTime: '2026-04-24T11:00:00+02:00', status: 'confirmed', contactName: 'Giuseppe Ferro' },
    { id: 'at-3', title: 'Partnership meeting', startTime: '2026-04-24T14:30:00+02:00', status: 'new', contactName: 'Francesca Moretti' },
  ],
}

export const apuliaTourismDemoConversations = [
  {
    id: 'at-conv-1',
    contactId: 'dc-1',
    contactName: 'Maria Bianchi',
    type: 'TYPE_WHATSAPP',
    lastMessageBody: 'Perfetto, ci vediamo domani alle 9.',
    lastMessageDate: '2026-04-23T14:20:00+02:00',
    lastMessageDirection: 'inbound',
    unreadCount: 1,
    assignedTo: 'at-u-1',
  },
  {
    id: 'at-conv-2',
    contactId: 'dc-2',
    contactName: 'Giuseppe Ferro',
    type: 'TYPE_SMS',
    lastMessageBody: 'Ho ricevuto il listino, grazie.',
    lastMessageDate: '2026-04-23T11:05:00+02:00',
    lastMessageDirection: 'inbound',
    unreadCount: 0,
    assignedTo: 'at-u-1',
  },
  {
    id: 'at-conv-3',
    contactId: 'dc-3',
    contactName: 'Anna Russo',
    type: 'TYPE_EMAIL',
    lastMessageBody: 'Quando possiamo fissare una call?',
    lastMessageDate: '2026-04-22T16:40:00+02:00',
    lastMessageDirection: 'inbound',
    unreadCount: 1,
    assignedTo: 'at-u-2',
  },
]

export const apuliaTourismDemoConversationUsers = [
  { id: 'at-u-1', name: 'Daniela Pugliese', email: 'daniela@apuliatourism.demo' },
  { id: 'at-u-2', name: 'Antonio Ferrara', email: 'antonio@apuliatourism.demo' },
]

export const apuliaTourismDemoCurrentUserEmail = 'daniela@apuliatourism.demo'

export const apuliaTourismDemoConversationMessages: Record<string, {
  id: string
  body: string
  direction: string
  type?: string | number
  dateAdded: string
  status?: string
}[]> = {
  'at-conv-1': [
    { id: 'at-m-1', body: 'Buongiorno, vorremmo inserire il vostro hotel nel nostro circuito turistico.', direction: 'outbound', dateAdded: '2026-04-23T10:00:00+02:00', type: 'TYPE_WHATSAPP', status: 'delivered' },
    { id: 'at-m-2', body: 'Ottimo, mi interessa molto! Possiamo vederci?', direction: 'inbound', dateAdded: '2026-04-23T10:15:00+02:00', type: 'TYPE_WHATSAPP' },
    { id: 'at-m-3', body: 'Certo, domani alle 9 va bene?', direction: 'outbound', dateAdded: '2026-04-23T14:10:00+02:00', type: 'TYPE_WHATSAPP', status: 'delivered' },
    { id: 'at-m-4', body: 'Perfetto, ci vediamo domani alle 9.', direction: 'inbound', dateAdded: '2026-04-23T14:20:00+02:00', type: 'TYPE_WHATSAPP' },
  ],
  'at-conv-2': [
    { id: 'at-m-5', body: 'Ti invio il listino aggiornato per la stagione estiva.', direction: 'outbound', dateAdded: '2026-04-23T10:30:00+02:00', type: 'TYPE_SMS', status: 'sent' },
    { id: 'at-m-6', body: 'Ho ricevuto il listino, grazie.', direction: 'inbound', dateAdded: '2026-04-23T11:05:00+02:00', type: 'TYPE_SMS' },
  ],
  'at-conv-3': [
    { id: 'at-m-7', body: 'Quando possiamo fissare una call?', direction: 'inbound', dateAdded: '2026-04-22T16:40:00+02:00', type: 'TYPE_EMAIL' },
  ],
}

export const apuliaTourismDemoContactNotes: Record<string, {
  id: string
  body: string
  dateAdded: string
  createdBy?: string
}[]> = {
  'dc-1': [
    { id: 'at-n-1', body: 'Hotel 4 stelle, 45 camere. Interessata a pacchetti turistici per la stagione estiva.', dateAdded: '2026-04-23T10:05:00+02:00', createdBy: 'at-u-1' },
  ],
}
