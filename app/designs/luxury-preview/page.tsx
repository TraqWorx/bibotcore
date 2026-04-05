import Link from 'next/link'

const palette = {
  paper: '#f7f3ec',
  shell: '#fffdf9',
  line: '#e8dfd4',
  text: '#211b16',
  muted: '#7e7368',
  blush: '#f4d8d7',
  sky: '#d9e9f7',
  butter: '#f5e8bf',
  sage: '#dfe8d7',
  lilac: '#e7def7',
  coral: '#edb9a8',
}

const metrics = [
  { label: 'Booked this week', value: '28', tone: palette.sky },
  { label: 'Show-up rate', value: '92%', tone: palette.sage },
  { label: 'Active nurture', value: '146', tone: palette.blush },
]

const appointments = [
  { time: '08:30', title: 'Pilates intro', detail: 'Giulia Moretti', tone: palette.sky },
  { time: '10:00', title: 'Skin consult', detail: 'Sofia Romano', tone: palette.blush },
  { time: '12:30', title: 'VIP strategy call', detail: 'Martina Esposito', tone: palette.butter },
  { time: '15:00', title: 'Membership renewal', detail: 'Chiara Serra', tone: palette.sage },
]

const tasks = [
  { title: 'Follow up after treatment', note: '6 clients due today', tone: palette.blush },
  { title: 'Confirm tomorrow bookings', note: '3 pending confirmations', tone: palette.sky },
  { title: 'Review concierge requests', note: '2 high-touch clients', tone: palette.lilac },
]

const days = [
  ['', '', '', '', 1, 2],
  [3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29, 30],
]

const calendarEvents = {
  12: { title: 'Skin consult', time: '10:00', tone: palette.blush },
  19: { title: 'VIP strategy', time: '12:30', tone: palette.butter },
  23: { title: 'Renewal call', time: '15:00', tone: palette.sage },
  27: { title: 'Pilates intro', time: '08:30', tone: palette.sky },
}

export default function LuxuryPreviewPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.paper, color: palette.text }}>
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside
          className="hidden w-[286px] shrink-0 border-r px-7 py-8 lg:flex lg:flex-col"
          style={{ borderColor: palette.line }}
        >
          <div>
            <div
              className="rounded-[30px] border px-6 py-6"
              style={{ backgroundColor: palette.shell, borderColor: palette.line }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.28em]" style={{ color: palette.muted }}>
                Simfonia Preview
              </p>
              <h1 className="mt-3 text-[2rem] font-black tracking-[-0.06em]">Pastel CRM</h1>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: palette.muted }}>
                Cleaner luxury with soft color, lighter structure, and a calmer client-service dashboard feel.
              </p>
            </div>

            <nav className="mt-8 space-y-2">
              {[
                ['Dashboard', palette.blush],
                ['Clients', palette.sky],
                ['Inbox', palette.sage],
                ['Pipeline', palette.lilac],
                ['Calendar', palette.butter],
                ['Settings', '#f1ece3'],
              ].map(([item, tone], index) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-[20px] border px-4 py-3 text-sm font-semibold"
                  style={{
                    backgroundColor: index === 0 ? palette.shell : 'transparent',
                    borderColor: index === 0 ? palette.line : 'transparent',
                  }}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tone as string }} />
                  <span style={{ color: index === 0 ? palette.text : palette.muted }}>{item}</span>
                </div>
              ))}
            </nav>
          </div>

          <div
            className="mt-auto rounded-[28px] border px-5 py-5"
            style={{ backgroundColor: palette.shell, borderColor: palette.line }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: palette.muted }}>
              Design note
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: palette.muted }}>
              No gradients, softer contrast, and more lifestyle-inspired CRM composition for the dashboard.
            </p>
          </div>
        </aside>

        <main className="flex-1 px-5 py-5 sm:px-8 sm:py-8">
          <div
            className="rounded-[36px] border px-6 py-6 sm:px-8 sm:py-8"
            style={{ backgroundColor: palette.shell, borderColor: palette.line }}
          >
            <div
              className="flex flex-col gap-5 border-b pb-7 sm:flex-row sm:items-end sm:justify-between"
              style={{ borderColor: palette.line }}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.26em]" style={{ color: palette.muted }}>
                  Preview Route
                </p>
                <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-[-0.07em] sm:text-5xl">
                  Clean pastel CRM with a softer luxury voice
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-relaxed sm:text-[15px]" style={{ color: palette.muted }}>
                  Real color, gentle contrast, more breathing room, and a dashboard that brings the day&apos;s schedule
                  into the center of the experience.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ borderColor: palette.line, backgroundColor: '#fcf8f2', color: palette.muted }}
                >
                  Pastel
                </span>
                <span
                  className="rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ borderColor: palette.line, backgroundColor: palette.blush, color: '#8a5d59' }}
                >
                  No gradients
                </span>
                <Link
                  href="/designs/linear-preview"
                  className="inline-flex items-center justify-center rounded-[18px] px-5 py-3 text-sm font-bold"
                  style={{ backgroundColor: palette.text, color: '#fff' }}
                >
                  Compare with linear preview
                </Link>
              </div>
            </div>

            <div className="mt-7 grid gap-4 xl:grid-cols-[1.28fr,0.84fr]">
              <section className="space-y-4">
                <div
                  className="rounded-[30px] border px-6 py-6"
                  style={{ backgroundColor: '#fcf9f4', borderColor: palette.line }}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: palette.muted }}>
                        Daily overview
                      </p>
                      <h3 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.06em]">
                        A softer dashboard built around the calendar.
                      </h3>
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: palette.muted }}>
                        Less dense admin software, more of a polished appointment studio. The schedule becomes the
                        centerpiece and everything else supports the day.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {metrics.map((item) => (
                        <div
                          key={item.label}
                          className="min-w-[140px] rounded-[24px] border px-4 py-4"
                          style={{ backgroundColor: palette.shell, borderColor: palette.line }}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: palette.muted }}>
                            {item.label}
                          </p>
                          <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{item.value}</p>
                          <div className="mt-4 h-2 rounded-full" style={{ backgroundColor: '#f0e8dc' }}>
                            <div className="h-full rounded-full" style={{ width: '68%', backgroundColor: item.tone }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[1.28fr,0.72fr]">
                    <div
                      className="rounded-[28px] border overflow-hidden"
                      style={{ backgroundColor: palette.shell, borderColor: palette.line }}
                    >
                      <div
                        className="grid grid-cols-[1.2fr,repeat(7,minmax(0,1fr))] border-b px-4 py-4 text-[11px] font-bold uppercase tracking-[0.18em]"
                        style={{ borderColor: palette.line, color: palette.muted }}
                      >
                        <span>March</span>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <span key={day} className="text-center">{day}</span>
                        ))}
                      </div>
                      <div className="space-y-px" style={{ backgroundColor: palette.line }}>
                        {days.map((week, weekIndex) => (
                          <div
                            key={weekIndex}
                            className="grid grid-cols-[1.2fr,repeat(7,minmax(0,1fr))] gap-px"
                            style={{ backgroundColor: palette.line }}
                          >
                            <div
                              className="flex min-h-[108px] items-start px-4 py-4 text-[11px] font-bold uppercase tracking-[0.18em]"
                              style={{ backgroundColor: '#f9f5ee', color: palette.muted }}
                            >
                              Week {weekIndex + 1}
                            </div>
                            {week.map((day, dayIndex) => {
                              const event = day ? calendarEvents[day as keyof typeof calendarEvents] : undefined
                              const selected = day === 19
                              return (
                                <div
                                  key={`${weekIndex}-${dayIndex}`}
                                  className="min-h-[108px] px-3 py-3"
                                  style={{
                                    backgroundColor: selected ? '#fbf4dd' : palette.shell,
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <span
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                                      style={{
                                        backgroundColor: selected ? '#f1c84f' : 'transparent',
                                        color: day ? palette.text : '#b7aa9a',
                                      }}
                                    >
                                      {day || ''}
                                    </span>
                                  </div>
                                  {event ? (
                                    <div
                                      className="mt-5 rounded-[16px] px-3 py-2"
                                      style={{ backgroundColor: event.tone }}
                                    >
                                      <p className="text-[12px] font-bold leading-tight">{event.title}</p>
                                      <p className="mt-1 text-[11px]" style={{ color: '#6f655c' }}>{event.time}</p>
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div
                        className="rounded-[28px] border px-5 py-5"
                        style={{ backgroundColor: '#fff9ef', borderColor: '#edd98e' }}
                      >
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#a17c28' }}>
                          Selected day
                        </p>
                        <h3 className="mt-3 text-2xl font-black tracking-[-0.05em]">Wednesday 19</h3>
                        <p className="mt-2 text-sm leading-relaxed" style={{ color: palette.muted }}>
                          The right rail can shift with the selected day and show a more curated, high-service schedule.
                        </p>
                      </div>

                      <div className="space-y-3">
                        {appointments.map((item) => (
                          <div
                            key={item.time}
                            className="rounded-[24px] border px-4 py-4"
                            style={{ backgroundColor: palette.shell, borderColor: palette.line }}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-sm font-bold"
                                style={{ backgroundColor: item.tone }}
                              >
                                {item.time}
                              </div>
                              <div>
                                <p className="text-sm font-bold">{item.title}</p>
                                <p className="mt-1 text-xs" style={{ color: palette.muted }}>{item.detail}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div
                  className="rounded-[30px] border px-5 py-5"
                  style={{ backgroundColor: '#fcf9f4', borderColor: palette.line }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: palette.muted }}>
                        Front desk tasks
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.05em]">Calm operational flow</h3>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ backgroundColor: palette.sky, color: '#5e7794' }}
                    >
                      3 actions
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.title}
                        className="rounded-[22px] border px-4 py-4"
                        style={{ backgroundColor: palette.shell, borderColor: palette.line }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: task.tone }} />
                          <p className="text-sm font-bold">{task.title}</p>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed" style={{ color: palette.muted }}>
                          {task.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-[30px] border px-5 py-5"
                  style={{ backgroundColor: '#fdf9f2', borderColor: palette.line }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: palette.muted }}>
                        Inbox treatment
                      </p>
                      <h3 className="mt-2 text-xl font-black tracking-[-0.05em]">Message cards, softened</h3>
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: palette.muted }}>
                      Pastel tags
                    </span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      ['Membership question', 'Reply within 12 min', palette.sky],
                      ['Referral follow-up', 'Warm lead from Elena', palette.blush],
                      ['Package upgrade', 'Requested pricing today', palette.sage],
                    ].map((row) => (
                      <div
                        key={row[0]}
                        className="rounded-[22px] border px-4 py-4"
                        style={{ backgroundColor: palette.shell, borderColor: palette.line }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-bold">{row[0]}</p>
                          <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                            style={{ backgroundColor: row[2] as string, color: '#6f655c' }}
                          >
                            Open
                          </span>
                        </div>
                        <p className="mt-2 text-xs" style={{ color: palette.muted }}>{row[1]}</p>
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
