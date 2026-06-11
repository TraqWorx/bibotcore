import Link from 'next/link'
import Image from 'next/image'
import LandingHeroForm from './_components/LandingHeroForm'

export const metadata = {
  title: 'GHL Custom Dash — Custom dashboards for GoHighLevel agencies',
  description:
    'Build white-label, drag-and-drop dashboards for your GoHighLevel sub-accounts and share them with clients. £120/mo per sub-account.',
}

const FEATURES = [
  { title: 'Drag-and-drop builder', body: 'Compose any dashboard from metrics, tables, charts and lists — no code, no developers.' },
  { title: 'AI dashboard designer', body: 'Describe what you want and let AI build the widgets, pull the data and lay it out.' },
  { title: 'Live GHL sync', body: 'Contacts, pipelines, calendars, conversations and team — straight from your sub-accounts.' },
  { title: 'White-label & branded', body: 'Your colours, your logo, your domain. Clients never see anything but your brand.' },
  { title: 'Share with clients', body: 'One embeddable link per location — drop it into a GHL custom menu and you are done.' },
  { title: 'Full CRM, per agency', body: 'The complete toolkit, scoped to your agency: every sub-account, your data only.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(160deg,#0b0026 0%,#15004d 55%,#0b0026 100%)' }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,214,232,0.10) 0%, transparent 70%)' }} />

      <div className="relative mx-auto w-full max-w-6xl px-5">
        {/* Nav */}
        <header className="flex items-center justify-between py-6">
          <div className="flex items-center gap-3">
            <Image src="/ghlcustomdash-mark.svg" alt="GHL Custom Dash" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <span className="text-base font-bold tracking-tight">GHL Custom Dash</span>
          </div>
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
            Log in
          </Link>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center gap-7 pt-16 pb-20 text-center sm:pt-24">
          <span className="rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200" style={{ background: 'rgba(0,214,232,0.10)', border: '1px solid rgba(0,214,232,0.25)' }}>
            For GoHighLevel agencies
          </span>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">
            Custom dashboards your<br className="hidden sm:block" /> GHL clients will actually love
          </h1>
          <p className="max-w-xl text-base text-white/55 sm:text-lg">
            Build white-label, drag-and-drop dashboards for every sub-account and share them with a single link. Live GoHighLevel data, your branding, in minutes.
          </p>
          <LandingHeroForm />
        </section>

        {/* Features */}
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <h3 className="text-base font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Pricing */}
        <section className="flex justify-center pb-24">
          <div className="w-full max-w-md rounded-3xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,214,232,0.25)', boxShadow: '0 24px 80px rgba(91,43,255,0.25)' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Simple pricing</p>
            <div className="mt-3 flex items-end justify-center gap-1">
              <span className="text-5xl font-black">£120</span>
              <span className="mb-1 text-sm text-white/50">/mo per sub-account</span>
            </div>
            <ul className="mx-auto mt-6 space-y-2 text-left text-sm text-white/65">
              {['Unlimited dashboards per location', 'AI builder + all widget types', 'Live GHL data sync', 'White-label embeddable share links', 'Full CRM, scoped to your agency'].map((i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-cyan-300">✓</span>{i}</li>
              ))}
            </ul>
            <LandingCTA />
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-center gap-2 border-t py-8 text-center text-xs text-white/30" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <Image src="/ghlcustomdash-mark.svg" alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-md" />
            <span className="font-semibold text-white/50">GHL Custom Dash</span>
          </div>
          <p>© {new Date().getFullYear()} GHL Custom Dash · ghlcustomdash.com</p>
        </footer>
      </div>
    </div>
  )
}

function LandingCTA() {
  return (
    <Link
      href="/login"
      className="mt-7 block w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: 'linear-gradient(90deg,#5B2BFF,#00D6E8)', boxShadow: '0 8px 28px rgba(91,43,255,0.45)' }}
    >
      Get started
    </Link>
  )
}
