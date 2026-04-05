import Link from 'next/link'

const navItems = [
  'Dashboard',
  'Contacts',
  'Conversations',
  'Pipeline',
  'Calendar',
  'Settings',
]

const kpis = [
  { label: 'Open revenue', value: '$184,200', delta: '+12.4%' },
  { label: 'Qualified leads', value: '428', delta: '+8.1%' },
  { label: 'Reply SLA', value: '14m', delta: '-22%' },
  { label: 'Win rate', value: '31.8%', delta: '+4.3%' },
]

const pipeline = [
  { stage: 'Qualified', count: 18, value: '$42k' },
  { stage: 'Proposal', count: 11, value: '$58k' },
  { stage: 'Negotiation', count: 7, value: '$36k' },
  { stage: 'Closed won', count: 5, value: '$48k' },
]

const contacts = [
  ['Helena Foster', 'Enterprise', 'Active', 'Today'],
  ['Andre Costa', 'Telecom', 'Follow-up', '2h'],
  ['Lucia Marino', 'Energy', 'New', '5m'],
  ['Marco Dean', 'Connectivity', 'Qualified', 'Yesterday'],
]

export default function LinearPreviewPage() {
  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[280px] shrink-0 border-r border-slate-200/80 bg-[#f7f9fc] px-6 py-7 lg:flex lg:flex-col">
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Simfonia</p>
            <h1 className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950">Linear CRM</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Sharper enterprise direction with stronger hierarchy, denser dashboards and cleaner operational surfaces.
            </p>
          </div>

          <nav className="mt-8 space-y-1.5">
            {navItems.map((item, index) => (
              <div
                key={item}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  index === 0
                    ? 'bg-slate-950 text-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.7)]'
                    : 'text-slate-500 transition hover:bg-white hover:text-slate-950'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-cyan-300' : 'bg-slate-300'}`} />
                {item}
              </div>
            ))}
          </nav>

          <div className="mt-auto rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Preview note</p>
            <p className="mt-2 leading-relaxed">
              This is a design sandbox only. If the direction feels right, I’ll apply it across the real Simfonia pages.
            </p>
          </div>
        </aside>

        <main className="flex-1 px-5 py-5 sm:px-8 sm:py-7">
          <div className="rounded-[32px] border border-white/80 bg-white/80 p-5 shadow-[0_32px_90px_-46px_rgba(15,23,42,0.3)] backdrop-blur-xl sm:p-7">
            <div className="flex flex-col gap-5 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">Preview Route</p>
                <h2 className="mt-3 text-4xl font-black tracking-[-0.06em] text-slate-950 sm:text-5xl">
                  Sharper enterprise, linear-style
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                  Cleaner grid discipline, stronger contrast, denser information layout, restrained motion and a more executive-product feel.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Enterprise
                </span>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700">
                  Linear-style
                </span>
                <Link
                  href="/designs/simfonia/dashboard"
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Back to current Simfonia
                </Link>
              </div>
            </div>

            <div className="mt-7 grid gap-4 xl:grid-cols-[1.25fr,0.9fr]">
              <section className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Executive overview</p>
                    <h3 className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950">Revenue and operating health</h3>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Focus</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">Q2 pipeline</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {kpis.map((item) => (
                    <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                      <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950">{item.value}</p>
                      <p className="mt-2 text-xs font-semibold text-emerald-600">{item.delta}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-950">Pipeline progression</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Weighted value</p>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {pipeline.map((stage, index) => (
                      <div key={stage.stage} className="rounded-[20px] border border-slate-200 bg-[#fbfcfe] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{stage.stage}</p>
                          <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-white">{stage.count}</span>
                        </div>
                        <p className="mt-4 text-2xl font-black tracking-[-0.05em] text-slate-950">{stage.value}</p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-slate-950 via-slate-700 to-cyan-500"
                            style={{ width: `${28 + index * 16}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Inbox</p>
                  <h3 className="mt-3 text-2xl font-black tracking-[-0.05em]">Conversation triage</h3>
                  <div className="mt-5 space-y-3">
                    {['Escalated deal risk', 'Unread enterprise reply', 'Pricing review requested'].map((item, index) => (
                      <div key={item} className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{item}</p>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${index === 0 ? 'bg-red-500/20 text-red-200' : 'bg-cyan-500/20 text-cyan-200'}`}>
                            {index === 0 ? 'High' : 'Open'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-white/55">Cleaner hierarchy, stronger unread states and narrower action density.</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-950">Contacts table</p>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      Dense mode
                    </span>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-200">
                    <div className="grid grid-cols-[1.3fr,0.9fr,0.8fr,0.6fr] border-b border-slate-200 bg-[#f8fafc] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      <span>Name</span>
                      <span>Segment</span>
                      <span>Status</span>
                      <span>Last</span>
                    </div>
                    {contacts.map((row) => (
                      <div key={row[0]} className="grid grid-cols-[1.3fr,0.9fr,0.8fr,0.6fr] items-center px-4 py-3 text-sm text-slate-700 odd:bg-white even:bg-[#fbfcfe]">
                        <span className="font-semibold text-slate-950">{row[0]}</span>
                        <span>{row[1]}</span>
                        <span>{row[2]}</span>
                        <span>{row[3]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
