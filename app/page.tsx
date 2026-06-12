import Link from 'next/link'
import Image from 'next/image'
import RequestAccessModal from './_components/RequestAccessModal'

export const metadata = {
  title: 'GHL Custom Dash — Done-for-you custom CRMs on GoHighLevel',
  description:
    'We design and build a fully bespoke, white-label CRM on top of GoHighLevel for your business — built for you, delivered ready to use.',
}

const FEATURES = [
  { title: 'Built for you, not by you', body: 'We design and build the entire CRM around your business — you never touch code, config or templates.' },
  { title: 'Fully bespoke', body: 'Custom modules for whatever you run: commissions, renewals, imports, client portals, reporting.' },
  { title: 'White-label & branded', body: 'Your logo, your colours, your domain. It looks and feels like your own product.' },
  { title: 'Deep GoHighLevel integration', body: 'Contacts, pipelines, calendars, conversations and team — wired straight to your sub-accounts.' },
  { title: 'Delivered ready to use', body: 'We handle the build, data import and launch. You get a working CRM, not a toolkit.' },
  { title: 'Maintained & evolved', body: 'We support it and grow it with your business — new features, changes and fixes as you scale.' },
]

const DESIGNS = [
  { slug: 'apulia-power', name: 'Apulia Power', logo: '/apulia-power-logo.webp', body: 'Energy & utilities reseller CRM — POD management, commissions and switch-outs.' },
  { slug: 'apulia-tourism', name: 'Apulia Tourism', logo: '/brands/apulia-tourism-logo.png', body: 'Contacts, campaigns and messaging for a tourism operator.' },
  { slug: 'simfonia', name: 'Simfonia', logo: '/brands/simfonia-logo.png', body: 'Telephony & energy reseller CRM — renewals pipeline + client portal.' },
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
          <div className="flex items-center gap-2">
            <RequestAccessModal />
            <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.16)' }}>
              Log in
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="flex flex-col items-center gap-7 pt-16 pb-20 text-center sm:pt-24">
          <span className="rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-cyan-200" style={{ background: 'rgba(0,214,232,0.10)', border: '1px solid rgba(0,214,232,0.25)' }}>
            Done-for-you · built on GoHighLevel
          </span>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">
            We build your custom CRM.<br className="hidden sm:block" /> You run your business.
          </h1>
          <p className="max-w-xl text-base text-white/55 sm:text-lg">
            A fully bespoke, white-label CRM built on top of GoHighLevel — designed around your exact workflow and delivered ready to use. No DIY builders, no templates. We build it for you.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <RequestAccessModal large />
            <Link href="#designs" className="text-sm font-semibold text-cyan-300 hover:underline">See what we&apos;ve built →</Link>
          </div>
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

        {/* Work showcase */}
        <section id="designs" className="scroll-mt-20 pb-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black sm:text-3xl">Custom CRMs we&apos;ve built</h2>
            <p className="mt-2 text-sm text-white/50">Real, white-label CRMs we designed and built for clients on GoHighLevel.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {DESIGNS.map((d) => (
              <Link key={d.name} href={`/case-studies/${d.slug}`} className="group block rounded-2xl p-6 text-center transition hover:-translate-y-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <div className="mx-auto flex h-20 items-center justify-center rounded-xl bg-white/90 px-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.logo} alt={d.name} className="max-h-11 w-auto object-contain" />
                </div>
                <h3 className="mt-4 text-base font-bold">{d.name}</h3>
                <p className="mt-1 text-sm text-white/50">{d.body}</p>
                <span className="mt-3 inline-block text-xs font-semibold text-cyan-300 group-hover:underline">View case study →</span>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="flex justify-center pb-24">
          <div className="w-full max-w-md rounded-3xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,214,232,0.25)', boxShadow: '0 24px 80px rgba(91,43,255,0.25)' }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Done for you</p>
            <h2 className="mt-3 text-2xl font-black">Ready for your custom CRM?</h2>
            <ul className="mx-auto mt-6 space-y-2 text-left text-sm text-white/65">
              {['Designed around your workflow', 'White-label, on your domain', 'Full GoHighLevel integration', 'Built, launched & supported by us'].map((i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-cyan-300">✓</span>{i}</li>
              ))}
            </ul>
            <div className="mt-7 flex justify-center">
              <RequestAccessModal large />
            </div>
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
